"""Import contracts, not coordinate-nearest guesses at connectivity."""

import math


def validate_features(collection, limit=5000):
    if collection.get("type") != "FeatureCollection":
        raise ValueError("INVALID_GEOJSON")
    features = collection.get("features", [])
    if len(features) >= limit or collection.get("numberMatched", len(features)) > len(
        features
    ):
        raise ValueError("POSSIBLY_TRUNCATED")
    for f in features:
        if not f.get("geometry"):
            raise ValueError("MISSING_GEOMETRY")
    return features


def map_external(records):
    out = {}
    for r in records:
        key = (r["provider"], r["entity_type"], r["external_id"])
        if key in out and out[key] != r["internal_id"]:
            raise ValueError("CONFLICTING_EXTERNAL_ID")
        out[key] = r["internal_id"]
    return out


def haversine_m(a, b):
    lon1, lat1, lon2, lat2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    return (
        6371008.8
        * 2
        * math.asin(
            math.sqrt(
                math.sin((lat2 - lat1) / 2) ** 2
                + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
            )
        )
    )


def import_network(collection, fieldmap):
    """Require caller-reviewed field mapping; crossings and different floors are never autojoined."""
    features = validate_features(collection)
    nodes = {}
    edges = []
    for f in features:
        p = f["properties"]
        g = f["geometry"]
        if g["type"] != "LineString":
            raise ValueError("EXPECTED_LINESTRING")
        a, b = p[fieldmap["from_id"]], p[fieldmap["to_id"]]
        for id, coord, level in [
            (a, g["coordinates"][0], p[fieldmap["from_level"]]),
            (b, g["coordinates"][-1], p[fieldmap["to_level"]]),
        ]:
            key = str(id)
            node = {"id": key, "level_id": str(level), "coordinates": coord}
            if key in nodes and nodes[key] != node:
                raise ValueError("CONFLICTING_NETWORK_NODE")
            nodes[key] = node
        cross = nodes[str(a)]["level_id"] != nodes[str(b)]["level_id"]
        facility = p.get(fieldmap.get("facility_id", ""))
        if cross and not facility:
            raise ValueError("UNSUPPORTED_VERTICAL")
        edges.append(
            {
                "id": str(f.get("id", len(edges))),
                "from_id": str(a),
                "to_id": str(b),
                "geometry": g,
                "facility_id": facility,
                "length_m": p.get(fieldmap.get("length_m", "")),
                "source": "CSDI",
                "access_evidence": "unknown",
            }
        )
    return {"nodes": list(nodes.values()), "edges": edges}
