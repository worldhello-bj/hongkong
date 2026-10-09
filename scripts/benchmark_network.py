"""Actual-source graph software experiment. Synthetic OD, no site audit or travel-time truth."""

import sys, json, time, random
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from adapters.network import load_graph, route_graph

ROOT = Path(__file__).resolve().parents[1]
results = []
rng = random.Random(20261009)
for region in ["ADM", "HUB"]:
    g = load_graph(region)
    nodes = g["nodes"]
    pairs = []
    # Source edge endpoints yield reproducible valid physical OD without invented POI mappings.
    candidates = [
        e for e in g["edges"] if e["length_m"] > 5 and not e["access_time_id"]
    ]
    rng.shuffle(candidates)
    for e in candidates[:60]:
        for name, pref, speed, closed in [
            ("ordinary", "fast", 1.2, []),
            ("stairs", "few_stairs", 1.2, []),
            ("accessible", "accessible", 1.2, []),
            ("closed", "fast", 1.2, [e["id"]]),
            ("slow", "fast", 0.8, []),
            ("fast", "fast", 1.5, []),
        ]:
            t = time.perf_counter()
            r = route_graph(g, e["from_id"], e["to_id"], pref, closed, speed)
            results.append(
                dict(
                    region=region,
                    from_node=e["from_id"],
                    to_node=e["to_id"],
                    scenario=name,
                    status=r["status"],
                    distance_m=r.get("distance_m"),
                    elapsed_ms=(time.perf_counter() - t) * 1000,
                )
            )
lat = sorted(x["elapsed_ms"] for x in results)
out = {
    "kind": "ACTUAL_SOURCE_GRAPH_SYNTHETIC_OD_NOT_FIELD_AUDIT",
    "od_count": 120,
    "cases": len(results),
    "p95_ms": lat[int(0.95 * (len(lat) - 1))],
    "max_ms": max(lat),
    "results": results,
}
(ROOT / "docs/network-benchmark.json").write_text(json.dumps(out, indent=2))
print({k: v for k, v in out.items() if k != "results"})
