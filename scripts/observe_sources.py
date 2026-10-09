"""Explicit bounded connection smoke observation, not a service availability SLA."""

import sys, json, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.fetch_sources import fetch, ROOT
from adapters.realtime import mtr, bus
from app.timeutil import now

records = []
for i in range(3):
    for name, url, parser in [
        (
            "MTR",
            "https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=EAL&sta=ADM",
            lambda d: mtr(d, "EAL", "ADM"),
        ),
        (
            "KMB",
            "https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/3007D34FB91FB27E",
            lambda d: bus(d, "KMB"),
        ),
    ]:
        d, r = fetch(f"observation-{name}-{i}.json", url)
        if d:
            p = parser(d)
            r.update(
                business_state=p["state"],
                source_time=p.get("source_time"),
                prediction_count=len(p.get("predictions", [])),
            )
        records.append(r)
        print(name, i, r.get("business_state", r["status"]), flush=True)
    if i < 2:
        time.sleep(60)
(ROOT / "docs/continuous-observation.json").write_text(
    json.dumps(
        {
            "scope": "Three bounded observations ~60 seconds apart; not stability acceptance",
            "records": records,
        },
        indent=2,
    )
)
