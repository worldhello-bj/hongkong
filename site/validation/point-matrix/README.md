# Hong Kong stratified point matrix

## Status

Latest targeted supplement: **2e2fcf795897**, content signature **58a530dacc14c45c5e58342db8aa4ed9337136ab77a68e960a9079cda499c099**. On 2026-10-12, **14/14 selected cells reached genuine complete comparison states, retained-data comparisons matched b702 and new route audits passed**: 10 cells returned complete candidates and four strict cells retained the same evidence-policy negatives. There were no pending observations or Worker/background errors. All 48 Workers exited; all 14 endpoint/cancellation checks passed. These are 14 later-runtime observations, not a relabeled 60-cell run. See [supplement report and per-cell before/after timings](2e2fcf795897-58a530dacc14/REPORT.md) and [machine-readable summary](2e2fcf795897-58a530dacc14/supplement-summary.json).

Across Pacific Place's ten supplement cells, full-comparison median fell from **31.372s to 15.826s**; first-result median across its eight available cells fell from **28.032s to 12.890s**. Every retained candidate, unavailable choice and fare scenario stayed equal, and the nine JSON/gzip source-data hashes match. These are single-run observations, not a stable latency guarantee; older raw journey geometry was not retained for a byte-equality claim.

Completed full-matrix runtime: **b702b6920092**, content signature **f32dfcc1a1ba60f3987b03f198560960bd23364aeb86d8600395d1ea86313fc3**. On 2026-10-12 the fixed **60/60 cells reached genuine complete comparison states**: **48 cells returned 84 complete, audited candidates; 12 strict-accessibility cells returned no complete candidate under recorded source/mode-evidence constraints**. There were **0 pending observations, 0 routing/Worker/OOM errors, and 0 invariant failures** on this runtime. All request identities and cancellation checks passed; 292 production fare legs were audited.

First available result (48 cells): median **7.951s**, P95 **28.308s**, max **33.005s**. Full comparison (60 cells): median **20.219s**, P95 **48.966s**, max **59.783s**. These are single-observation server-side timings, not a stable latency guarantee. See [complete report, cell table, fare breakdowns and weight changes](b702b6920092-f32dfcc1a1ba/REPORT.md), [matrix summary](b702b6920092-f32dfcc1a1ba/matrix-summary.json), and [all five price weights and candidate fare legs](b702b6920092-f32dfcc1a1ba/price-sensitivity.json).

The separate same-runtime source-floor layer also completed 100 cells with all assertions passing: 63 source routes, 37 unavailable outcomes. Those are not additional full-S1 matrix cells. Point assertion/supplement unit tests: 24/24 passed.

A superseded build **9e104c614b66** was frozen for the supplement, but **no supplement cells ran on 9e**. At 17:27 UTC the production investigation reproduced warm/cold disagreement in the cross-route walking cache: its time key omitted endpoint access schedules. The subsequent 2e2 correction retains the exact clock/date key, and the 14-cell supplement above ran only after that build. The b702 60-cell and 2e2 14-cell results are genuine records of fresh-process observations; neither establishes warm-cache equivalence. That behavior is covered by separate production regressions, not this point matrix.

Current reports carry `auditProvenance.version = point-strict-source-v2`, hashes of the harness, auditor, fixture code and source-eligibility binding, plus the exact built strict-predicate module hash. This version checks the full source eligibility predicate and requires evidence that S1 actually started. A pre-planning return has no full-comparison timing.

This directory is independent of the historical 30-case preference matrix and performance reports. Runtime outputs go under `<version>-<content-signature>/`. Frozen routing snapshots are gitignored; the reusable freeze helper copies JS independently and can hardlink identical data from an existing immutable snapshot, never from active `dist/`.

## Historical 8e5a3cbed130 preflight

On runtime 8e5a3cbed130, two ordinary Stage A cells ran before a taxi XYZ/source-node evidence gap stopped that version. The other 58 cells were not observed **on 8e**. See `8e5a3cbed130-9f9b7d1fccb7/DIAGNOSIS.md`. The separate 100-cell Pacific Place source-only layer yielded 63 source routes and 37 unavailable outcomes with passing clock-aware assertions, then was reproduced on cfc. The earlier static precheck used 10e14b8593db with unchanged source data.

## Historical 34c1eabb21cf preflight

The frozen 34c runtime completed the first two ordinary cells with all recorded assertions passing: taxi off first/full 10.794/13.289 seconds, taxi on 12.254/22.834 seconds. The formerly available direct taxi scenario is now correctly unavailable with UNVERIFIED_ENDPOINT_ACCESS, preserving both original source nodes and its HK$78.80 fee estimate. No physical curb connection is claimed to have been added.

The third cell (bus-stop→tram-stop, taxi off) stopped the stage: first/full 6.259/8.535 seconds, one complete candidate but 9.033m source-stop-to-bus-shape origin displacement and 6.178m bus-shape-to-stop internal gap. Original observations are retained. Read-only evidence is in `34c1eabb21cf-b0d33be9a541/stop-projection-evidence.json`. Both gaps are local service-road projection associations, not missing cross-harbour pedestrian routes. The remaining three Stage A cells and all Stage B/preference expansion are not run on 34c.

The 2D internal road-snap coordinate was also overly constrained by the initial audit: explicit terminal geometry can correctly preserve a requested 2D stop while routedEndpoints identifies its separate internal walking anchor. That sub-check is corrected; actual geometry endpoints, exact XYZ/source-node identity and continuity thresholds are unchanged. This does not erase the real origin/internal gap or modify the saved failed result. The subsequent production projection fix was verified on cfc and is included in the current b702 runtime.

## Fixed selection

Each OD retains its exact request across ordinary, luggage, escalator, lift, and accessible preferences, with taxi disabled and enabled: 6 OD × 5 × 2 = 60 final cells. Selection does not depend on routing success.

| Stage | OD ID | Source points | Coverage |
| --- | --- | --- | --- |
| A | exits-cross | Admiralty E2 → Hung Hom B2 lift entrance | Cross-harbour; actual station exits and lift-source identity |
| A | stops-cross | td:4025 Tsim Sha Tsui bus stop → td:99133 Admiralty westbound tram stop | Cross-harbour; bus and tram stop endpoint identity |
| A | mall-floors | Pacific Place LG1 250000101 → L4 250000073 | Same shore; actual named-floor resolution and vertical routing |
| B | kowloon-local | Kowloon C1 U3 → td:4246 Kowloon Station bus terminus | Same shore; elevated exit and bus endpoint |
| B | land-island | Existing land fixture row 1, seed 20261011 | Same-shore fixed-seed off-node OD |
| B | land-cross | Existing land fixture row 12, seed 20261011 | Cross-harbour fixed-seed off-node OD |

Departure is fixed at 2026-10-12 11:00 Hong Kong time. Random requests are exact copies of the older seeded land fixture, whose content hash is recorded; this preparation does not regenerate or independently revalidate its land mask. Source stops need not appear as physical travel modes in the winning route. No transit mode is forced to win.

The named-floor representative coordinates are both `[114.16432165, 22.27762541]`. That does not make the two requests identical: floor IDs differ. Production must retain the selected named place/floor and disclose one of the selected floor's real portal nodes. LG1 has 2 allowed source portals; L4 has 5. These are not interchangeable with a ground-floor substitute. Exact map/source-node endpoints use strict XY or XYZ identity instead.

## Safe execution order

1. Wait for the performance investigation to choose the final runtime and release memory. No matrix should run alongside another city-routing probe.
2. Run unit/static checks: `node --test tests/navigation/point-matrix.test.mjs` and `node tests/navigation/point-source-precheck.mjs`.
3. Inspect a dry plan: `node tests/navigation/point-matrix-run.mjs --stage=A --preflight`.
4. Run only the six ordinary cells of stage A: `node tests/navigation/point-matrix-run.mjs --stage=A --preflight --run`.
5. Inspect endpoint, fare, evidence and cancellation reports. Diagnose structural errors before repeating them for other preferences.
6. Run the six ordinary cells of stage B using `--stage=B --preflight --run`.
7. Once the preflight is accepted on the same runtime, expand A and B separately with `--stage=A --run` and `--stage=B --run`.
8. Run the separate cheap source-floor layer only when wanted: `node tests/navigation/point-source-floors.mjs --run`. Without `--run`, it only prints its plan.

The runner is dry by default and runs serial fresh processes. A stage preflight has 6 cells: at most 6 minutes of route observation and 9 minutes of external-watchdog time. The entire ordinary preflight is 12 cells: 12/18 minutes respectively. Full A or B has 30 cells: 30/45 minutes; all 60 have 60/90 minutes. Actual completion may be faster. Boot and cancellation are reported separately/covered by the external watchdog. A later full stage reuses already observed preflight files with the same complete provenance; it never silently reruns a pending or failed cell. To intentionally retry, preserve the earlier report and use a deliberately new run location/workflow rather than overwriting evidence.

Each main process has a 768 MiB V8 old-space setting and each routing Worker 384 MiB. These are **not total RSS limits**. Production controls simultaneous Worker ownership. Host memory must be available; the runner stops after an invariant/Worker/harness error, OOM or unexplained SIGKILL and leaves the remaining cells not run. Output files and logs are small; no instrumentation or full source/data copies are written.

## What the production harness checks

- Actual built S1 plan/cancel event path, actual built Worker algorithms and production illustrative fare adapter; no algorithm edits or fallback replacement in the test.
- Fresh route cache with public and block data fully loaded before clicking Plan. Boot time is reported separately; taxi still loads on demand. This differs from a cold webpage click while data is still loading.
- First candidate app time, first externally observed candidate time, and **full-candidate wall time only after S1 finishes**. Poll granularity is 50 ms; this is server-side Node timing, not device or browser-paint timing.
- Selected endpoint ID, source node (including used-edge incidence), floor and coordinates; named-floor resolution must name a portal from that exact floor and agree with routed/path XYZ endpoints.
- Adjacent rendered-leg continuity in XY and known Z, with explicit gap reports (0.5 m threshold). Endpoint comparisons are tighter: 1e-7 degrees and 0.005 m in Z. Geometric continuity never converts schematic rail, taxi or connector evidence into verified official geometry.
- Authoritative disabled edges/physical closures and known strict-accessibility barriers/stairs/escalators/travelators. Used source access schedules are retained for timing review. This is not an independent live-facility or complete time-dependent-access proof.
- Strict source auditing additionally invokes the exact built engine eligibility predicate, exposed only for audit. It requires explicit eligible source evidence, official wheelchair status 2, parsed access rules and the engine's complete forbidden-kind list. Unresolved official physical steps fail. Each rejection retains reasons; synthetic timed service IDs remain distinct from source physical edges. Report audit-script hashes and predicate provenance identify this strengthened audit version.
- Every production compacted pricing leg, including middle/last taxi: modes must cover the original itinerary, each amount must be a nonnegative integer number of cents, and the sum must equal the full quote and ranking cost. Consecutive walk-leg compaction is explicitly allowed. These are illustrative model fares, not an official tariff audit.
- Bus/tram source-service stop boundaries, original vehicle shape and timetable are audited together. A 2D source stop can have an explicit unverified vehicle-display projection association to its original road/track centreline; this adds no pedestrian passage or walking time. Exact XYZ/node/floor access cannot use this allowance. Internal road-snap anchors remain distinct from the actual path endpoints, which must preserve the requested 2D coordinate.
- Taxi-off exclusion, strict-accessibility taxi exclusion, and luggage vehicle-confirmation flags.
- Unavailable choices retain incompleteReason, per-endpoint endpointAccess, scenario flags and every quoted pricing leg. Excluding an unverified endpoint-access scenario from available navigation does not mean the missing physical connection has been filled.
- Real Cancel stops planning, terminates pending owned Workers and prevents stale candidate publication during a 500 ms observation. A completed run's cleanup is labeled separately from cancellation while pending.

Unknown edge IDs, schematic geometry and modeled facility results are retained as evidence limitations. `source-backed-not-live-verified` is deliberately not a real-world accessibility guarantee. No rendered-browser, touch, layout or screen-level acceptance is claimed.

## Classification and provenance

A 60-second observation ending with S1 pending is `pending-observation-window`, never NO_ROUTE. Full-candidate duration remains null. The 90-second external watchdog is `external-watchdog-inconclusive`. Detected Worker/process OOM is `resource-failure-oom`; SIGKILL without evidence is `process-killed-resource-cause-unconfirmed`. S1 `d1=false` means stopped, not necessarily successful. `comparisonStatus: incomplete-error` or any `failedStages` is `incomplete-routing-error` even with usable candidates; full-candidate wall time stays null, stoppedWallMs is recorded, and the matrix pauses for diagnosis. A completed comparison with no candidates is `completed-without-candidate-needs-diagnosis`, not automatically a source constraint or algorithm bug.

Every report records runtime version, hashes of all JS/data in assets/area/transit/taxi, fixture hash, exact request, fetched source hashes, production stages, candidate assertions, unavailable messages, memory, Worker lifecycle and cancellation. Source fixture drift is rejected. A build/data change during an observation makes it inconclusive and stops the stage.

`node tests/navigation/point-matrix-summary.mjs --directory=<runtime-report-directory>` aggregates the exact 60 fixture cells without routing. It separates observed, completed-and-audited, pending/error and not-observed counts, and gives first-result versus genuinely completed-comparison timing distributions. Each cell links back to its original report. Derived summaries can be refreshed as new observations arrive; raw observations are never overwritten.

## Preserved regression history

- `8e5a3cbed130-9f9b7d1fccb7`: the second exit cell exposed missing exact XYZ/source access for a taxi scenario. The later production fix preserves endpoint metadata and excludes an unverified exact-endpoint taxi scenario from complete navigation while retaining the fare quotation. It did not build or verify a physical curb connection.
- `34c1eabb21cf-b0d33be9a541`: the first two exit cells passed the corrected endpoint rules. The bus-stop cell then exposed source stop/vehicle-centreline gaps of 9.033 m at boarding and 6.178 m at alighting. Its original evidence remains in `stop-projection-evidence.json`. An additional internal-anchor assertion was an auditor false positive, corrected with a regression while keeping actual path endpoints strict.
- `cfc54d2d0718-8411c9829422`: the repaired bus-stop cell preserves both exact stops, all 137 original vehicle-shape points and the original 692-second ride. The two endpoint associations are explicitly schematic and unverified as pedestrian access. Ordinary A/B preflight completed 12/12 with passing assertions before expansion to the other preferences. See `matrix-summary.json` for the current expanded coverage rather than inferring 60-cell completion from this preflight result.

The cfc expansion paused at 19 observed cells: 18 passed and the first strict exit cell exposed an exact-endpoint fallback defect. The fallback removed HUH node/Z constraints and appended a 30.740 m unverified connector to the requested display coordinate. The source node itself is not isolated: strict source BFS reaches both HUH platform targets. A separate first-geographic-match region bug assigns that HUH portal to the earlier, enlarged AUS region and then rejects its exact portal identity. `accessible-endpoint-diagnosis.json` and `strict-region-evidence.json` preserve the two findings. The latter also distinguishes unverified transit boarding policy from source-station connectivity. Neither defect is relabeled as a physical accessibility limitation.

## Separate source-floor coverage

Five source-supported levels are LG1 250000101, L1 250000074, L2 250000069, L3 250000136, L4 250000073. The fixture includes all 41 source portal nodes. No LG2 or unverified lift is introduced.

`source-precheck.json` is a cheap **directed fixed-clock BFS**, not a production route result. At 11:00 all five floors have ordinary graph connectivity to/from the existing F boundary. Conservative source eligibility leaves LG1 connected for strict accessibility; L1–L4 are not connected under that filter. At 08:00 all named floor endpoints are blocked by the recorded 10:00–22:00 rule. BFS does not model waiting, changing schedules or multimodal paths and cannot establish global NO_ROUTE.

The optional production source-floor layer uses the actual built block-graph route engine and all entrance alternatives for each floor, to/from the explicitly selected F boundary. It routes only the 110 physical Pacific Place model edges, preserving 209 original directed edge copies and all 98 required source nodes; all 41 floor portal nodes are present. It has 50 open-hour and 50 closed-hour cells (5 floors × 5 preferences × 2 directions at each clock). These 100 cheap source-only observations are never counted among the full S1/taxi matrix cells. Open-hour unavailability remains diagnostic. Access is checked at the actual origin-departure and destination-arrival clocks, including paid waits. At 08:00, starting inside a closed floor is rejected; starting at exterior F may wait until opening and then enter. The station-side F boundary does not imply that the mall is already open.

### Observed source-only outcomes

`8e5a3cbed130-9f9b7d1fccb7/source-floors-clock-aware.json` is the final source-layer result. At 11:00, 42/50 cells return source routes: all four non-strict preferences on all floors in both directions, plus strict accessibility on LG1 only. Eight strict L1–L4 cells are unavailable, consistent with the missing eligible source connection. At 08:00, 21/50 cells wait outside before entering at/after 10:00; all 25 floor-origin cells are rejected, and four strict upper-floor arrivals remain unavailable. All returned floor selections, forbidden-edge checks, paid-time sums and source opening checks pass. These are source-subgraph facts, not global S1 success or live accessibility guarantees.

The first source-layer report, `source-floors.json`, is preserved as an audit-development artifact: it wrongly assumed every 08:00 request must fail, including legitimate waits outside. The revised temporal audit reconstructs paid waits and checks actual departure/arrival access plus scheduled-leg intervals. It did not relax floors or facilities, and a unit regression rejects entry before opening and departure from an already closed origin. Do not treat the initial clock-assumption assertion as a production route bug.

## Offline price-weight sensitivity

`node tests/navigation/point-price-sensitivity.mjs --directory=<point-report-directory> --runtime-root=<matching-dist-or-frozen-runtime>` uses the exact runtime's production scorer and ranker without routing. Price weights are 0, 0.25, 0.75, 1.5 and 3; time-priority's other default weights and the preference-specific facility/carry ordering stay fixed. Each weight records the top candidate plus every ranked candidate's metrics and contributions. Pending/error comparisons are explicitly partial candidate sets.

Only complete, available candidates with passing structural assertions and finite pricing enter the comparison; unavailable XYZ/floor-access fare scenarios remain excluded. New reports retain original segment minutes/kinds for exact facility scoring. Legacy ordinary reports can use their existing metrics because their facility penalty is zero; legacy non-ordinary reports lacking segment data are excluded rather than guessed. There is no requirement for a taxi or connection candidate to win.
