# Source-backed station model inspection

Baseline: GitHub `f6280f3e1cb5a709a53aaa3690721c4ef93e5e0e`, live runtime `ac80b061436c` verified 2026-10-16.

## Delivered changes

- Restore East Tsim Sha Tsui (ETS) to the shared station registry. Its official 12 levels and 157 unit polygons were bundled, but the UI registry omitted it: deep links silently selected ADM and exact ETS navigation edges could not open station inspection.
- Add a read-only source-facility panel for all six official station models. Users can filter by source elevation and kind, choose a physical source segment and highlight its unchanged XYZ geometry.
- Use exact edge region identity for this inspection, rather than nearest station center across overlapping acquisition envelopes.
- Correct stale coverage wording: official source geometry covers all six stations, while KOW C1's supplemental corridor remains modeled and the high-speed models remain schematic.

## Scope and evidence

The panel only accepts enabled `CSDI-INDOOR`, `geometry_mode=official` facility records with finite XYZ and at least 0.4 m difference between endpoints. Reverse directions are deduplicated by physical ID. This produces 291 source segments: ADM 85, EXC 40, HUH 39, ETS 39, AUS 41 and KOW 47. These are facility segments, not counts of independent devices. Same-level landing pieces are deliberately not shown as cross-level links.

All existing station/area graph records and official polygon files are unchanged. Selecting an inspection does not plan a route, change endpoints, advance the simulation clock or authorize passage. Source elevation is not a floor number, storey height or depth. Current opening, operational status, accessibility and complete route continuity remain unverified.

No invented AUS F connection, Pacific Place LG2 floor, high-speed station corridor, lift location or escalator has been added. West Kowloon and Futian retain display-only procedural models.

## Verification

- Focused model/connector tests: 13 passed after independent review.
- Final aggregate: 482/482 tests passed, zero failures/skips, 254.924 seconds; runtime `4021be15aa36`. Includes real Worker/public route, route/time preservation, EXC source connection, exact terminal, taxi simulation, unified shell lifecycle, model inspection and keyboard-focus helper regressions.
- Browser visual verification remains pending. Local browser launch was blocked by environment socket restrictions; do not infer a visual pass from these tests.
- Terminal resolver policy uses unchanged strict normalization. The independently reviewed `reviewed-source-connector-inspection` profile changes exactly main source, built main and the additive renderer hook hashes. Historical profiles remain unchanged. The review confirmed no routing or ingress-proof semantic change, and fixed keyboard-focus retention and stale asynchronous station-path overwrite risks.
