# 层间 · Hong Kong unified navigation

A mobile-first Hong Kong MaaS demonstration with one compact, map-led interface for route planning, indoor multi-floor 3D, simulated orders, account preferences and service settings. This repository's **only default application entry is the unified navigation UI**.

## Build and start

Use a current Node.js runtime with npm and Python 3. The application is static; its local routing uses Web Workers and bundled data.

```sh
npm run build
npm start
```

Open `http://localhost:4173/`. Serve the complete `dist/` directory over HTTP; opening an HTML file directly with `file://` is not a supported start path. No separate legacy application needs to be started.

The build reads [`src/navigation/index.html`](src/navigation/index.html) and [`src/navigation/main.recovered.js`](src/navigation/main.recovered.js), copies their supporting modules, applies the existing guarded data/runtime repairs, and versions generated assets. [`dist/build-meta.json`](dist/build-meta.json) identifies the generated runtime.

### One UI, including historical URLs

[`scripts/navigation-entrypoints.mjs`](scripts/navigation-entrypoints.mjs) writes the same unified app shell to every retained HTML entry and removes retired standalone UI bundles. These URLs are compatibility entries, not separate products:

- `/` and `/index.html`: unified trip planning, canonical `/#home`
- `/area.html`: the same trip-planning UI; a supported `station` query opens its integrated station view
- `/metro.html`: integrated station 3D, canonical `/#station?station=ADM`
- `/research.html`: integrated data and usage information, canonical `/#info`

The app replaces the initial compatibility URL with its canonical route. Internal actions and browser history remain within the unified interface. Shared navigation models, geometry and routing Workers are retained. Do not restore the removed legacy page roots or make an old bundle the default entry.

## Deploy

Build with `npm run build` and publish the complete `dist/` directory. The tracked `.openai/hosting.json` identifies the existing Site; retain its project ID and audience when using the Sites source/package/publish workflow. There is no legacy UI deployment target. A build alone does not publish a new version.

## Included functionality

- Automatic walking, metro, bus and tram combinations, with an explicit option to include taxi connections
- Four passenger preferences: 普通出行, 行李 · 少搬运, 扶梯优先 and 升降机优先
- Whole-journey comparison covering modeled time, price, waiting, walking and transfers
- Collapsible production-formula controls: adjust five bounded weights, inspect each route’s score contributions and reset presets; changes rerank cached geometry without another search
- Parameters remain in memory unless “remember on this device” is enabled; clearing local data resets them
- Indoor multi-floor 3D, rotation, floor selection and exploded-layer views within the same application
- Local demonstration orders, simulated payments, account/privacy preferences and service controls

All quoted prices, booking inventory, taxi vehicles and orders are demonstrations. Timing mixes source-backed data with explicit modeling; this is not a live dispatch, ticketing or payment service. Real official data cover only the loaded subsets. A drawn station or a map extent does not establish complete connectivity, accessibility, live facility availability or the best route across Hong Kong.

The former strict-accessibility product mode was removed on 2026-10-13. Legacy saved selections and URLs migrate visibly to ordinary travel and require a fresh route where appropriate. Unknown wheelchair/facility suitability is not counted as a verified capability; the four remaining preferences make no wheelchair-accessibility promise. Source-backed ordinary paths and known physical facilities remain usable subject to their original prohibitions, direction and opening times. Original source evidence is retained, not changed to manufacture eligibility.

For example, MTR's Admiralty–Mong Kok reference is approximately **10 minutes between platforms**, with possible waiting and without station access time. It is shown only as a coverage/reference note; it does not insert the missing Tsuen Wan Line and Mong Kok indoor connections into this demo's graph. See [data sources and limitations](DATA-SOURCES.md).

## Checks and validation

```sh
npm test
node --test tests/navigation/unified-ui.test.mjs
node tests/navigation/run-intermodal-validation.mjs
node tests/navigation/four-preference-run.mjs
```

Run the build before tests that consume production `dist/` assets. The intermodal command writes diagnostic results. The four-preference runner defaults to a dry plan; add --run against a frozen runtime only when ready for its serial 16-cell real-point regression. These diagnostics can take substantially longer than unit tests.

The current four-preference point regression is recorded for [runtime 59ea6d932726](validation/four-preference-59ea6d932726-301671449fc3/REPORT.md). It covers exact Pacific Place floors and a covered cross-harbour station pair, with both taxi toggles; these exact endpoints have no verified taxi curb connector, so taxi success is not claimed.

Review [intermodal validation](validation/intermodal/) and the historical [five-preference validation](validation/preference-matrix/), including runtime identifiers and individual logs. Those older five-mode fixtures are retained for reproducibility, not current product options. A diagnostic timeout, pending refinement or partial run is not a pass and does not prove that no route exists. Node/DOM-stub and Worker tests do not establish mobile layout, actual browser rendering or device performance.

The [post-v38 investigation](validation/performance/POST-V38.md) separates source-index/cache improvements, exact endpoint failures, current point-matrix results, and the still-unfinished OD36 detailed search. See the historical [source-point matrix](validation/point-matrix/README.md) for its fixed seed, actual stop/exit/floor identities, five preferences, taxi toggle, and reproducible commands. The runner defaults to a dry plan; a diagnostic observation window never becomes a production routing cutoff.

[README-navigation.md](README-navigation.md) retains detailed implementation and historical investigation notes. Its dated results describe those particular builds; current entry-point behavior is defined here, and current validation evidence belongs to the matching runtime in `validation/`.

## Attribution

Map from Lands Department · © Government of the Hong Kong SAR. Government spatial data are obtained through the CSDI Portal. Taxi road data: © OpenStreetMap contributors, ODbL. Transport and operator sources retain their respective ownership and terms. See [DATA-SOURCES.md](DATA-SOURCES.md) for source-specific attribution, evidence and disclaimers.

### Pacific Place

The integrated mall model has five source-supported levels, existing XYZ passages/facilities and an explicitly selectable station-side F boundary. Floor slabs are schematic display envelopes; LG2 and unverified lifts are not invented. The modeled internal 10:00–22:00 access rule differs from station-side/tenant hours, so the UI offers an explicit time change or separately selected exterior endpoint. See [Pacific Place evidence and 24-case regression](validation/pacific-place/README.md).
