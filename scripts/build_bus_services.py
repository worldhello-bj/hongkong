import sys, json, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.fetch_sources import fetch, ROOT

stops = json.loads((ROOT / "data/normalized/bus_stops.json").read_text())
chosen = []
for keyword, n in [("ADMIRALTY", 3), ("HIGH SPEED RAIL", 4), ("KOWLOON STATION", 2)]:
    chosen.extend([s for s in stops if keyword in s["name_en"]][:n])
services = []
records = []
seen = set()
for s in {s["stop"]: s for s in chosen}.values():
    d, r = fetch(
        "kmb-eta-" + s["stop"] + ".json",
        "https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/" + s["stop"],
    )
    records.append(r)
    for p in (d or {}).get("data", []):
        key = (p["route"], p["dir"], str(p["service_type"]), s["stop"])
        if key in seen:
            continue
        seen.add(key)
        services.append(
            dict(
                provider="KMB",
                route=p["route"],
                direction=p["dir"],
                service_type=str(p["service_type"]),
                stop_id=s["stop"],
                name_tc=s["name_tc"],
                name_en=s["name_en"],
                dest_tc=p.get("dest_tc"),
                dest_en=p.get("dest_en"),
                source_id="KMB",
                verified_from="official_stop_eta",
                received_at=r["received_at"],
            )
        )
    time.sleep(0.3)
(ROOT / "data/normalized/bus_services.json").write_text(
    json.dumps(services, ensure_ascii=False, indent=2)
)
p = ROOT / "docs/source-probes.json"
old = json.loads(p.read_text()) if p.exists() else []
p.write_text(json.dumps(old + records, indent=2))
print("Verified bus service records", len(services))
