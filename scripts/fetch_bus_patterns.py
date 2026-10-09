import sys, json, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.fetch_sources import fetch, ROOT

services = json.loads((ROOT / "data/normalized/bus_services.json").read_text())
stops = {
    s["stop"]: s
    for s in json.loads((ROOT / "data/raw/kmb-stops.json").read_text())["data"]
}
chosen = []
seen = set()
for key, count in [("ADMIRALTY", 6), ("KOWLOON", 6)]:
    for s in services:
        service = (s["route"], s["direction"], s["service_type"])
        if key not in s["name_en"] or service in seen:
            continue
        chosen.append(s)
        seen.add(service)
        if sum(key in x["name_en"] for x in chosen) >= count:
            break
patterns = []
records = []
for s in chosen:
    direction = "outbound" if s["direction"] == "O" else "inbound"
    u = f"https://data.etabus.gov.hk/v1/transport/kmb/route-stop/{s['route']}/{direction}/{s['service_type']}"
    d, r = fetch(f"kmb-pattern-{s['route']}-{direction}-{s['service_type']}.json", u)
    records.append(r)
    if d and isinstance(d.get("data"), list):
        seq = sorted(d["data"], key=lambda x: int(x["seq"]))
        target = next((i for i, x in enumerate(seq) if x["stop"] == s["stop_id"]), None)
        if target is not None:
            upstream = seq[target - 1]["stop"] if target > 0 else None
            patterns.append(
                dict(
                    s,
                    pattern_stops=seq,
                    upstream_stop=stops.get(upstream),
                    interval_minutes=None,
                    estimated_interval_minutes=4,
                    estimate_note="Research parameter, not measured running time or official timetable",
                    source_url=u,
                )
            )
    time.sleep(0.3)
(ROOT / "data/normalized/bus_patterns.json").write_text(
    json.dumps(patterns, ensure_ascii=False, indent=2)
)
p = ROOT / "docs/source-probes.json"
p.write_text(json.dumps(json.loads(p.read_text()) + records, indent=2))
print(
    "Patterns",
    len(patterns),
    "usable incoming bus legs",
    sum(bool(p["upstream_stop"]) for p in patterns),
)
