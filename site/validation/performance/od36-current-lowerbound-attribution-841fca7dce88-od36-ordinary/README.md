# OD36: reverse lower-bound cache attribution

## Directly measured finding

A single additional diagnostic run against the **unchanged grouped-owner runtime 841fca7dce88** confirms the unallocated preparation cost. No production algorithm, cache policy/key/capacity, queue order or request changed. The probe adds an optional timer around the existing reverse lower-bound construction and records exact existing cache activity.

For W5's detailed ADM graph, 27,512 nodes / 60,514 edges:

| Measurement | Result |
|---|---:|
| Completed timed `ft` queries | 47 |
| Reverse-bound cache lookups | 47 |
| Hits / misses | 0 / 47 |
| Distinct original cache keys | 27 |
| Actual evictions | 39 |
| Maximum retained cache entries | 8 |
| Maximum entries in one lower-bound Map | 26,731 |
| Reverse-bound construction | **11.493 s** |
| Entire 47-query `ft` time | 14.005 s |
| Time-semantics preparation | 1.495 s |
| Main search loops | 0.403 s |
| Other unallocated time | 0.613 s |

Thus the directly measured reverse-bound construction represents about 82% of these completed timed-query spans. It is not an inference from memory, CPU sampling or label counts. The original cap of eight entries evicts keys which are later needed at other departure times.

One example is the exact existing cache key from ADM:N:423d9c94cd1e0b to [114.16438,22.2784], mode walk. It is built at departures 32092.42662 and 32452.42662, with zero hits and 0.880 s construction total. No key canonicalization or result sharing was implemented.

## Overall run status

- Public-fast: 8.280 s, still requires refinement.
- Taxi comparison: 14.445 s, ready.
- Five Workers; same four candidate results and endpoint/known-forbidden-edge checks as the previous grouped-owner run.
- Peak RSS: 1.356 GiB. This differs from the previous 1.228 GiB sample, so a stable memory-reduction claim is not supported.
- At 60 seconds, detailed official transit is still pending inside a subsequent walk query. Pure-walk refinement has not started. The observation cutoff is not `NO_ROUTE`.

The measurement completed fewer detailed queries than the previous run (47 versus 77), under host/GC/timing variation. Compare per-span attribution and cache behavior, not aggregate totals as a speed test. This run is diagnostic and does not change the previous result that grouping finishes taxi comparisons.

## Evidence and controls

`HK_PROFILE_LOWERBOUND=1` records every original lower-bound key, hit/miss, actual evicted key, current cache size, lower-bound Map size and construction wall-time in the ignored raw `events.ndjson`. `hotspots.json` aggregates those records by Worker/graph and exact key. `partition.json` splits only completed timed queries, avoiding a misleading mix of partial queries and completed spans.

Same OD36 fixture, ordinary need, 08:00 Hong Kong time on 2026-10-12, actual S1 entry, original 60-second observation, 384 MiB Worker old-generation cap and disabled CPU sampling. The existing immutable `runtime-841fca7dce88` snapshot is reused; no additional graph-data copy was created. DOM stand-in limitations remain.

```sh
HK_PROFILE_RUNTIME=841fca7dce88 HK_PROFILE_LABEL=od36-current-lowerbound-attribution HK_PROFILE_LOWERBOUND=1 node tests/navigation/profile-od36-current.mjs
node tests/navigation/profile-od36-summarize.mjs validation/performance/od36-current-lowerbound-attribution-841fca7dce88-od36-ordinary
```

The runner refuses to overwrite prior evidence. No further query was launched after this result.
