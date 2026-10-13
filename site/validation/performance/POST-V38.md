# Post-v38 performance and point validation

Status updated 2026-10-12. The public deployment remains v38 / runtime `d701fed258cc` until a later deployment is explicitly recorded. A local build or a saved probe does not establish publication.

## Candidate and measurement provenance

The completed 60-cell point campaign uses `b702b6920092` (built 2026-10-12 16:45:42 UTC). All cells reached a genuine terminal comparison: 48 produced audited complete candidates; 12 found no complete route under strict evidence/facility policy. There were no pending observations, Worker errors or OOM events in this campaign. Its 84 complete candidates contain 292 audited fare segments. First-result median/P95/max were 7.951/28.308/33.005 seconds; complete-comparison median/P95/max were 20.219/48.966/59.783 seconds. These are 60 individual prescribed scenarios, not a population latency guarantee. [Full point report](../point-matrix/b702b6920092-f32dfcc1a1ba/REPORT.md).

The later `9e104c614b66` build adds finite/consistent exact-endpoint validation and a named-floor demo verifier precheck. Small-graph review then found a separate cross-request walk-cache clock bug. Candidate `2e2fcf795897` (built 17:31:44 UTC) repairs that key in both production routers; ten targeted cache tests pass. Its 14-cell supplement is complete: all retained candidate/request/negative fields match b702, all new route assertions pass, ten cells have complete candidates and four preserve strict-policy negative results. All 48 Workers exited. The ten Pacific Place cells improve full-comparison median from 31.372 to 15.826 seconds; first-result median from 28.032 to 12.890 seconds. These are matched individual observations, not p95 guarantees. [Supplement report](../point-matrix/2e2fcf795897-58a530dacc14/REPORT.md). Publication has not occurred.

The `9e` aggregate ran 252 tests: 251 passed and one old area-only coverage assertion failed. The requested HUH lift's exact 13.8 m height does not match its area projection, but matches the station source. Production already checks the loaded source union. The integration assertion now calls that exact production coverage helper and separately checks that a fabricated 999 m height is rejected; both integration tests pass. The final `2e2fcf795897` aggregate subsequently passes **263/263**, zero failures/cancellations/skips, in 294.982 seconds; its [raw test output](aggregate-2e2fcf795897.txt) and [machine summary](aggregate-2e2fcf795897.json) are retained. Exact-commit remote CI remains to be checked after upload. The earlier `db91a771e5fb` aggregate's strict-startup failure and its stronger negative-result test remain documented in prior logs; they are not counted as a passing final run.

## Final-candidate OD36 observation: `2e2fcf795897`

The same 120-second scalar probe was repeated after the clock-key correctness repair. It exits normally after the explicit observation-boundary cancellation; all five Workers exit, with no Worker error. Detailed comparison is still **pending**, and all four usable candidates match both this run's 60-second checkpoint and the earlier `9e` 120-second candidate fields. This is not an end-to-end completed result.

First result is 2.094 seconds; public phase 9.885 seconds; taxi comparison 22.653 seconds. RSS at 120 seconds is about 1.214 GiB, sampled peak 1.274 GiB. Completed timed walks number 7,781; time preparation is 0.094 seconds. Lower bounds have 37 core builds, 7,745 hits and one base build; one additional bound has finished while its enclosing walk has not. The last progress event retains 28,378 labels / 27,565 active, with 311 generated goals and the first at scheduled-search +2.786 seconds. The same 11:00 opening boundary and pre-boundary clock proliferation remain.

The correctness repair has a measured performance tradeoff that is not hidden: early Worker 2 walking queries increase from 1,613 to 1,681; cumulative walking-query time is 7.391 versus 15.159 seconds, and its eight scheduled searches total 8.750 versus 16.350 seconds. The extra 68 calls are observed; a single run does not identify how much of the wall-time difference is causal rather than run-to-run variation. Reusing an open-time route after closure is not an acceptable speed optimization. [Final-candidate probe and paired counters](od36-current-clock120-2e2fcf795897-od36-ordinary/README.md).

## Prior bounded OD36 observation: `9e104c614b66`

The single new 120-second observation ended normally, after cancelling only at the explicit test boundary and waiting for all five Workers to exit. No Worker error was recorded. Detailed comparison remains **pending**, with four usable candidates identical to the earlier `cfc` 120-second report. First result is 1.601 seconds; initial public phase 7.482 seconds; taxi comparison 14.394 seconds. At 120 seconds RSS is about 1.091 GiB and sampled peak 1.267 GiB. The probe's 384 MiB Worker old-generation setting is an observation setting, not a new application routing cap.

The prepared-time dead scan is removed: 7,658 completed timed walks spend 0.136 seconds in time preparation, 27.728 seconds in search loops and 4.663 seconds in lower-bound preparation. Destination cores build 37 times and hit 7,621 times, with one base build and no fallback. The 81.310-second scheduled-search span **contains** 75.640 seconds of direct walking resolution; timed-inner-walk measurements are nested again. These numbers must not be added as independent end-to-end costs.

The new bounded scalar evidence establishes an early goal at scheduled-search +3.709 seconds. The last progress event has 27,694 retained / 26,893 active labels and 301 generated goals. A preceding top-node sample has AUS D1 1,048 retained labels in 1,028 exact-clock buckets, D2 947/947 and D3 900/900. The actual global opening boundary is 39,600 seconds (11:00), triggered by ADM lift physical ID 250017626; the request departs at 08:00. Dynamic walking legs do not carry geometry. This supports further investigation of repeated time-sensitive walking queries, not the unadopted geometry-sharing hypothesis or unsafe early-arrival dominance.

The instrumentation now flushes bounded logs incrementally. It differs from earlier large-buffer probes; these individual observations do not establish a clean statistical speed ratio. [120-second evidence](od36-current-final120-9e104c614b66-od36-ordinary/README.md) includes the exact 60-second boundary separately from later live updates.

## Earlier 600-second OD36 observation: `cfc54d2d0718`

The same fixed-seed OD36 uses the original coordinates, ordinary preference, departure/date, actual production S1 entry and Worker bundles. The Node DOM stand-in is not a browser rendering benchmark or a measurement of a real Hong Kong journey.

| Observation | Live-v38 baseline | Owner-group + memory retention (`34c1eabb21cf`) | Destination-core reuse (`cfc54d2d0718`) |
|---|---:|---:|---:|
| Initial public phase | 12.302 s | 8.024 s | 7.721 s |
| Taxi comparison | pending at 60 s | 14.912 s | 14.726 s |
| Workers created | 8 | 5 | 5 |
| Detailed comparison | pending at 60 s | pending at 600 s | pending at 600 s |
| Worker error in observed run | none recorded | none recorded | none recorded |

These are individual runs, not p95 or an uncontended repeated A/B. The `34c` run overlapped a separate short task until 15:33:40 UTC; see its execution-context record. Initial phase timings must not be treated as a clean causal speed ratio.

### What was actually fixed

- Base public and dependent taxi queries share a frozen graph owner before another owner starts. Every original detailed/indoor/walking refinement remains; cancellation prevents stale later phases.
- Immutable timing metadata is prepared once per graph/preference. Date, departure and endpoint rules remain per request.
- Lower bounds retain exact Float64 values, missing entries and synthetic IDs. For checked overlay topology, origin-only nodes are reverse-graph leaves, so a destination core is reusable. Unexpected topology follows the original exact-key algorithm. No heuristic approximation, removed facility restriction, deadline or search-state cap is used.
- Paired resolver/evidence memos are bounded and evicted atomically; missing dynamic evidence is recomputed at its original full-precision departure. Source nodes/edges remain, while isolated synthetic indoor portal objects are omitted. Duplicate connection IDs retain the original alias semantics rather than being unsafely replayed.

The completed `34c` 600-second trace had 116 exact OD keys and 2,185 lower-bound misses, of which 2,069 were repeat builds. About 446 seconds went into lower-bound preparation. In the durable `cfc` trace through process time 595.118 seconds, 52,366 helper calls produce **37 core builds, 52,329 core hits, one base reverse build, and zero fallback calls**. Base construction takes 0.125 seconds, core Dijkstra 2.499 seconds, compaction 0.289 seconds and origin-leaf reconstruction 1.149 seconds. This removes the measured repeated-Dijkstra hotspot.

### What is still not complete

OD36 still has no complete detailed comparison at 600 seconds. The later trace retains 120,704 labels, with 119,324 active and 66,432 queued. Its last reported Worker heap is approximately 370 MiB under the probe's 384 MiB old-generation limit. This is not a finished performance fix.

After lower-bound reuse, completed timed walk queries take 289.896 seconds: 153.946 seconds in their search loops, 87.231 seconds in temporal preparation, 13.838 seconds in lower-bound preparation and 34.880 seconds elsewhere. The scheduled-search residual is 75.230 seconds. Nearly all subqueries succeed; static disconnection is **not** the explanation for this OD's remaining work. Exact time-sensitive labels before the last opening event still expand heavily.

The `cfc` probe actively terminated W5 at its agreed 600-second observation boundary; its lifecycle records the resulting Worker exit and no Worker-error event. The parent probe then exited with SIGKILL/137 while handling very large logs. A serialization-memory problem is suspected, but the operating-system kill cause is not established. Do not relabel this as a normal end-to-end success or a production Worker OOM. The probe has since been changed to bounded incremental log buffers rather than retaining and joining the whole event history.

### Correctness checks

Destination reuse has 2,000 randomized exact-distance comparisons and 2,724 paired full-engine queries, including opening/closing rules, dates, forbidden waiting, multiple endpoint forms, modes, vertical facilities, collisions with reserved synthetic IDs, missing/NaN/infinite values, signed zero, owner isolation and eviction. A separate route-memory oracle compares 1,728 station queries, 96 raw walking results and 288 complete intermodal queries with forced evidence eviction/replay. Reports and test sources are retained; a small-graph oracle is not a full-city runtime result.

Local runtime `db91a771e5fb` adds exact pre-opening time buckets (same accepted/inactive labels, pop order and resolver calls), and skips an opening-boundary scan only when the original FIFO code immediately discarded its result. Forty focused tests passed after this combined build. The bucket index still retains every label and adds per-clock index overhead; neither optimization establishes that OD36 completes. The proven-static-disconnection early return is not adopted and has no material benefit supported by the OD36 trace. A generated-goal bound remains a separately reviewed candidate, not deployed code.

## Actual source-point failures found and repaired

1. A direct taxi quote for exact elevated exit nodes kept XY while dropping Z/source-node evidence. The new result preserves original XYZ and marks unverified source-node/floor-to-curb access incomplete. Its fare scenario can remain visible, but it cannot be counted as a complete route or start a simulated taxi reservation. A genuinely source-backed public prefix/suffix can still provide the corresponding endpoint access.
2. KMB 8's source stops and official road-centreline vertices differ by 9.033 m at boarding and 6.178 m at alighting. Ride assembly previously omitted these differences, leaving gaps. The repaired bus/tram display keeps the exact source stops and the original 137-point shape, records the end associations as unverified schematic vehicle projections, and keeps the 692-second service timing unchanged. It creates no walking/vertical/accessibility connection. Worker, fallback, GeoJSON and final guidance boundaries agree. The original failed observation remains in the `34c` point directory.
3. The 19th cell found a real strict endpoint error: fallback removed the HUH B2 lift source node/height, then used a 30.7402 m schematic line to present the original point as reached. Fallback now preserves exact node/floor/XYZ and the original strict preference. Its final validator requires source-edge endpoint incidence and source eligibility; an unknown connector is not a complete strict route. The first 18 passing cells do not erase this retained failing observation.
4. Follow-up source analysis found that overlapping acquisition regions caused a real HUH endpoint to be assigned to AUS by geographic first-match; the exact HUH portal was then discarded. The source HUH lift belongs to a strict 731-node connected component and reaches the EAL/TML platform nodes. A separate exact-source-region fix gives graph node identity precedence, with missing/conflicting IDs failing closed and unchanged map-point selection. The initial exact-region fix also exposed area-only early coverage gates in S1 and both actual intermodal owners; these now consult their already loaded station/block source identities before rejecting coverage. Unknown IDs still fail closed, and individual walk routers still require their real nodes and source paths. The ordinary ADM E2 → HUH B2 lift case retests with first/full comparison 5.717/7.978 seconds (taxi off), with exact endpoint, continuity and fare assertions passing. This does not certify unverified train boarding or a complete strict cross-harbour itinerary.
5. Background search errors now retain usable earlier results while marking the comparison incomplete. They are not converted to NO_ROUTE or a completed-success toast.
6. A separate 512-entry cross-request walking cache omitted departure/date whenever the origin area's edges had no schedule. That did not account for schedules on the original endpoints. Both real routers reproduced a route after a destination's closing time when warmed by an earlier open-time query, and reused a Monday-only route on Tuesday. The corrected key always includes full departure and date alongside the original full endpoint objects and preference. Capacity, source restrictions and route algorithms are unchanged. Cold/warm results now deep-equal across the reproduced daily/weekly cases; same-clock changed schedules were already distinguished and remain so. See [the focused cache review](walk-cache-clock-review.md).

Current point results and totals belong in [the matrix report](../point-matrix/README.md), not in an extrapolation from OD36. The 60-cell matrix uses six identified source/land ODs, five preferences and both taxi settings. Price sensitivity reranks only observed, complete, structurally passing candidates using the matching runtime; unavailable floor/curb scenarios are excluded. No feeder reward is added to manufacture a winner.

## One bounded taxi-anchor counterfactual

Final runtime `2e2fcf795897`, seeded OD7, ordinary preference, 2026-10-12 11:00 HK: the baseline and one additional eligible real last-mile tram stop (`td:99133`) both finish, in 24.971 and 25.379 seconds. All six shared candidates retain identical metrics, all route audits pass, and all four Workers exit. The extra candidate raises the count from six to seven. Its actual taxi leg is 2,340 m versus a 6,307 m direct taxi route (37.10%), so it passes the existing 95% guard.

The extra route is 67 model-minutes / HK$34.72 / 47 walking minutes, versus the existing tram anchor's 60 / HK$41.28 / 47: HK$6.56 cheaper but seven minutes slower, without less walking. It dominates an existing ADM E2 feeder (73 / HK$37.45 / 52) but does not change the overall winner at price weights 0.25, 0.75 or 2. This demonstrates a shortlist omission, not the requested substantial walking improvement or a justification for artificial feeder rewards. Production shortlist selection is unchanged. The dominant 46-minute walk is already in the public prefix. [Complete controlled result](taxi-shortlist-2e2fcf795897-od7-1100/results.md).

## Evidence and recovery

- `od36-current-route-memory-exclusive-34c1eabb21cf-od36-ordinary/`
- `od36-current-destination-core-cfc54d2d0718-od36-ordinary/`
- `destination-lower-bounds-review.md`
- `log-compression-20261012.json`: completed inactive raw logs were losslessly compressed; decompressed SHA-256 was verified before removing original raw bytes. Reproduction sources, small reports and unique results remain. Active runtime/data files were not removed.

Fares, vehicle supply, waits and service timing remain explicitly modeled; a model-estimated minute or price is not a measured journey or official live quotation. Government source geometry does not prove current opening, curb access or lift operation.
