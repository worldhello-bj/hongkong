import sys, json, time, statistics, platform, copy
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from routing.engine import route, RoutingError

ROOT = Path(__file__).resolve().parents[1]
m = json.loads((ROOT / "data/normalized/model.json").read_text())
ids = [n["id"] for n in m["nodes"] if n["venue_id"] in ["ADM", "AUS", "KOW"]]
pairs = []
for a in ids:
    for b in ids:
        if a == b:
            continue
        try:
            route(m, a, b, "2026-10-09T11:00:00+08:00")
        except RoutingError:
            continue
        pairs.append((a, b))
        if len(pairs) == 60:
            break
    if len(pairs) == 60:
        break
results = []
scenarios = [
    ("ordinary", {}),
    ("few_stairs", {"preference": "few_stairs"}),
    ("accessible", {"preference": "accessible"}),
    ("lift_closed", {"closed_facilities": ["ADM:entrance-lift"]}),
    ("slow_walk", {"walk_speed": 0.8}),
    ("strict_evidence", {"allow_provisional": False}),
]
for a, b in pairs:
    for name, kw in scenarios:
        t = time.perf_counter()
        try:
            r = route(m, a, b, "2026-10-09T11:00:00+08:00", **kw)
            status = r["status"]
            count = len(r["legs"])
        except RoutingError as e:
            status = e.code
            count = 0
        results.append(
            {
                "from_id": a,
                "to_id": b,
                "scenario": name,
                "status": status,
                "legs": count,
                "elapsed_ms": (time.perf_counter() - t) * 1000,
            }
        )
lat = sorted(x["elapsed_ms"] for x in results)
report = {
    "kind": "SYNTHETIC_ALGORITHM_REGRESSION_NOT_HUMAN_AUDITED_OD",
    "python": platform.python_version(),
    "model_version": m["version"],
    "od_count": len(pairs),
    "cases": len(results),
    "p95_ms": lat[int(0.95 * (len(lat) - 1))],
    "max_ms": max(lat),
    "measurement": "In-process routing only; no network, no rendering, no empirical travel-time validation",
    "results": results,
}
(ROOT / "docs/benchmark.json").write_text(json.dumps(report, indent=2))
print({k: v for k, v in report.items() if k != "results"})
