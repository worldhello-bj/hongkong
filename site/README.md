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

Build with `npm run build` and publish the complete `dist/` directory to your static host. A build alone does not publish a new version.

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

### Traffic simulation and next departures

The map starts an explicitly simulated 10× clock with road-graph taxis and metro, bus and tram vehicles. The map fleet is independent of the “include taxi” trip-planning option. Pause or advance the clock from the map; background tabs, station/mall views and navigation pause sampling without wall-clock catch-up. Reduced-motion preference starts paused. The visible “全局模拟时间” controls seek one global Hong Kong clock. The date/time fields mirror playback and one-minute advances, including midnight rollover; they are not an independent future-departure clock. Editing pauses the clock and invalidates old route/quote snapshots. Trip planning freezes and captures the clock at the click, including while data are loading. Routes, transit vehicles, next departures, taxi quotes and simulated order expiry all read this source. Each result retains an immutable planning snapshot; changing the global clock never changes that old snapshot into a new result. Playing or stepping after a result clears it before the clock moves; returning home without changing conditions keeps the selected route and offers a resume button. Endpoint, preference and taxi-policy edits invalidate routes while preserving the current traffic clock and fleet.

Vehicles and station next-departure cards use the same `fastPublicRouter.network` patterns as route planning. Metro uses the existing official first/last-service windows with the existing **6-minute headway and 7-minute interval demonstration assumptions**, not an official individual-train timetable or live feed. Bus movement uses the loaded road shape and headway estimates; tram uses the loaded stop-order schematic shape. Missing modes/routes/stations are not manufactured. Next-arrival cards show direction and subsequent services, with simulation labeling.

Traffic animation samples at 10 updates/second, keeps SVG nodes, culls offscreen vehicles and bounds public vehicle display to 160. Timetable sampling never extends routes; the separate 48-taxi simulation retains its existing one-way/turn restrictions, seeded previous orders, quote and reservation sequence. Sampling and visualization do not modify source graphs or calendars. See `validation/traffic-restoration/` for runtime-specific checks and limitations.

The four compact map-layer buttons independently show/hide metro, bus, tram and taxi markers. Changing the taxi trip-planning preference preserves the simulation time, fleet state and viewport. Leaving 3D guidance for planning and reopening the unchanged journey preserves its current instruction and progress; a genuinely new journey still starts at its beginning.

Explicit departure date/time changes also choose a deterministic 48-taxi demonstration scenario. A bounded 120–300-second warm-up uses the existing directed road graph and prior-order rules; it makes locations, busy vehicles and quotes differ without pretending to be live traffic or a continuous replay of one fleet throughout a day. Selecting the identical date/time reproduces that scenario. Ordinary ticking and route-policy toggles retain its continuous road movement and reservations. Public transport continues to use only the existing loaded calendars, windows and modeled headways. Different waits and scores can retain the same winning route. See `validation/departure-time/` for the repeated-OD checks.

The taxi detail panel has no second playback/step controls. Opening-hours shortcuts seek the global clock, while ordinary view/history navigation does not rewind it. Seek revisions reject late fleet loading and routing completion from an earlier clock position. See `validation/global-clock/` for the single-source, seek-race, paused-consumer and order-expiry checks.

### 西九龙—福田高铁联程示范

新增可搜索的香港西九龙/深圳福田站、双向高铁图层、发车站点卡及三个一键联程示例。高铁、香港侧公共交通、办理手续和换乘均读取唯一 `trafficClock`；规划快照不随播放漂移，重新选时会使旧结果失效。高铁通过独立适配器接入原规划流程，香港侧仍使用原真实路网/Worker，并保留楼层、设施偏好、覆盖与临时关闭校验。

- 班次取自港铁 2026-10-11 起适用的一般时刻表，2026-10-13 核验，含 52 条北行/60 条南行常规记录。车程按每车实际参考时长 14–16 分钟；周六附加班次未纳入。
- 官方一般查询没有出行日选择；将普通记录重复到模拟日期只是模型假设，不代表该日必开、余票或实时定位。站点卡区分“下一班发车”与“办理手续后最早可规划班次”。
- 北行在西九龙办理两地出入境；南行在抵达西九龙后办理。北行到站至少提前 45 分钟，福田出发预留 30 分钟，抵港手续预留 45 分钟均为明确模型缓冲；同时检查站点开放/关口窗口及检票截止。
- 香港侧精细路网缺少柯士甸 C 通道。联程复用已核验月台节点的实际规划，再加 10 分钟站际概览模型（官方两站步行参考约 4 分钟，另 6 分钟内部缓冲）。不补画 C 通道、高差或无障碍路线。
- 高铁站点质心及轨迹为两点示意，非实测轨道。高铁票价、余票及真实订单未接入；路线可演练，但不计作已知费用评分，也不生成跨境车票。
- 客户端车辆模型缓存有界的日历/服务日窗口，逐帧位置仍计算；热采样不重复扫描日历，未改车辆位置或班次结果。

核验入口：[北行时刻](https://www.highspeed.mtr.com.hk/en/trip-planner.html?id=WEK2FUT)、[南行时刻](https://www.highspeed.mtr.com.hk/en/trip-planner.html?id=FUT2WEK)、[官方短途表](https://www.highspeed.mtr.com.hk/res/pdf/short-haul-train-timetable.pdf)、[服务指南](https://www.highspeed.mtr.com.hk/res/pdf/Service_Guide_EN.pdf)、[柯士甸站图](https://www.mtr.com.hk/archive/ch/services/layouts/aus.pdf)、[离港流程](https://www.highspeed.mtr.com.hk/en/guide/process-departure.html)、[抵港流程](https://www.highspeed.mtr.com.hk/en/guide/process-arrival.html)、[西九龙开放时间](https://www.highspeed.mtr.com.hk/en/about/wek.html)、[海关管制站时间](https://www.customs.gov.hk/en/service-enforcement-information/passenger-clearance/contact-us/index.html?print=1)。
