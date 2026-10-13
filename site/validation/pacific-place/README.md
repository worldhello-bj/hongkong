# Pacific Place: source model and route diagnosis

Checked 2026-10-12. This is the source-block diagnostic and independent model module, not a claim that a new public deployment is live.

## Findings

- Pacific Place already had 5 source levels and 10 entrance records in the block graph. There were 5 physical lift edges and 11 escalator edges in the mall display subset, but no dedicated mall model view.
- The default 08:00 time encounters loaded interior access rule 290000393, whose label is Pacific Place Podium, every day 10:00–22:00. Live queries to CSDI on 2026-10-12 confirm this is explicitly attached to LG1 edges 250019621, 250019625 and 250020758. This is a source-model restriction, not proof that every real corridor in the complex is closed.
- The adjacent station-side Exit F passage 250019051 has no AccessTimeID in its source record. Absence of a rule does not certify 24-hour access. Its exact shared endpoint is now exposed as a separate, explicitly selectable external passage point. No route edge, coordinate or accessibility flag is changed.
- The operator's Great Food Hall page says LG1 opens at 08:30, supporting the distinction between general mall hours, tenant hours and passage hours. The precise early-opening access path is not verified, so the existing interior edge rules remain intact.
- The main-mall F link is distinct from the closed Three Pacific Place tunnel. Its closure IDs remain excluded.
- The old successful block-load handler does not update the initial “block not yet loaded” map label. The main integration owns that UI fix.

## Changes

- `src/navigation/pacific-place-model.js`: immutable model construction from loaded source edges, an exact F boundary portal, an explicit external named-place alternative, SVG layer projection, floor selection, rotation, explode/collapse and route-edge highlighting.
- `src/navigation/pacific-place-model.css`: scoped model styles.
- `scripts/repair-pacific-place-model.mjs`: idempotent source-anchor registration and generated `dist/preview/pacific-place-model.json`. No edge creation or removal. The main build must invoke this before runtime versioning and copy the JS/CSS modules.
- `src/place-evidence/pacific-place-sources.json`: operator/MTR URLs, schedule-scope distinctions and fresh source API responses.

The display uses source XYZ lines and source floor IDs. Floor plates are only convex display envelopes around those routes, not architectural wall/room geometry and never walkable route polygons. Exploded spacing is visual. Model duration fields are copied from the existing estimated routes. LG1 is only partially covered; LG2 is not given a fabricated endpoint.

## Regression evidence

`node --test --test-concurrency=1 tests/navigation/pacific-place-model.test.mjs`

Six tests: source XYZ/eligibility preservation, idempotence, mismatch and closure guards, closed-tunnel exclusion, per-floor finite projection, and explicit start/destination selection.

`node tests/navigation/run-pacific-place-validation.mjs`

24 serial source-graph cases:

- 08:00, mall automatic entrance: ordinary, luggage and strict blocked by the source schedule.
- 11:00, automatic entrance plus LG1/L1/L2/L3/L4: all ordinary and luggage cases assemble complete journeys. Strict automatic/L2 succeeds; strict LG1/L1/L3/L4 remains unavailable. No forbidden facility was used.
- 08:00, explicitly chosen external F point: ordinary approximately 6.08 min and luggage approximately 7.37 min to Tamar, complete. Strict remains unavailable. These routes do not establish entrance into the mall or live passage opening.

The direct F node could not be requested previously because the route engine accepts exact endpoint IDs only when they are registered portals. Registering the existing node fixes that missing selectable endpoint without connecting separate geometries.

Scope: the JSON/log establish source-graph routing and assembled journey completeness. They are not browser UI, mobile layout, production Worker lifecycle or whole-network comparison tests. The parent integration must run the build and UI checks on the final runtime.

## Suggested user-facing short explanation

“当前所选08:00早于已载入商场内部通道的10:00开放规则。部分租户营业和站侧F通道规则不同；这不表示整座太古广场关闭。可明确改选外侧F通道接点，或修改出发时间。实际开放仍需现场核验。”

## Integration

- Build: copy the module and CSS; run `repair-pacific-place-model.mjs` after the normal source graph repairs, before runtime versioning.
- UI: use `buildPacificPlaceModel(z)` after block readiness; or load the generated preview JSON. `createPacificPlaceModel(host, model, {targetLabel:'起点'|'目的地', onSelectFloor})` returns `resize`, `focusFloor`, `focusStep`, `dispose`.
- Floor callback returns `{id,name,...}`. Preserve named place ID `pacific-place` and use `pacific-place:floor:<id>` with `floorId`, using the existing place resolver. Do not silently choose an entrance or change the other endpoint.
- Do not add the mall to MTR STATIONS. It is a distinct mall model, with LG1 meaning different from station L1.

## Main UI integration

Runtime `deeb5d2dd3c1`: the unified `#mall` screen preserves station 3D separately, exposes an explicit start/destination floor choice, and keeps the opposite trip endpoint. A compact source-rule notice offers a user-triggered change to the next modeled opening window; it never moves either endpoint automatically. Successful block loading now refreshes the map label, and extensionless historical station/information URLs are recognized. The 23 focused model/UI/weight/policy tests passed, including the actual main event-handler floor-choice/history flow; see ui-integration-tests.log. The 24-case source matrix is separately recorded above. These checks do not claim browser/mobile visual acceptance.
