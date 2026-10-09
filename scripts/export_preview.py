"""Rebuild an explicitly recorded, read-only preview from real local snapshots.
No server planning endpoint or LIVE label is fabricated by this exporter.
"""

import sys, json, gzip
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.main import (
    bootstrap,
    sources,
    bus_services,
    envelope,
    network,
    network_geometry,
    network_route,
    NetworkRoute,
    plan,
    Plan,
)
from adapters.realtime import mtr
from app.timeutil import parse

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "web/public/preview"
OUT.mkdir(parents=True, exist_ok=True)


def write(name, data):
    (OUT / name).write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))


def main():
    b = bootstrap()
    b["data_state"] = "REPLAY"
    b["result"].update(
        preview_only=True,
        preview_notice="Recorded research preview. No live requests or route planning.",
    )
    write("bootstrap.json", b)
    write("sources.json", sources())
    write("bus-services.json", bus_services())
    for sta, line in [
        ("ADM", "EAL"),
        ("ADM", "TWL"),
        ("ADM", "ISL"),
        ("ADM", "SIL"),
        ("AUS", "TML"),
        ("KOW", "TCL"),
        ("KOW", "AEL"),
    ]:
        p = ROOT / "data/raw" / f"mtr-{line}-{sta}.json"
        if not p.exists():
            continue
        d = json.loads(p.read_text())
        r = mtr(d, line, sta, parse(d["curr_time"]))
        r.update(
            original_state=r["state"],
            state="REPLAY",
            sample_date=d["curr_time"],
            source_url=f"https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line={line}&sta={sta}",
        )
        write(
            f"mtr-{sta.lower()}-{line.lower()}.json",
            envelope(r, "REPLAY", as_of=r["source_time"]),
        )
    for v in ["ADM", "AUS", "KOW"]:
        for label, layer in [
            ("levels", "mtr_level_polygon"),
            ("units", "mtr_unit_polygon"),
        ]:
            p = ROOT / "data/official" / f"{v}-{layer}.json.gz"
            d = json.loads(gzip.decompress(p.read_bytes()))
            write(f"geometry-{v}-{label}.json", d)
    for region in ["ADM", "HUB"]:
        write(f"network-{region}.json", network(region))
        write(f"network-{region}-geometry.json", network_geometry(region))
    for v in json.loads((ROOT / "docs/network-routing-report.json").read_text()):
        s = max(v["sample_routes"], key=lambda r: r["distance_m"])
        r = network_route(
            v["region"], NetworkRoute(from_node=s["from_node"], to_node=s["to_node"])
        )
        r["data_state"] = "REPLAY"
        r["result"]["recorded_example"] = True
        write(f"network-{v['region']}-example.json", r)
    r = plan(
        Plan(
            from_id="ADM:entry",
            to_id="ADM:P7",
            departure_at="2026-10-09T21:00:00+08:00",
            mode="SIMULATED",
        )
    )
    r["result"].update(
        recorded_example=True,
        preview_notice="Read-only computed research example, not a live route",
    )
    write("journey-example.json", r)
    print("Recorded preview exported:", OUT)


if __name__ == "__main__":
    main()
