"""Publish immutable Hong Kong research topology. Schematic coordinates are not geographic."""

import json, hashlib, sqlite3, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def build():
    venues = [
        {
            "id": "ADM",
            "name_tc": "金鐘",
            "name_en": "Admiralty",
            "aliases": ["金钟"],
            "levels": ["G", "L1", "L2", "L3", "L4", "L5", "L6"],
            "lon": 114.1652,
            "lat": 22.2791,
        },
        {
            "id": "AUS",
            "name_tc": "柯士甸",
            "name_en": "Austin",
            "aliases": [],
            "levels": ["1", "G", "C", "P"],
            "lon": 114.1665,
            "lat": 22.3043,
        },
        {
            "id": "KOW",
            "name_tc": "九龍",
            "name_en": "Kowloon",
            "aliases": ["九龙"],
            "levels": ["U5", "U3", "G", "L2", "L4"],
            "lon": 114.1625,
            "lat": 22.3046,
        },
        {
            "id": "WEK",
            "name_tc": "香港西九龍",
            "name_en": "West Kowloon",
            "aliases": ["香港西九龙"],
            "levels": ["G", "B1", "B3"],
            "lon": 114.1650,
            "lat": 22.3037,
        },
    ]
    nodes = []
    edges = []

    def n(id, v, tc, en, level, kind, x, y, paid=False, **kw):
        nodes.append(
            dict(
                id=id,
                venue_id=v,
                name_tc=tc,
                name_en=en,
                level_id=level,
                kind=kind,
                x=x,
                y=y,
                paid_area=v if paid else None,
                coordinate_system="SCHEMATIC",
                **kw,
            )
        )
        return id

    def e(a, b, kind, minutes, source="MTR-LAYOUT", both=True, **kw):
        base = dict(
            id=f"{a}--{b}:{kind}",
            from_id=a,
            to_id=b,
            kind=kind,
            minutes=minutes,
            length_m=None,
            length_source=None,
            evidence="DOCUMENTED_TOPOLOGY_UNMEASURED",
            source_id=source,
            access_evidence="unknown",
            time_state="ESTIMATED",
        )
        base.update(kw)
        if kind == "bus":
            base["id"] += ":" + base.get("service_key", "")
        edges.append(base)
        if both:
            edges.append(dict(base, id=f"{b}--{a}:{kind}", from_id=b, to_id=a))

    n("ADM:entry", "ADM", "金鐘站 A 出入口", "Exit A", "G", "entrance", 95, 130)
    n("ADM:hall", "ADM", "未付費大堂", "Unpaid concourse", "L1", "concourse", 220, 180)
    n("ADM:paid", "ADM", "已付費大堂", "Paid concourse", "L1", "gate", 360, 180, True)
    e("ADM:entry", "ADM:hall", "stairs", 2, facility_id="ADM:entry-stairs")
    e(
        "ADM:entry",
        "ADM:hall",
        "lift",
        3,
        facility_id="ADM:entrance-lift",
        evidence_note="Layout documents accessible entrance A/D; precise facility selection requires site confirmation",
    )
    e("ADM:hall", "ADM:paid", "gate", 1, paid_transition="enter")
    for level, y in [("L2", 280), ("L3", 390), ("L4", 490), ("L5", 585), ("L6", 685)]:
        n(
            "ADM:" + level,
            "ADM",
            "轉乘節點 " + level,
            "Transfer " + level,
            level,
            "transfer",
            385,
            y,
            True,
        )
    chain = ["ADM:paid", "ADM:L2", "ADM:L3", "ADM:L4", "ADM:L5", "ADM:L6"]
    for a, b in zip(chain, chain[1:]):
        e(a, b, "stairs", 1.5, facility_id=a + "-stairs")
        e(a, b, "lift", 2.2, facility_id="ADM:lift:" + b)
    for plat, line, dir, tc, en, level, x in [
        ("1", "TWL", "UP", "荃灣", "Tsuen Wan", "L3", 605),
        ("2", "ISL", "DOWN", "堅尼地城", "Kennedy Town", "L3", 190),
        ("3", "ISL", "UP", "柴灣", "Chai Wan", "L2", 605),
        ("4", "TWL", "DOWN", "中環", "Central", "L2", 190),
        ("7", "EAL", "UP", "羅湖／落馬洲", "Lo Wu / Lok Ma Chau", "L5", 605),
        ("8", "EAL", "DOWN", "終點站", "Terminus", "L5", 190),
        ("5", "SIL", "UP", "海怡半島", "South Horizons", "L6", 605),
        ("6", "SIL", "UP", "海怡半島", "South Horizons", "L6", 190),
    ]:
        a = n(
            "ADM:P" + plat,
            "ADM",
            f"{line} {plat} 號月台 · {tc}",
            f"{line} platform {plat} · {en}",
            level,
            "platform",
            x,
            next(z["y"] for z in nodes if z["id"] == "ADM:" + level),
            True,
            line=line,
            direction=dir,
            platform=plat,
        )
        e("ADM:" + level, a, "walk", 0.8)
    for v, line, d1, d2 in [
        ("AUS", "TML", "屯門", "烏溪沙"),
        ("KOW", "TCL", "東涌", "香港"),
    ]:
        hall = "C" if v == "AUS" else "G"
        platlevel = "P" if v == "AUS" else "L4"
        n(v + ":entry", v, "公共出入口", "Public entrance", "G", "entrance", 110, 180)
        n(v + ":hall", v, "未付費大堂", "Unpaid concourse", hall, "concourse", 280, 260)
        n(v + ":paid", v, "已付費大堂", "Paid concourse", hall, "gate", 430, 260, True)
        e(v + ":entry", v + ":hall", "stairs", 2, facility_id=v + ":stairs")
        e(v + ":entry", v + ":hall", "lift", 3, facility_id=v + ":lift")
        e(v + ":hall", v + ":paid", "gate", 1, paid_transition="enter")
        for i, (d, dir) in enumerate([(d1, "UP"), (d2, "DOWN")]):
            p = n(
                v + ":" + line + ":" + dir,
                v,
                line + " 往 " + d,
                line + " " + dir,
                platlevel,
                "platform",
                250 + i * 330,
                430,
                True,
                line=line,
                direction=dir,
                platform=str(i + 1 if v == "AUS" else i + 3),
            )
            e(v + ":paid", p, "stairs", 2, facility_id=v + ":platform-stairs")
            e(
                v + ":paid",
                p,
                "lift",
                3,
                facility_id=v + ":platform-lift",
                evidence="DOCUMENTED_TOPOLOGY_UNMEASURED",
            )
    n(
        "WEK:entry",
        "WEK",
        "西九龍公共接駁入口",
        "Public connecting entrance",
        "G",
        "entrance",
        110,
        150,
    )
    n(
        "WEK:verification",
        "WEK",
        "B1 實名核驗及驗票",
        "B1 identity and ticket verification",
        "B1",
        "process",
        310,
        270,
    )
    n("WEK:security", "WEK", "安檢", "Security check", "B1", "process", 530, 270)
    n(
        "WEK:immigration",
        "WEK",
        "B3 出入境手續",
        "B3 immigration formalities",
        "B3",
        "process",
        350,
        430,
    )
    n(
        "WEK:boarding",
        "WEK",
        "B3 離港候車及登車",
        "B3 departure and boarding",
        "B3",
        "process",
        600,
        430,
    )
    e(
        "AUS:entry",
        "WEK:entry",
        "walk",
        7,
        "MTR-HSR-CONNECTION",
        evidence="DOCUMENTED_CONNECTION_UNMEASURED",
    )
    e(
        "KOW:entry",
        "WEK:entry",
        "walk",
        12,
        "MTR-HSR-CONNECTION",
        evidence="DOCUMENTED_CONNECTION_UNMEASURED",
    )
    e(
        "WEK:entry",
        "WEK:verification",
        "walk",
        4,
        "MTR-HSR",
        facility_id="WEK:public-access",
        evidence="PROVISIONAL_PROCESS_ACCESS",
    )
    # Process links are shown but excluded from ordinary routing; HSR rule engine handles their times once.
    e("WEK:verification", "WEK:security", "process", 8, "MTR-HSR", both=False)
    e(
        "WEK:security",
        "WEK:immigration",
        "process",
        10,
        "MTR-HSR",
        both=False,
        facility_id="WEK:process-vertical",
    )
    e("WEK:immigration", "WEK:boarding", "process", 2, "MTR-HSR", both=False)
    # Direction-specific aggregate rail legs; times/headways are declared research assumptions, not schedules.
    n(
        "HUH:EAL",
        "HUH",
        "紅磡 東鐵綫",
        "Hung Hom East Rail",
        "aggregate",
        "platform",
        0,
        0,
        True,
        line="EAL",
        direction="UP",
    )
    n(
        "HUH:TML",
        "HUH",
        "紅磡 屯馬綫",
        "Hung Hom Tuen Ma",
        "aggregate",
        "platform",
        0,
        0,
        True,
        line="TML",
        direction="UP",
    )
    e(
        "ADM:P7",
        "HUH:EAL",
        "mtr",
        7,
        "MTR-NETWORK",
        both=False,
        line="EAL",
        headway_minutes=6,
        service_key="MTR:EAL:UP",
        evidence="NETWORK_DOCUMENTED_TIME_ASSUMPTION",
    )
    e(
        "HUH:EAL",
        "HUH:TML",
        "transfer",
        5,
        "MTR-NETWORK",
        facility_id="HUH:aggregate-transfer",
        evidence="AGGREGATE_TRANSFER_UNVERIFIED",
    )
    e(
        "HUH:TML",
        "AUS:TML:UP",
        "mtr",
        7,
        "MTR-NETWORK",
        both=False,
        line="TML",
        headway_minutes=6,
        service_key="MTR:TML:UP",
        evidence="NETWORK_DOCUMENTED_TIME_ASSUMPTION",
    )
    busfile = ROOT / "data/normalized/bus_stops.json"
    if busfile.exists():
        stops = json.loads(busfile.read_text())
        for i, s in enumerate(stops):
            v = (
                "ADM"
                if "ADMIRALTY" in s["name_en"]
                else ("WEK" if "WEST KOWLOON" in s["name_en"] else "KOW")
            )
            a = n(
                "KMB:" + s["stop"],
                v,
                s["name_tc"],
                s["name_en"],
                "G",
                "bus_stop",
                75 + (i % 3) * 60,
                50,
                lon=float(s["long"]),
                lat=float(s["lat"]),
                provider="KMB",
                external_id=s["stop"],
            )
            e(
                a,
                v + ":entry",
                "walk",
                4,
                "KMB-STOPS",
                evidence="PROVISIONAL_ACCESS_NOT_SURVEYED",
            )
    patternsfile = ROOT / "data/normalized/bus_patterns.json"
    if patternsfile.exists():
        for p in json.loads(patternsfile.read_text()):
            u = p.get("upstream_stop")
            if not u:
                continue
            a = "KMB:" + u["stop"]
            b = "KMB:" + p["stop_id"]
            if not any(x["id"] == b for x in nodes):
                continue
            if not any(x["id"] == a for x in nodes):
                n(
                    a,
                    "ADM" if "ADMIRALTY" in p["name_en"] else "WEK",
                    u["name_tc"] + " · 公交接駁",
                    u["name_en"] + " · Bus approach",
                    "G",
                    "bus_stop",
                    40,
                    30,
                    lon=float(u["long"]),
                    lat=float(u["lat"]),
                    provider="KMB",
                    external_id=u["stop"],
                )
            e(
                a,
                b,
                "bus",
                p["estimated_interval_minutes"],
                "KMB-ROUTE-STOP",
                both=False,
                route=p["route"],
                direction=p["direction"],
                service_type=p["service_type"],
                headway_minutes=12,
                service_key="KMB:"
                + p["route"]
                + ":"
                + p["direction"]
                + ":"
                + p["service_type"],
                evidence="OFFICIAL_STOP_ORDER_UNCALIBRATED_TIME",
            )
    for node in nodes:
        node.setdefault(
            "source_id", "KMB-STOPS" if node.get("provider") == "KMB" else "MTR-LAYOUT"
        )
        node.setdefault("evidence", "DOCUMENTED_TOPOLOGY_UNMEASURED")
    model = {
        "version": "hk-research-2026-10-09-v1",
        "city_id": "hong_kong",
        "coordinate_system": "SCHEMATIC (x/y); EPSG:4326 only for explicit lon/lat",
        "geometry_status": "Official CSDI geometry available separately; route topology contains unmeasured and provisional connections",
        "venues": venues,
        "nodes": nodes,
        "edges": edges,
        "warnings": [
            "Research prototype: timings are assumptions, critical connections await independent and field audit.",
            "Strict accessibility returns unverified rather than promising a route.",
        ],
    }
    model["version"] = (
        "hk-"
        + hashlib.sha256(
            json.dumps(model, ensure_ascii=False, sort_keys=True).encode()
        ).hexdigest()[:16]
    )
    payload = json.dumps(model, ensure_ascii=False, sort_keys=True)
    digest = hashlib.sha256(payload.encode()).hexdigest()
    folder = ROOT / "builds" / digest[:16]
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "model.json").write_text(payload)
    (ROOT / "data/normalized/model.json").write_text(
        json.dumps(model, ensure_ascii=False, indent=2)
    )
    manifest = {
        "id": digest[:16],
        "sha256": digest,
        "city_id": "hong_kong",
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "node_count": len(nodes),
        "edge_count": len(edges),
        "independent_review": False,
        "field_verification": False,
    }
    if (folder / "manifest.json").exists():
        manifest = json.loads((folder / "manifest.json").read_text())
    else:
        (folder / "manifest.json").write_text(json.dumps(manifest, indent=2))
    (ROOT / "docs/model-manifest.json").write_text(json.dumps(manifest, indent=2))
    print(manifest)
    return model


if __name__ == "__main__":
    build()
