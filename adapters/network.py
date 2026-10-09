"""Actual CSDI 3D centre-line graph; never merge a 2D crossing or snap a platform."""

import hashlib, json, heapq, math, gzip
from pathlib import Path
from adapters.spatial import haversine_m

ROOT = Path(__file__).resolve().parents[1]
KINDS = {
    8: "escalator",
    16: "escalator",
    9: "travelator",
    17: "travelator",
    10: "lift",
    18: "lift",
    11: "ramp",
    19: "ramp",
    12: "stairs",
    20: "stairs",
    13: "stairlift",
    21: "stairlift",
}


def node_id(region, coord):
    # 1e-8 degrees (~1 mm) / 1 mm vertical agrees with source network tolerance.
    k = ",".join([f"{coord[0]:.8f}", f"{coord[1]:.8f}", f"{coord[2]:.3f}"])
    return region + ":N:" + hashlib.sha256(k.encode()).hexdigest()[:14]


def build_graph(region, collection, floors=None):
    nodes = {}
    edges = []
    features = []
    skipped = []
    floor_names = {
        str(x["attributes"]["FloorID"]): x["attributes"].get("EnglishName")
        for x in (floors or {}).get("features", [])
    }
    if collection.get("expected_count") != len(collection.get("features", [])):
        raise ValueError("NETWORK_COUNT_MISMATCH")
    for f in collection["features"]:
        p = f["properties"]
        g = f["geometry"]
        fid = str(p["PedestrianRouteID"])
        if p.get("Enabled") != 1:
            skipped.append({"id": fid, "reason": "NOT_ENABLED"})
            continue
        if g["type"] != "LineString" or any(len(c) < 3 for c in g["coordinates"]):
            skipped.append({"id": fid, "reason": "MISSING_3D_LINE"})
            continue
        coords = g["coordinates"]
        a, b = [node_id(region, c) for c in [coords[0], coords[-1]]]
        for id, c in [(a, coords[0]), (b, coords[-1])]:
            node = nodes.setdefault(
                id,
                {
                    "id": id,
                    "coordinates": c,
                    "lon": c[0],
                    "lat": c[1],
                    "z": c[2],
                    "floor_ids": [],
                    "locations": [],
                },
            )
            if p.get("FloorID") not in node["floor_ids"]:
                node["floor_ids"].append(p.get("FloorID"))
            if p.get("Location") not in node["locations"]:
                node["locations"].append(p.get("Location"))
        length = sum(
            math.hypot(haversine_m(c, d), d[2] - c[2])
            for c, d in zip(coords, coords[1:])
        )
        kind = KINDS.get(p["FeatureType"], "walk")
        e = {
            "id": region + ":E:" + fid,
            "from_id": a,
            "to_id": b,
            "kind": kind,
            "length_m": round(length, 4),
            "official_shape_length_m": p.get("Shape_Length"),
            "length_source": "3D WGS84 geodesic segments and official z",
            "source_id": "CSDI-INDOOR-NETWORK",
            "evidence": "OFFICIAL_3D_NETWORK",
            "access_evidence": (
                "documented" if p.get("WheelchairBarrier") == 2 else "unknown"
            ),
            "wheelchair_barrier": p.get("WheelchairBarrier"),
            "direction": p.get("Direction"),
            "location": p.get("Location"),
            "floor_id": p.get("FloorID"),
            "floor_name": floor_names.get(str(p.get("FloorID"))),
            "name_tc": p.get("AliasNameTC") or "官方行人路網",
            "name_en": p.get("AliasNameEN") or "Official pedestrian network",
            "access_time_id": p.get("AccessTimeID"),
            "geometry": g,
            "source_properties": p,
            "facility_id": fid if kind != "walk" else None,
        }
        # Direction=+1 forward, -1 reverse, 0 both; unknown moving-way direction is not guessed.
        direction = p.get("Direction")
        if kind in ["escalator", "travelator"] and direction not in [-1, 0, 1]:
            skipped.append({"id": fid, "reason": "UNKNOWN_MOVING_WAY_DIRECTION"})
            continue
        if (
            direction in [0, 1]
            or direction is None
            and kind not in ["escalator", "travelator"]
        ):
            edges.append(e)
        if (
            direction in [0, -1]
            or direction is None
            and kind not in ["escalator", "travelator"]
        ):
            edges.append(
                dict(
                    e,
                    id=e["id"] + ":reverse",
                    from_id=b,
                    to_id=a,
                    geometry={
                        "type": "LineString",
                        "coordinates": list(reversed(coords)),
                    },
                )
            )
        features.append(
            {
                "type": "Feature",
                "geometry": g,
                "properties": {
                    k: v
                    for k, v in e.items()
                    if k not in ["geometry", "source_properties"]
                },
            }
        )
    return {
        "region": region,
        "nodes": list(nodes.values()),
        "edges": edges,
        "features": features,
        "skipped": skipped,
        "scope_bbox": collection.get("scope_bbox"),
        "source_count": len(collection["features"]),
        "graph_method": "Only coincident 3D polyline endpoints at 1 mm tolerance; crossings not autojoined",
        "warnings": [
            "Network geometry is official. Mapping to specific platform boarding positions and gates needs independent review.",
            "Access hours with unresolved rule IDs are excluded. Current lift operation is unknown.",
        ],
    }


def load_graph(region):
    if region not in ["ADM", "HUB"]:
        raise ValueError("UNKNOWN_NETWORK_REGION")
    p = ROOT / "data/raw" / f"{region}-network.json"
    fp = ROOT / "data/raw" / f"{region}-network-floors.json"

    def read(path):
        if path.exists():
            return json.loads(path.read_text())
        packed = ROOT / "data/official" / (path.name + ".gz")
        if packed.exists():
            return json.loads(gzip.decompress(packed.read_bytes()))
        return None

    data = read(p)
    if data is None:
        raise ValueError("OFFICIAL_NETWORK_NOT_DOWNLOADED")
    return build_graph(region, data, read(fp))


def route_graph(graph, start, end, preference="fast", closed=(), speed=1.2):
    if not 0.3 <= speed <= 3:
        raise ValueError("INVALID_SPEED")
    nodes = {n["id"]: n for n in graph["nodes"]}
    if start not in nodes or end not in nodes:
        raise ValueError("UNKNOWN_NETWORK_NODE")
    adj = {k: [] for k in nodes}
    for e in graph["edges"]:
        adj[e["from_id"]].append(e)
    queue = [(0, 0, (start, 0, False), [])]
    best = {(start, 0, False): 0}
    blocked_facilities = set()
    while queue:
        cost, seconds, state, path = heapq.heappop(queue)
        node, last_location, exited = state
        if cost > best.get(state, float("inf")):
            continue
        if node == end:
            return {
                "status": "CONDITIONAL",
                "data_state": "OFFICIAL_NETWORK_ESTIMATED_TIME",
                "total_minutes": round(seconds / 60, 2),
                "distance_m": round(sum(e["length_m"] for e in path), 2),
                "legs": path,
                "geometry": {
                    "type": "FeatureCollection",
                    "features": [
                        {
                            "type": "Feature",
                            "geometry": e["geometry"],
                            "properties": {"id": e["id"], "kind": e["kind"]},
                        }
                        for e in path
                    ],
                },
                "warnings": graph["warnings"],
                "from_node": nodes[start],
                "to_node": nodes[end],
                "access_status": "DOCUMENTED_NOT_FIELD_VERIFIED",
                "blocked_facilities": sorted(blocked_facilities),
                "paid_area_transitions": [
                    {
                        "after_edge": path[i - 1]["id"],
                        "before_edge": e["id"],
                        "from_location": path[i - 1]["location"],
                        "to_location": e["location"],
                        "gate_status": "UNMAPPED_CONFIRM_ON_SITE",
                    }
                    for i, e in enumerate(path)
                    if i and path[i - 1]["location"] != e["location"]
                ],
            }
        for e in adj[node]:
            if e["id"] in closed or e.get("facility_id") in closed:
                continue
            if e["access_time_id"] is not None:
                continue
            newly_exited = exited or (last_location == 3 and e["location"] != 3)
            if exited and e["location"] == 3:
                continue
            nextstate = (e["to_id"], e["location"], newly_exited)
            # Official code 2 means no wheelchair barrier; moving facilities still need current operating evidence.
            if preference == "accessible" and (
                e["wheelchair_barrier"] != 2
                or e["kind"]
                in ["stairs", "escalator", "lift", "stairlift", "travelator"]
            ):
                blocked_facilities.add(e.get("facility_id") or e["id"])
                continue
            duration = e["length_m"] / speed
            if e["kind"] == "lift":
                duration = e["length_m"] / 1.0 + 45
            elif e["kind"] in ["stairs", "escalator", "stairlift"]:
                duration = e["length_m"] / 0.6
            score = duration + (
                duration * 2
                if preference == "few_stairs" and e["kind"] == "stairs"
                else 0
            )
            nextcost = cost + score
            if nextcost >= best.get(nextstate, float("inf")):
                continue
            best[nextstate] = nextcost
            heapq.heappush(
                queue,
                (
                    nextcost,
                    seconds + duration,
                    nextstate,
                    path
                    + [
                        dict(
                            e,
                            minutes=round(duration / 60, 3),
                            label=e["name_tc"],
                            time_state="ESTIMATED",
                        )
                    ],
                ),
            )
    return {
        "status": "UNVERIFIED_ACCESS" if preference == "accessible" else "NO_ROUTE",
        "legs": [],
        "warnings": [
            "No eligible directed path within the extracted network; no nearest-point shortcut was created."
        ],
        "blocked_facilities": sorted(blocked_facilities),
    }
