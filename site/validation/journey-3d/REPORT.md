# High-speed station 3D workflow expansion

Date: 2026-10-13. This module-stage report predates application integration and does not claim routing/eligibility changes.

## Deliverable

- `src/navigation/journey-3d-data.js`: immutable documentation-derived floor functions, display-only procedural steps and source provenance.
- `src/navigation/journey-3d-model.js`: zero-dependency isometric floor cutaway, full toolbar and controller, safe text escaping, fallback, procedure resolver.
- `src/navigation/journey-3d-model.css`: scoped responsive styling, 44px controls, visible keyboard focus, reduced-motion behavior.
- `tests/navigation/journey-3d-model.test.mjs`: nine tests, including 240 seeded view probes and actual bidirectional high-speed journey results.

### Integration

Import `createJourney3DModel`, `resolveJourney3DStep`, `JOURNEY_3D_STATIONS` from the model module and load the CSS. Copy all three source files into the runtime assets.

`createJourney3DModel(host, {stationId:'HSR:WEK', direction:'departure', onStationChange})` renders all UI itself. The controller has `setStation(id)`, `focusFloor(id|'ALL')`, `setProgress(0..1)`, `focusStep(step,{trip})`, `getState()`, `resize()` and `dispose()`.

`resolveJourney3DStep(step,{trip})` returns null for unresolvable steps. It only accepts known `highSpeedProcedure` kinds and structured `trip.fromStopId/toStopId` (or fromId/toId), never geographic proximity, free-text labels or station-name guessing. Unknown waits, transfers and moving-train steps deliberately do not resolve to an indoor location. `focusStep` clears previous highlights and displays an explicit unlocated message when resolution fails.

## Evidence and modelling boundary

Verified source pages:

1. [MTR West Kowloon official layout](https://www.highspeed.mtr.com.hk/res/pdf/WEK-station-layout-B3.pdf). Live PDF title on 2026-10-13 was `XRL-SLM [B3]-202609-WEB-1`; confirms the relevant B1/B2/B3/B4 floor functions. No surveyed geometry imported.
2. [MTR departure process](https://www.highspeed.mtr.com.hk/en/guide/process-departure.html). B1 verification, subsequent security, B3 immigration and boarding process.
3. [MTR arrival process](https://www.highspeed.mtr.com.hk/en/guide/process-arrival.html). B4 alighting, B2 immigration, then departure from the station.
4. [Futian government-hosted opening report, 2015-12-29](https://www.szft.gov.cn/xxgk/zwgk/gzxx/zdjsxm/xmjz/content/post_3965773.html). B1 interchange, B2 concourse/waiting, B3 high-speed platforms. Historical building facts only; not evidence of current facilities or exit routing.
5. [Shenzhen Transport Bureau station description](https://jtys.sz.gov.cn/ydmh/jtcx/hccx/hczfb/content/post_11457303.html). Corroborates station identity and transport context.

West Kowloon departure security is bounded between the documented B1 and B3 procedural stages, with no fabricated security-facility point. Futian arrivals do not have a synthetic path between B3 and B1 because the route and exit-gate level are unverified. Futian B1 is explicitly optional background, not a compulsory entry path.

Every slab, UI point and dashed link is procedural/schematic, uses unitless display coordinates and has routeEligible=false. There are no source graph nodes, geographic coordinates, elevators/escalators, exact exits, platform assignments, realtime locations, or accessibility guarantees. Unknown/missing geometry remains missing. No route graph, route duration or physical eligibility is modified.

## Verification

PASS: `node --test tests/navigation/journey-3d-model.test.mjs` (9/9).

- Documented levels and immutable display data.
- Known north/south procedural mappings and bounded floor selections.
- Unknown/directionless/named/nearby/transfer/mainline/wait fail-closed behavior.
- Every model/direction/floor in expanded and combined modes.
- Safe escaping, explicit provenance and historical caveat.
- Repeated switching, floor choices, progress, unknown-step reset, disposal and recovery.
- Real high-speed journey result and graph remain unchanged.
- Malformed geometry fallback and 240 reproducible seeded view probes (seed 492613) stay finite and inside the canvas.

PASS: standalone SVG rendering to PNG with Inkscape and visual inspection of West Kowloon/Futian cutaways. Artifacts: `west-kowloon.svg/png`, `futian.svg/png`. This only validates static diagram layout, not HTML/mobile UI or browser interaction.

BLOCKED / NOT RUN: browser-level desktop/mobile checks. Installed headless Chromium could not start in this executor (`socket() failed: Operation not permitted`). A standalone `preview.html?test=1` contains the intended real-DOM check sequence for integrated browser validation. No actual mobile screenshot, keyboard browser pass or reduced-motion browser pass is claimed. CSS and unit assertions cover declarations only.

## Remaining product limits

This is a workflow-oriented isometric model, not a surveyed BIM or exact indoor turn-by-turn map. Source-backed existing station and Pacific Place models remain separate and unchanged. Future precise geometry must be anchored to verified data before it can be used for walking, exits, facilities, or accessibility.
