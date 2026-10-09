"""Bounded, explicit collection of official public sources; originals remain untracked."""

import json, hashlib, urllib.request, datetime, time
from pathlib import Path
from urllib.parse import urlencode

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data/raw"
RAW.mkdir(parents=True, exist_ok=True)


def fetch(name, url):
    rec = {
        "name": name,
        "url": url,
        "received_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
    try:
        with urllib.request.urlopen(
            urllib.request.Request(
                url, headers={"User-Agent": "HongKong-MaaS-Research/0.1"}
            ),
            timeout=20,
        ) as r:
            b = r.read(12_000_000)
            rec.update(
                http_status=r.status, bytes=len(b), sha256=hashlib.sha256(b).hexdigest()
            )
            (RAW / name).write_bytes(b)
        try:
            data = json.loads(b)
            rec["count"] = len(data.get("features", data.get("data", [])))
        except Exception:
            data = None
        rec["status"] = "RECEIVED"
        return data, rec
    except Exception as e:
        rec.update(status="UPSTREAM_ERROR", error=str(e))
        return None, rec


def main():
    records = []

    def get(n, u):
        d, r = fetch(n, u)
        records.append(r)
        print(n, r["status"], flush=True)
        time.sleep(0.25)
        return d

    venues = get(
        "csdi-venues.json",
        "https://mapapi.hkmapservice.gov.hk/ogc/wfs/indoor/mtr_venue_polygon?"
        + urlencode(
            {
                "service": "WFS",
                "version": "1.1.0",
                "request": "GetFeature",
                "outputFormat": "application/json",
            }
        ),
    )
    if venues:
        for f in venues["features"]:
            p = f["properties"]
            name = p["venue_name_en"]
            ids = {
                "Admiralty Station": "ADM",
                "Austin Station": "AUS",
                "Kowloon Station": "KOW",
            }
            if name not in ids:
                continue
            for layer in [
                "mtr_level_polygon",
                "mtr_unit_polygon",
                "mtr_opening_line",
                "mtr_amenity_point",
            ]:
                get(
                    ids[name] + "-" + layer + ".json",
                    "https://mapapi.hkmapservice.gov.hk/ogc/wfs/indoor/"
                    + layer
                    + "?"
                    + urlencode(
                        {
                            "service": "WFS",
                            "version": "1.1.0",
                            "request": "GetFeature",
                            "outputFormat": "application/json",
                            "cql_filter": "venue_id='" + p["venue_id"] + "'",
                        }
                    ),
                )
    for sta, line in [
        ("ADM", "EAL"),
        ("ADM", "TWL"),
        ("ADM", "ISL"),
        ("ADM", "SIL"),
        ("AUS", "TML"),
        ("KOW", "TCL"),
        ("KOW", "AEL"),
    ]:
        get(
            "mtr-" + line + "-" + sta + ".json",
            "https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?"
            + urlencode({"line": line, "sta": sta}),
        )
    stops = get("kmb-stops.json", "https://data.etabus.gov.hk/v1/transport/kmb/stop")
    get("kmb-routes.json", "https://data.etabus.gov.hk/v1/transport/kmb/route/")
    if stops:
        candidates = [
            s
            for s in stops["data"]
            if any(
                x in s["name_en"].upper()
                for x in ["WEST KOWLOON STATION", "KOWLOON STATION", "ADMIRALTY"]
            )
        ]
        (ROOT / "data/normalized/bus_stops.json").write_text(
            json.dumps(candidates, ensure_ascii=False, indent=2)
        )
        for s in candidates[:3]:
            get(
                "kmb-eta-" + s["stop"] + ".json",
                "https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/" + s["stop"],
            )
    (ROOT / "docs/source-probes.json").write_text(json.dumps(records, indent=2))


if __name__ == "__main__":
    main()
