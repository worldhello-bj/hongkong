# Navigation departure time and shared traffic snapshots

## Scope

The planning panel now exposes Hong Kong departure date/time directly. Selecting it pauses at the exact selected second, rebuilds a deterministic simulated taxi scenario, clears prior route/quote results and enables recomputation. Public vehicle positions, next services, route requests and taxi queries use the same clock. Results carry immutable departure date, second, scenario key and instance revision.

Advancing or playing invalidates existing results before moving time. Unchanged home returns retain results; taxi-policy and map-layer toggles retain fleet, clock and viewport. Accepted paid-order resume restores a coherent result snapshot and only a matching live taxi reservation. Old scenario-instance quote handles are rejected, including after reselecting the same wall time. Deleting local demonstration data clears simulated vehicle reservations as well.

## Repeated source-backed OD

Date: 2026-10-13, Hong Kong. Exact points: 金钟站 E2出口 → 柯士甸站 B2出口. Tests use the built application with real routing Workers; they retain the first complete public route, then explicitly cancel refinement to exercise snapshot preservation and stale-result rejection.

| Selection | Public trip | Total route wait | Recommendation score | Busy demo taxis | Best example taxi wait | ADM EAL next-service wait |
|---|---:|---:|---:|---:|---:|---:|
| 08:00 | 28 min | 5 min | 48.37 | 27 / 48 | 72.33 s | 240 s |
| 08:03 | 31 min | 8 min | 52.87 | 21 / 48 | 133.48 s | 60 s |
| 08:00 again | 28 min | 5 min | 48.37 | 27 / 48 | 72.33 s | 240 s |

The public recommendation remains the same route family; the implementation does not force a different winner. The taxi quote numbers are a separate fixed pickup/destination scenario, not a claim that these exact public OD endpoints have verified taxi curb access. Station-card countdown starts at the selected stop time; whole-route waiting includes reaching platforms and connecting services, so those waiting numbers need not move in the same direction.

The test also compares actual public vehicle positions and complete taxi position/state arrays. Reselecting the same date/time reproduces the physical scenario and route metrics. Separate unit tests cover another date, order completion before pickup, road direction/turn restrictions, continuous ticking, existing reservations and bounded initialization.

## Verification

Final runtime **ebebc836f058** passed **337 tests, 0 failures, 0 skips, 0 cancellations**. Aggregate counts are recorded in `verification.json`; the successful build log and test summary are adjacent. The repeated-OD observations are preserved as JSON. Eight source/data files are byte-identical to the baseline listed in `source-preservation.json`, including public graphs/services, road graph, taxi simulation core and map geometry.

Coverage includes:
- Exact paused selection, rapid selection changes and delayed-fleet ownership
- Stale in-flight routing rejection and no old quote/result restoration
- Result invalidation on clock advance, with fleet continuity
- Paid-order scenario/version matching and no duplicate taxi reservation
- Default-time local-data reset clears all simulated reservations
- Next-day labeling at midnight
- Four independent vehicle layers, taxi-planning policy independence, unchanged home results and guidance instruction/progress

These are Node, DOM-harness and real Worker checks. They do not establish visual mobile/browser rendering.

## Simulation boundaries

Public services still use only the existing loaded routes, calendars, first/last windows and explicitly modeled headways. No new official timetable or live feed is claimed. Selecting a date/time initializes a new reproducible 48-taxi scenario with a bounded 120–300-second warm-up along legal existing roads. Playback continues that scenario; selecting another time is not a replay of one real fleet throughout the day. Road speeds, prior orders and demand remain simulation assumptions. There is no real dispatch, booking, payment or live traffic integration.
