# Traffic restoration

## Root cause

The unified map never connected a public-transport vehicle layer: its existing timetable model was only used for routing. Taxis were gated by the trip-planning policy and started paused behind a collapsed panel. The new basemap did not cover them.

## Changes

- Always-visible map controls and shared 10× simulated clock; default taxi visibility independent of planning policy.
- Metro/bus/tram positions and next-departure cards from the exact existing routing network, including calendars, service windows, dwell and direction.
- Public vehicle cap 160, viewport culling, persistent SVG marker nodes, 100 ms rendering tick. Hidden tabs and secondary views do not catch up elapsed wall time.
- Planning pauses and uses the displayed simulation time. Road taxi existing-order / pickup / passenger sequence is retained.
- Home preserves route results with an explicit resume action; changing inputs still invalidates them.

## Evidence

- 16 pure model tests include 40 real-network clock/date oracle comparisons to the existing scheduled engine.
- 10 stop layer tests; two bounded-clock tests; full application harness covers initial fleet, public modes, policy independence, pause/step and secondary-view pause/resume.
- Sampling benchmark covers 1000 samples, 16 maximum active vehicles in the sampled interval; Node model-only P95 0.095 ms. This is not browser FPS or a phone benchmark.
- Exploratory aggregate tests reported 12 missing-test-fixture dependencies after S1 acquired the new clock dependency. The VM fixture was updated, and its focused rerun passed all 12. `tests-release.log` documents the v43 aggregate check; `tests-final45.log` is the v45 release evidence.

## Limits

Everything is simulated, not realtime. Metro retains the existing official service-window plus 6-minute headway / 7-minute interval assumptions; tram shape is schematic. Display does not imply an official route shape or complete territory coverage. No original routing data, road graph, orders, forbidden edges or route eligibility were broadened.

Real browser verification is performed on the deployed Site separately from these Node checks. No physical-phone benchmark is claimed.

Final aggregate: runtime `d00b11e684ea`, 328 tests passed, zero failed/skipped/cancelled, 213.9 seconds. Build, syntax check and `git diff --check` passed. Six UI boot/Worker cases include preserved-home result/resume behavior. Original area/transit data and road-graph source have no diff.

## Final display polish

Runtime `a5c465982702`: 329/329 aggregate tests passed, 211.4 seconds. The metro direction no longer exposes routing IDs; simulation-start settings are explicitly distinct from the continuously updated planning-departure clock. Existing results show their captured departure time. SVG label bounding boxes accept clicks and narrow-view controls leave room for map tools. Node checks do not replace final browser verification.

## Independent browser regression fixes

Local browser QA found that the legacy taxi-preference handler reset time and fitted the fleet, and that reopening guidance always reset the journey. The preference handler now invalidates trip results without resetting time, simulation instance or viewport; four independent vehicle-layer buttons have been added. Guidance now resets only for a different journey object. New full-app assertions preserve exact clock/fleet/viewport through both preference toggles and all four layer toggles. The navigation test preserves instruction index 8 and progress 0.35 through return/reopen.

Final runtime `01b405bff09c`: 329/329 aggregate tests passed, zero failed/skipped/cancelled, 207.1 seconds. `tests-final45.log` is the final exact-runtime suite. Build, syntax and diff whitespace checks passed.
