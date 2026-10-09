# Implementation traceability and acceptance gates

The delivered code implements a research vertical slice across all major modules. It does not claim that an eight-week engineering, site survey and operational acceptance programme occurred during development.

| Work package | Delivered | Remaining gate |
|---|---|---|
| HK-01 baseline/city | Separate Hong Kong repository, namespace, DB and immutable builds | Beijing archive not supplied; no fabricated regression |
| HK-02 sources | Actual probe index, raw hashing, terms, ignored originals | Operational/commercial use review |
| HK-03 spatial | All four geometry types for three exact CSDI venue IDs plus 3,294 real 3D network segments in two count-verified regions | Semantic platform/gate mapping and network-edge field review |
| HK-04 MTR | Seven line/station official probes, semantic adapter, live endpoint | Extended availability observation |
| HK-05 bus | Stops/ETA, 12 route-direction-variant patterns, 9 incoming research legs | Independently audited walking access and interval times |
| HK-06 mappings | Stable provider-scoped IDs; exact stops, distinct platforms | Independent double-review |
| HK-07 model | 74-node multimodal research model plus actual 3,077-node / 6,501-directed-edge spatial graphs; real floor IDs; strict evidence handling | Cross-model boarding-position/gate mapping and field audit |
| HK-08 Admiralty | Bus approach → paid-area entry → target platform; live feed lookup | Empirical calibration and boarding validation |
| HK-09 hub | Austin/Kowloon/West Kowloon conditional connectivity | Detailed HSR/public-space geometry and operation review |
| HK-10 plans | Stop-order import, GTFS import contract, calendars and >24h times | HK GTFS acquisition, fares and calibrated intervals |
| HK-11 journey | Constrained routing, closures, preference, local revision API | Wider-network multiobjective alternatives and service calendar integration |
| HK-12 HSR | Independent verification and boarding margins, rules and boundary tests | Field queue samples/current service notices |
| HK-13 UI | Interactive station geometry, layer/floor controls, steps, feeds, HSR, source evidence | Parent-led browser QA record |
| HK-14 experiments | 30 appendix categories in deterministic tests; 60 synthetic OD × six cases | Human-audited OD, ground-truth arrival measurements and A/B/C study |
| HK-15 release | Startup, source collection, OpenAPI, tests, limitations | Public-service approval and original Beijing baseline |

## Honest scope limits

1. Maps are official source geometry; route lines in the topology are intentionally schematic. No paid-area/floor assumption is promoted into verified geometric routing.
2. Documented barrier-free level walk/ramp segments can route conditionally in the official graph. Current moving-facility status remains unknown, so affected paths return `UNVERIFIED_ACCESS` with blockers. The abstract multimodal model has no fully audited accessible path.
3. Rail waiting and running durations are research parameters. Live arrival-only data does not supply a confirmed departure; available departure events are used only for the mapped direction and prediction window. Current bus arrivals use an explicit boarding assumption. Requests beyond prediction windows stay in estimated mode.
4. The algorithm is constrained multi-state Dijkstra, not a claim to implement full RAPTOR/Pareto multi-label public transport routing. It keeps paid-exit history and ride count. Preference weights affect selection; time is accumulated independently.
5. Saved journeys require explicit consent/token. The user interface can export a result locally without sending it elsewhere. No login, travel credentials, names or government ID are collected.
6. No source update job, public deployment, paid API or production promise is activated by cloning this project.

## Publication blockers for a public navigator

- Complete semantic platform/gate bindings to the obtained official 3D network, extend outdoor coverage beyond the clipped regions if needed, and independently audit the import.
- Independently audit all platform direction, gate, vertical facility and bus access mappings.
- Integrate actual service calendars/timetables and review frequency assumptions.
- Measure walking, queue and interchange times. Do not use ETA snapshots as actual arrival truth.
- Finish at least 60 independently reviewed OD cases and longer source monitoring, permissions/legal review, hosted HTTPS authentication, rate-limit strategy and maintenance ownership.
