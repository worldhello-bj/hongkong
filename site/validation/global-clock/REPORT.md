# One global Hong Kong simulation clock

## Corrected gaps

Version 46 connected route requests to selected time, but still stored a separate date/time input seed while the animation clock advanced, and repeated play/step controls in the taxi panel. The simulated account/order engine also used wall time. This version removes those independent live values and controls.

The sole `trafficClock` owns the calendar date, continuous service seconds, Hong Kong absolute epoch, playback state and seek revision. Input controls mirror its current date and seconds. Selecting either input atomically seeks and pauses the same clock, cancels pending route work, invalidates old results and resets the deterministic taxi scenario. Playing or advancing preserves fleet continuity and invalidates obsolete route snapshots. Calendar display rolls over at midnight without rewinding continuous vehicle time.

Navigation captures the same clock immediately when Plan is clicked, before data-loading awaits; only that immutable snapshot can produce results. Older seek generations cannot restore route results or asynchronously loaded fleets. Unchanged home/planner history does not rewind time. Taxi-policy toggles and four independent map layers retain their prior behavior, and navigation instruction/progress remains preserved on reentry.

The demo quote/reservation engine now reads the global Hong Kong epoch for creation, expiration and events. No real payment, dispatch or booking is performed.

## Verified results

Runtime **c8032ea8c371** passed **344/344 tests**, zero failures, skips or cancellations. The final full run took 225200.358208 ms. An earlier run found one obsolete UI test fixture referencing deleted date/time variables; that fixture was updated to supply the single clock, then the complete suite was rerun successfully. Runtime source did not change between build and final tests.

Tests cover atomic seek, invalid-input safety, immutable snapshots, input/map clock synchronization, actual play/pause, frozen public/taxi positions while paused, global-time order expiration, midnight rollover, same-time fresh scenario revision, stale data-loading and route promises, paid-order scenario safety, no duplicate taxi reservation, no taxi-policy reset, independent map layers, home result retention and guidance reentry.

Using the built application and real routing Workers, 金钟站 E2出口 → 柯士甸站 B2出口 on 2026-10-13 gives:

| Selection | Public duration | Route wait | Score | Busy demo taxis | ADM EAL next-service wait |
|---|---:|---:|---:|---:|---:|
| 08:00 | 28 min | 5 min | 48.37 | 27 / 48 | 240 s |
| 08:03 | 31 min | 8 min | 52.87 | 21 / 48 | 60 s |
| 08:00 again | 28 min | 5 min | 48.37 | 27 / 48 | 240 s |

Full taxi and public vehicle positions also differ between times and reproduce on reselecting the same time. The winning public route family need not change. Example taxi quote waits of 72.33 s and 133.48 s are from a separate fixed pickup/destination scene, not a claim of verified taxi curb access at the public OD.

## Boundaries

Eight original data/core files remain byte-identical to the v45 baseline: public graphs, service data, walk links, taxi road/core implementation and map geometry. No new official timetable, live traffic feed or real taxi motion is asserted. A time seek initializes a deterministic simulated fleet; it is not replaying the same real fleet through an entire day.

Verification is Node, DOM-harness and real Worker coverage. Visual desktop/mobile browser QA of this build is not complete: the cloud browser could not reach the local preview, and public publication remains paused pending authorization. Saved source/version preparation does not imply publication.
