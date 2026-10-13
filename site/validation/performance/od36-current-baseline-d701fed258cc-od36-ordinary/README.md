# OD36 ordinary: current-runtime attribution

## Scope and result

One serial cloud-only run of the actual S1 entry and actual production Worker code from immutable runtime `d701fed258cc`. OD36 endpoints, ordinary need, 08:00 Hong Kong time on 2026-10-12, mode constraints, 60-second observation and 384 MiB Worker old-generation cap are unchanged. CPU sampling is disabled. DOM stand-ins measure JavaScript work, not browser layout/paint. No production code was changed by this probe.

- Observation ended with detailed public/taxi comparison pending, not `NO_ROUTE`.
- `public-fast`: 12.302 s from the restarted generation's stage start, status `needs-indoor-refinement`.
- `demo-public-fast`: 23.738 s including queue wait; modeled candidate available.
- Eight Workers; peak RSS 1.260 GiB. This is one noisy measurement, not p95 or a stable speed comparison.
- Returned candidates are unchanged: direct taxi 31 min / HK$140.25; modeled public 151 min / HK$16.56. Both preserve endpoints and have no known forbidden edges in the returned routes. Pending candidates have not been validated.

## What consumes time

The following spans overlap. Do not sum parent and child durations.

| Measured span | Completed count | Total |
|---|---:|---:|
| Main-thread Worker postMessage structured-clone send | 8 | 7.661 s |
| App-transit graph preparation | 33 | 14.147 s |
| App-transit scheduled search `Dt` | 5 | 22.736 s |
| Nested app-transit walk query `ft` | 1,533 | 14.800 s |
| Time-semantics preparation inside `ft` | 1,524 | 0.799 s |

Graph preparation includes validation. Of the 22.736 s of scheduled search, 14.800 s is nested `ft`, 6.756 s is nested regional graph preparation, and only 1.180 s is the remaining scheduled-search work. The 6.756 s is already included in the 14.147 s graph-prepare total.

The last Worker is still preparing the 62,479-node / 138,703-edge detailed graph at the cutoff. Its unfinished preparation is excluded from completed-span totals. App-walk `rt` has zero calls in this window. The separate metro Worker is timed at its message boundary but its embedded walk engine is not instrumented here.

## A disproved assumption for this window

All 1,524 `ft` searches reaching the main search loop are `timed=false`, `hkFifoWaiting=true`. Their graphs contain zero time-rule edges under the production `be/Ge` predicates. The other nine `ft` calls return before the instrumented loop. Exact ancestor-scan calls and hops are zero for these app-transit searches. Therefore moving the unused FIFO ancestry scan cannot improve these executed `ft` loops. This does not characterize an unexecuted detailed search or the uninstrumented metro engine.

The time-semantics preparation scans take 0.799 s total. They are measurable but much smaller than initialization and actual path calculations. A time-rule count is computed once per graph only for attribution, outside the measured preparation segment.

No OD7-style timed Pareto-label growth is observed here:

- Largest `ft` query: 24,916 retained/active state records, 24,915 predecessor records, no invalidated labels.
- Maximum `ft` queue peak: 151. These are ordinary single-state relaxations, not 24,916 live Pareto alternatives for one node.
- Across all completed search loops, accepted heap pushes total 1,273,190 and retained state records total 1,236,121. These sums are work across sequential queries, not simultaneous live memory.
- Largest scheduled search: 1,709 accepted/retained labels; 1,524 active labels; queue peak 300. Overall scheduled queue peak is 303.

The raw `acceptedLabels` field in the initial event stream is the timed-label counter plus one and is not meaningful for non-timed searches. `hotspots.json` corrects this without changing the raw evidence: accepted pushes are exactly `expanded + queue`, since every accepted relaxation pushes once and every expansion counter increment follows a pop. Active labels include settled but non-invalidated records; they are not the open queue size.

## Worker/owner sequence

Times below are seconds after the actual click, before the automatic restart. Graph source-role assignments are cross-checked against frozen production source; version/count equality is not treated as semantic equality.

| Worker | Owner | Create → termination request | Role and reason |
|---|---:|---:|---|
| 1 | 1 | 0.371 → 4.383 | Official fast public. Canceled by block-loaded `u1(); S1();` before a result. |
| 2 | 1 | 5.389 → 16.698 | Official fast public with the same area/station inputs. Finished; released before taxi. |
| 3 | 3 | 16.706 → 22.479 | Official taxi public subquery to ADM:E2. Released on switch to metro owner. |
| 4 | 4 | 22.480 → 28.608 | Detailed merged metro graph. Finished; idle Worker released before next taxi query. Physical exit 29.329. |
| 5 | 3 | 28.612 → 34.995 | Official taxi public subquery to EXC:B3. Returned `NO_ROUTE`; released before demo owner. |
| 6 | 5 | 37.533 → 53.086 | Isolated guarded-demo graph with `demo_connector_geography` and barriers. Finished modeled route; disposed in guarded-demo cleanup. |
| 7 | 3 | 53.087 → 56.261 | Official taxi tram subquery to td:99139. Returned `NO_ROUTE`; released for detailed public. |
| 8 | 4 | 56.262 → 60.113 | Official detailed public, still preparing when observation ends. Terminated only by probe cleanup. |

Owner 2 belongs to the first generation's taxi work; it enqueues but never starts before that generation is canceled.

Official base inputs shared by Workers 1/2/3/5/7:

- Area object gid 2: version `814b03c9c2d7e3c5`, 61,055 nodes / 135,514 edges, ADM+AUS.
- Station object gid 1: version `b1e24d8ef9214320`, 5,405 nodes / 11,387 edges, ADM+AUS+HUH+EXC+ETS+KOW.

Worker 6 uses a different area object gid 6, with identical version/node/edge metadata but added demo geography/barriers. It must remain isolated from the official owners. Worker 4 receives merged graph gid 5, version `b1e24d8ef9214320`, 65,304 nodes / 144,603 edges. Worker 8 additionally receives detailed gid 4, version `814b03c9c2d7e3c5+block:19aebcac62f227eb:pacific-f-anchor-v1`, 62,479 nodes / 138,703 edges.

## Automatic block-loaded replan

At click+4.383 s, `loadBlockData` cancels and restarts S1. The first Worker has already spent 0.880 s on clone-send and 0.851 s in completed graph preparation, plus an unfinished preparation whose duration cannot be recovered from completed spans. Its first request never returns. The initial official block merge `g2` takes 1.001 s, but that merge is required work and is cached; subsequent same-object official merges are effectively free. The demo graph requires its own 1.174 s merge.

This identifies avoidable canceled work. It does not establish a 4.383 s speedup: block loading and other work overlap, the early direct taxi can publish before replan, and delaying all planning until block-ready could delay that first result. Any cold/warm experiment must include preload time in its stated user-visible baseline.

## Different-departure subqueries

There are zero exact same-Worker/full-recorded-request duplicate starts. There are 135 same-Worker spatial keys overall. Within these, 76 keys repeat at different departures, totaling 1,474 completed calls / 6.800 s. The largest full-area walk queries are often single calls per Worker; duplicated initialization across owners is a separate cost.

A bounded batch/one-to-many investigation may be worthwhile, but no semantic cache is implemented or validated. Different departure times remain legitimate requests. Reuse requires proving equivalence of exact graph identity/source role, endpoints and node IDs, mode, preference, date, waiting/opening rules, exclusions, route evidence and tie order. Official and demo graphs cannot be merged because their metadata matches. Prior `shared-base` evidence is not a substitute for such proof.

## Files and reproduction

- `report.json`: stage, memory, candidates and input evidence.
- `hotspots.json`: normalized counters and nested-span attribution.
- `lifecycle.json`: exact Worker/owner chronology, requests and graph metadata.
- `departure-groups.json`: bounded potential repeated-departure grouping.
- `snapshot-manifest.json`: 113 files / 58,427,651 bytes; manifest SHA256 `be79a7f1fa2091c76d0504deeae174eb3eb3db9fb1f688072df68cc8a3ecdec0`.
- Ignored local evidence: `events.ndjson`, `instrumented/`, and one real-copy `runtime-d701fed258cc/`. No mutable hard links.

```sh
HK_PROFILE_RUNTIME=d701fed258cc HK_PROFILE_LABEL=od36-current-baseline node tests/navigation/profile-od36-current.mjs
node tests/navigation/profile-od36-summarize.mjs validation/performance/od36-current-baseline-d701fed258cc-od36-ordinary
```

The runner refuses to overwrite an existing report directory. Use a fresh label for a deliberate repeat. The copied-only `fifo-guard` variant remains available for later explicitly coordinated experiments, but no candidate run was made after the baseline disproved its relevance to the executed app-transit searches. This run is an attribution baseline, not a production fix or a complete performance acceptance.
