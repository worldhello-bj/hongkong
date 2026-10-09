"""Bounded official CSDI network extraction with count/limit completeness verification."""

import sys, json, time
from pathlib import Path
from urllib.parse import urlencode

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.fetch_sources import fetch, ROOT

BASE = "https://portal.csdi.gov.hk/server/rest/services/common/landsd_rcd_1742809197336_78665/MapServer"
REGIONS = {
    "ADM": "114.1634,22.2768,114.1685,22.2800",
    "HUB": "114.1598,22.3024,114.1680,22.3079",
}


def collect():
    records = []
    summaries = []
    schema, r = fetch("network-schema.json", BASE + "/0?f=pjson")
    records.append(r)
    for v, bbox in REGIONS.items():
        common = {
            "where": "1=1",
            "geometry": bbox,
            "geometryType": "esriGeometryEnvelope",
            "inSR": 4326,
            "spatialRel": "esriSpatialRelIntersects",
        }
        count, r = fetch(
            v + "-network-count.json",
            BASE
            + "/0/query?"
            + urlencode(dict(common, f="json", returnCountOnly="true")),
        )
        records.append(r)
        if not count or "count" not in count or count["count"] > 15000:
            raise ValueError("Unbounded or invalid region response")
        features = []
        for offset in range(0, count["count"], 2500):
            q = dict(
                common,
                f="geojson",
                outFields="*",
                outSR=4326,
                returnZ="true",
                resultRecordCount=2500,
                resultOffset=offset,
                orderByFields="OBJECTID",
            )
            d, r = fetch(
                f"{v}-network-page-{offset}.json", BASE + "/0/query?" + urlencode(q)
            )
            records.append(r)
            if not d or "features" not in d:
                raise ValueError("Network response invalid")
            features += d["features"]
            time.sleep(0.4)
        if len(features) != count["count"] or len(
            {f["properties"]["OBJECTID"] for f in features}
        ) != len(features):
            raise ValueError("NETWORK_INCOMPLETE_OR_DUPLICATED")
        out = {
            "type": "FeatureCollection",
            "features": features,
            "scope_bbox": bbox,
            "expected_count": count["count"],
            "completeness": "COUNT_VERIFIED_WITHIN_BBOX",
            "source_url": BASE + "/0",
        }
        (ROOT / "data/raw" / f"{v}-network.json").write_text(json.dumps(out))
        building_ids = sorted(
            {
                p
                for f in features
                for p in [
                    f["properties"].get("BuildingID_1"),
                    f["properties"].get("BuildingID_2"),
                ]
                if p
            }
        )
        q = {
            "where": "BuildingID IN (" + ",".join(map(str, building_ids)) + ")",
            "outFields": "*",
            "f": "json",
            "returnGeometry": "false",
        }
        floors, r = fetch(
            v + "-network-floors.json", BASE + "/1002/query?" + urlencode(q)
        )
        records.append(r)
        summaries.append(
            {
                "region": v,
                "count": len(features),
                "bbox": bbox,
                "completeness": "COUNT_VERIFIED_WITHIN_BBOX",
                "floor_records": len((floors or {}).get("features", [])),
                "source_url": BASE + "/0",
            }
        )
    p = ROOT / "docs/source-probes.json"
    p.write_text(
        json.dumps(
            (json.loads(p.read_text()) if p.exists() else []) + records, indent=2
        )
    )
    (ROOT / "docs/network-acquisition.json").write_text(json.dumps(summaries, indent=2))
    print(summaries)


if __name__ == "__main__":
    collect()
