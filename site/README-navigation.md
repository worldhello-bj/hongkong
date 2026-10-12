# Hong Kong integrated navigation demo

Built on the restored latest Site, preserving the large public pedestrian and indoor station datasets rather than the older small-node prototype.

## Build

`npm run build` copies editable navigation source and the taxi module/graph/optional government metadata into `dist`. It removes the obsolete 100,000-label abort from the bundled routing engines without removing graph dominance/cycle checks or service-day horizons. Then it produces a deterministic content-derived runtime version and applies it consistently to page JS/CSS, module imports, Worker URLs and lazy taxi imports. `dist/build-meta.json` records that version, preventing old cached code/data from surviving a new deployment.

Source entry: `src/navigation/main.recovered.js`; readable helpers: `integrated-navigation.js`, `taxi-bridge.js`, `integrated.css`. The recovered entry retains original embedded geography and preserved UI/geometry routines, with readable replacement orchestration. Taxi source belongs in `src/taxi/`.

## Coverage and choices

- Only two transport policy controls: 不含出租车 / 含出租车. Default excludes taxi; walking, rail, bus and tram remain eligible together.
- Public pedestrian/indoor models retain their original source coverage. Taxi roads cover Hong Kong Island's north shore and main Kowloon: 24,219 compressed nodes, 37,495 directed edges and all three road harbour tunnels.
- Generic search/map-selected taxi endpoints use nearby eligible roadside nodes and visible modeled walking links. They are not limited to West Kowloon/M+. Tunnel taxi routes follow the actual road graph, are labelled 经海底隧道 and have a differentiated tunnel overlay.
- Direct taxi is compared with public transport plus last-mile taxi and taxi plus onward public transport. At most two arrival-side and one departure-side interchange candidates are considered; actual public prefixes/suffixes must calculate successfully.
- Six one-click presets: cross-harbour rail; Central–Mong Kok road taxi; Mong Kok taxi-to-Austin plus rail-to-Admiralty; Admiralty rail-to-Austin plus taxi-to-Mong Kok; an official Austin platform-to-F-exit lift route for luggage; Sheung Wan–Wan Chai tram plus walking. M+ remains an additional example.
- Strict accessibility/luggage constraints are retained. Small ordinary-trip endpoint gaps can be represented explicitly as modeled walking connectors, never certified accessibility. Simulation/evidence details stay in the expandable panel.
- Fares/provider booking inventories are simulations and do not determine physical public-route feasibility. There is no per-bus vehicle seat-capacity simulation.

## Performance and cancellation

- No arbitrary wall-clock or label-count computation cutoff. Explicit cancellation, new inputs and navigation away abort stale searches and terminate associated Workers.
- Maximum two concurrent search branches. A fast public-connection query and taxi comparison are independent; available options appear immediately and remain selectable during refinements. Detailed station routing follows fast public routing. Long detailed block recomputation is only needed when the fast public candidate is unsuitable.
- Successful public queries are cached. Route diagnostics distinguish cold/warm requests, initial data loading, individual stage times and cache hits. `window.__navigationPerformance` supports diagnostic inspection.
- Service search is still finite (default six-hour transit horizon and actual modeled service windows). A future bus can entail a long wait; waits of 15 minutes or more are displayed prominently and included in total journey time. Removing compute caps does not create unlimited service-day waiting.
- Taxi graph is lazy-loaded only when taxi is enabled. Forty-eight simulated cars are spread across both shores inside the fixed illustrated showcase area [114.142,22.267,114.205,22.326], with seeded roaming trips and preloaded orders. Every synthetic route polyline stays inside that area; requested pickup/passenger routes keep the full expanded graph. The map shows the showcase boundary and the visible fleet count, fits the showcase on enabling it, and adds cached driving-road/tunnel context for wider queries. At most 12 likely vehicles are shortlisted for exact route matching. Fleet animation updates only vehicle SVG markers at 2 fps; path preparation is outside rendering.

## Tests

- `npm test`: navigation policy/real-graph/bridge tests plus taxi engine tests.
- `node tests/navigation/preset-smoke.mjs`: six-preset reachability and latency checks; writes `preset-check-results.json`.
- `node tests/navigation/measure-routing.mjs`: diagnostic worker-isolated cold setup/query timings. Its diagnostic harness timeout is not an application planner limit.

Node tests do not establish browser layout, WebGL or actual device latency. Browser verification is separate; publication does not change Site audience/authentication.

## Source-backed station endpoint and lift corrections

`npm run build` reapplies two guarded corrections with `scripts/repair-station-anchors.py`: adds the separate Hung Hom B2 lift endpoint from official amenity `.2654` (retained in `src/station-evidence/huh-b2-lift.json`) and selects an existing accessible Kowloon TCL platform-area node inside official platform polygon `.3077`. No graph nodes, edges, barriers or directions are invented/relaxed. The original stair entrances remain distinct.

`repair-accessible-lifts.mjs` removes the accidental blanket lift exclusion from the accessible profile in all four preserved runtime/Worker bundles. Explicit disability, source wheelchair barriers, eligibility, one-way edges and opening schedules remain enforced. `station-endpoints.test.mjs` runs actual accessible/luggage journeys in both directions, plus closed-lift, barrier, ineligible-lift, closed-hours, direction and stairs regressions. This is modeled connectivity, not live facility verification.

Every build recalculates station coverage and emits `dist/preview/station-access-alternatives.json` for upper-level planning. Alternatives require explicit selection of a new start when no verified approach route exists; their geometric separation is not a walking distance. Existing area coverage does not contain the Hung Hom B2 lift node, so no street detour is claimed. Station data participates in runtime cache versioning.

### Entrance alternatives in the planner

Failed station-entry requests now show explicit alternative entrance cards. The original endpoint stays selected until the user clicks “改为…并重算”; estimated alternative times exclude any unverified connection between entrances. Cancellation/new inputs suppress stale suggestions. No straight-line walking connector is added.

An existing official outdoor detour connects Admiralty C2 to the E1/E2 lift side, subject to the source 08:00–22:00 platform opening schedule. Actual source-edge routes keep the original endpoints and label the traversed lift/approach time in the complete result. The build only reconciles stale eligibility on seven audited physical lift features (14 directions) in the block overlay: 1000859480, 1000860708, 1000859708, 1000861503, 1000862126, 1000860957, 1000862720. `scripts/repair-station-overlay.mjs` requires matching official IDs, endpoints, geometry, directions, barrier=2, enabled state and schedules, and preserves closures or subsequent corrected-edge overrides. Other lifts and travelators are untouched.

`tests/navigation/station-alternatives.test.mjs` verifies actual C2↔EAL detours, closed hours, explicit HUH B2 lift selection, unchanged/stale endpoints, cancellation, rendered disclosure/button markup, and overlay disabled/barrier/closure precedence. These are engine and non-browser UI logic tests; browser layout/click execution is not established by them.

## Startup and arbitrary map-point regression repair (2026-10-11)

- Core station/area/services/walk-link readiness is independent of optional station alternatives and Admiralty detail. A pending optional response cannot hide the public network or disable ordinary street routing. Detail-dependent candidates stay provisional while detail loads; successful detail loading invalidates caches and recomputes active queries. Core failures expose their reason and a reload action. Cancelling while core data loads does not restart the cancelled query later.
- The public service envelope is drawn separately from the taxi fleet showcase. It is the intersection of each source region's radius and selection rectangle. Outside picks receive an immediate nearest covered-place suggestion. Map-picked ordinary connectors are modeled with distance/time, guarded against whole-segment crossings of mapped water and known closure/barrier geometry; strict accessibility is unchanged. Background geography is not surveyed accessibility evidence.
- Scheduled ordinary-fast walking now uses explicit opening waits at modeled wait-permitted nodes and safe access/cost/elapsed Pareto dominance. Node or edge `wait_allowed:false` / `waiting_allowed:false` retains non-waiting semantics. Facility-preference semantics, disabled edges and schedules remain enforced. The inherited four-hour service-search horizon applies to scheduled searches only; there is no wall-clock or label-count abort. Waiting permission where unspecified is a demo assumption.
- FIFO repair covers the shared browser module and all three workers containing its walking algorithm. Browser public routers no longer also build duplicate full router indices on the main thread; the worker is authoritative, with a lazy Node fallback.
- `ui-startup.test.mjs` executes the production module with DOM stubs and actual worker_threads running the published Worker bundles: stalled metadata, stalled detail, old stored taxi-only preferences/navigation hash, and actual map-point selection with immediate usable results and cancel preservation. It is not a browser visual test. `fifo-wait.test.mjs` tests actual-engine waits, no-wait counterexamples, preference/closure behavior, schedule boundaries, and 2,000 seeded window cases.

## Expanded and explicitly modeled demo routes

The expanded official pedestrian dataset plus seven exact XYZ Kowloon boundary joins contains 61,055 nodes and 135,514 directed edges. Public selection uses the union of actually acquired envelopes and the region radius; all 72 endpoints from the fixed 36-query campaign are included. Updated area and walk-link data now participate in runtime versioning.

When original routing has no usable result, the demo can offer a separately labelled modeled route. For accessibility/luggage, it uses isolated filtered area, station, detail and cached-walk-link inputs, excluding known stairs, escalators, barriers, disabled/closed edges. Unspecified facility suitability remains unverified. Results carry `confidence: modeled`, `needsConfirmation: true`, and `accessibilityVerified: false`; the UI says facilities need confirmation. Existing lifts may be used, but no lift is invented. Only source ground-level entrances may project to an estimated street approach; source elevation is retained for connector checks, and a known >1 m vertical mismatch is rejected.

Idle walking workers are retired when switching graph inputs; completed strict-routing workers are disposed before a filtered fallback is created. User cancellation and completed result selection remain independent of later refinement.

Pricing is auxiliary. Consecutive walking phases are compacted only in the pricing input, preserving full navigation geometry and interchange steps. More than 100 detailed navigation segments no longer causes the booking demo to reject the route. Pricing exceptions produce a visible pending price and disabled booking, while the route remains selectable. Focused pricing tests and a full production-entry/real-Worker pricing-outage test cover this behavior.

Modeled fallback first searches the isolated base public graph (bus/tram/rail), then walking, and only creates a detailed overlay router if neither candidate passes both overlay consistency and modeled-facility validation. A complete-but-rejected candidate cannot short-circuit refinement. Removed authoritative overlay edges are rejected alongside closures and changed schedules.

The modeled graph also carries the rendered geography and known closure geometry into its snapping index. Unsafe straight access candidates across water or closed lines are excluded before shortest-path search, so an alternative land-side snap retains the original endpoint and contributes its own distance/time to the actual timetable calculation. This fixed the campaign's harbour-corner case: the original57m chord crossed water; the chosen59.8m chord stays on land. Tests cover safe snap selection, endpoint/time preservation and removed authoritative overlay edges.

## Five passenger preferences (soft costs versus hard safety)

Preference costs are demo ranking units measured in seconds. They never change physical leg durations, service times, waiting clocks or arrival times. All profiles honor disabled edges, closures, direction and opening hours.

| UI preference | Engine parameter | Preference cost | Hard rules / disclosure |
| --- | --- | --- | --- |
| 普通出行 | fast | Travel time | Standard physical and schedule rules |
| 行李 · 少搬运 | luggage | Walk/crossing/ramp time×2; stairs×8; escalator/moving walkway×4; lifts×1; ranking adds180s per transfer | Explicit baggage prohibitions remain forbidden. Stairs/escalators may appear only as `需搬运行李 / 设施待确认` alternatives. Big luggage should use lifts. This profile is not wheelchair eligibility. |
| 扶梯优先 | escalator_first | Stairs×3; each non-continuing lift ride adds90s | Soft preference; no invented facility and no reward for unnecessary escalator loops |
| 升降机优先 | lift_first | Stairs×4; escalator/moving walkway×2; lifts and ordinary walking×1 | Soft preference; other physical facilities remain possible alternatives |
| 严格无障碍 | accessible | Travel time among eligible edges | Existing eligibility and known barriers enforced. Separately labelled modeled fallback retains barrier/stair/escalator filtering and requires confirmation. |

Original and fallback results expose `requestedPreference` and `effectivePreference`. Luggage paths using actual or summarized stairs/escalators set `luggageCarryRequired`, `needsConfirmation` and `needsFacilityConfirmation`; source-edge lookup prevents generic walk summaries from concealing carrying steps. Accessibility modeled fallback uses effectivePreference=`fast-filtered-accessibility`. Other fallback phases preserve the requested soft profile instead of resetting everything to ordinary.

All profiles now use paid-wait dominance when the graph permits waiting. An earlier label dominates a later one only if its accumulated cost plus the wait needed to reproduce the later arrival is no greater, alongside access-distance/state compatibility. Graphs with explicit no-wait metadata retain the original more general label logic. Microscopic network tests demonstrate preference differences, paid-wait counterexamples and unchanged arrival clocks.

## Five-preference regression follow-up (2026-10-11)

The immutable `aca6048ba101` matrix tested 36 fixed origins/destinations × all five preferences: 173 available modeled results, six diagnostic timeouts, one strict-accessibility no-route. A lift-preferred walking refinement separately exhausted its diagnostic 384 MiB Worker heap while a public option remained available. These results are not a claim of 180 passes on the follow-up build.

The follow-up preserves the same routing constraints and preference costs, adds an admissible preference-aware reverse bound, and moves guarded modeled access before expensive original-graph refinement. Walking runs independently; a found option stays selectable while refinement continues, and cancellation rejects stale results. Ground-labelled station endpoints retain their original absolute elevation when choosing modeled access and in the displayed XYZ geometry. No lift or vertical connection is invented.

Targeted actual-entry/DOM/real-Worker verification (not visual browser QA):
- OD7: all five profiles completed. Luggage/escalator/lift walking refinements took approximately 64/75/97 seconds; first usable results remained available in approximately 8–12 seconds of search. The former lift Worker OOM completed under the same 384 MiB diagnostic limit in this run. Long-tail performance remains an open issue.
- OD36: all five profiles produced selectable results before detailed refinement, approximately 12–28 seconds of search; navigation/cancellation and original XY were checked. Detailed refinements were canceled after the usable first result, not claimed fully tested.
- HUH D6 strict demo: original XYZ retained; a modeled 124 m approach joins a source-backed walkway at a compatible elevation, followed by existing public routing. Facilities remain unverified.
- Five taxi-enabled preference checks: ordinary and soft preferences allow taxi; luggage requires vehicle-space confirmation; strict accessibility does not claim an unverified taxi vehicle suitable. Public-only checks and ten preference/toggle unit cases also pass.

Remaining strict cases are explicit: Austin B2 to the southern island endpoint still has unresolved intermediate access geometry; Kowloon C1 U3 is bounded by source wheelchair-barrier edges and has no currently connected lift. They are not silently moved to another entrance or labeled accessible. All successful fallback results remain modeled/pending facility confirmation rather than verified accessibility.

A final lightweight geometry correction binds each synthetic access leg to its own local coordinates. Repeated `ACCESS:origin` / `ACCESS:destination` IDs no longer let one intermediate connector borrow a later connector's geometry. Stop-access verification downgrades retain local geometry as unverified evidence; missing intermediate geometry is never filled from whole-trip pins, and inconsistent lengths are rejected. Four real cached-walk regression assertions passed, along with the 21 connector/facility/height tests. This final geometry-only adjustment did not receive another full 180-case run; Austin's full-route status remains pending a targeted retest.

## KOW C1 modeled corridor and remaining-case verification

The isolated follow-up adds a 74.801 m same-level (13.5 m) modeled corridor only to the filtered, explicitly unverified accessibility-demo graph. It joins an existing C1 walkway node to an existing lift landing by a multi-bend route around the known escalator/stair footprints. MTR's station/accessibility maps and ELEMENTS' official L1 map support the public-corridor/lift relationship; the exact turns and clearances remain modeled. No lift is invented and the original strict graph is unchanged. The 62.334 s connector time follows the entire polyline, not its endpoint chord. Known barrier/closure crossings are checked at their actual interpolated elevation; missing barrier Z fails closed.

Runtime `bcf8f9769312` received five actual-entry/Worker KOW C1 tests on identical endpoints: ordinary/luggage/escalator/lift/accessibility-demo all produced selectable routes, preserved original XYZ and destination XY, and passed used-edge prohibitions. Search-to-first-result times were approximately 5.10/8.24/7.14/8.01/7.90 s. This is targeted validation, not another 180-cell campaign. Twenty-nine light geometry/facility/source-fixture tests passed.

Austin B2's previous incomplete route now passes the local-geometry-corrected `8591716d54ee` actual-entry test (13.61 s to the first modeled result). Its roughly 641 m intermediate access segment passes source map land/water and known forbidden-edge/polygon checks and has consistent horizontal distance/time, but local elevation is absent. Its slope and actual step-free continuity remain unverified, and the 99-minute result is not claimed optimal.

The same final runtime also retested Austin B2 accessibility-demo successfully: 15.77 s search-to-first-result, original XYZ retained, 99-minute modeled journey, no forbidden used-source edges in the audit.

### Public stop map layer (2026-10-11)
- Default map markers use all 83 existing timetable stops: 51 bus, 32 tram. Coordinates and route/direction membership come directly from services.json; no invented stops or live-arrival claims.
- Blue round bus icons and green square tram icons. Wide views group same-mode stops into 44px cells; selecting a group fits its real members. Close views expose individual stops with at most 12 labels.
- Stop card lists available routes, direction, source, close, and set-origin/set-destination actions. Actions retain existing exact stop coordinates and current preference/taxi policy. Map pointer capture skips markers so taps remain clickable. Touch targets are at least 44px.
- Stop catalog cached by dataset reference. Viewport redraw batched to animation frames and skipped when unchanged; fleet animation does not rebuild stops.
- Validation: transit-stops tests 5/5; combined preference/taxi/stop unit tests 19/19; full entry module/DOM card and both endpoint actions passed with real dataset. Cloud browser could not reach the executor-local preview (ERR_CONNECTION_REFUSED, no supported port forwarding), so no actual browser screenshot or mobile visual pass is claimed.
