# Hong Kong MaaS

香港道路—軌道一體化出行研究原型。獨立倉庫、獨立資料庫，覆蓋金鐘及柯士甸—香港西九龍—九龍枢紐。源計畫日期：2026-10-09。

**已實作可運行工程，不是已驗收的公眾導航服務。** 真實官方幾何、實時預測與人工研究路網分開管理。路網包含文件支持但未實測的連接及明確標示的待核驗接駁邊。所有步行／車內時長、頻率、排隊仍是研究參數；嚴格無障礙模式會拒絕未核驗條件，不保證實際可通行。票價未知，沒有購票、支付、出入境資格判斷或室內定位。

## Quick start

Python 3.12 and Node 22+ are recommended. No paid services or API secrets are needed.

```sh
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python scripts/build_model.py
python -m uvicorn app.main:app --host 127.0.0.1 --port 8081
# In another terminal:
cd web && npm ci && npm run dev -- --host 127.0.0.1 --port 5174
```

Open http://127.0.0.1:5174. API documentation: http://127.0.0.1:8081/docs. The committed normalized research topology works offline. Licensed, dated official geometry/network snapshots are bundled for offline reproduction. Fresh geometry and real historical feed replay use the explicit collection steps below. Live ETA requests are made only when requested in the running app. Do not bind to public interfaces without an authenticated HTTPS gateway and operational review.

```sh
python scripts/fetch_sources.py        # bounded station geometry + MTR + KMB reads
python scripts/fetch_network.py        # bounded real 3D indoor network + count checks
python scripts/build_bus_services.py   # official stop-specific services
python scripts/fetch_bus_patterns.py   # 12 operator/route/direction/variant patterns
python scripts/build_model.py         # immutable content-addressed build
python scripts/observe_sources.py     # explicit ~2-minute observation, then exits
```

Restart the API after rebuilding. Fresh source bodies stay in ignored `data/raw/`; selected openly licensed spatial snapshots are compressed in `data/official/` with their own notice; reproducible request URLs, hashes and reception times are in `docs/source-probes.json`. PDFs are linked/downloaded for local review only and are not distributed. The collector does not start a persistent monitor. Data use must comply with each operator’s current terms; see [sources and licensing](docs/SOURCES.md).

## What works

- Official CSDI WGS84 station levels, units, openings and amenities, plus 3,294 count-verified 3D pedestrian segments. The actual endpoint graph has 1,300 Admiralty and 1,777 hub nodes, with directed escalators, paid-area state, real metric lengths, closure filtering and conditional accessible walks. Its exact-3D joins do not connect planar crossings. Specific boarding-position/gate mappings still need independent review.
- A separate, explicitly schematic multimodal model describes the door-to-platform/rail/HSR research scenario. Geometry and schematic topology are never interchangeable.
- Direction-specific Admiralty platform topology, Austin TML and Kowloon TCL, documented West Kowloon public connections and staged HSR procedure model.
- Time-dependent routing with closure windows, whole-passage vs entrance semantics, legal waiting, paid-area re-entry constraints, stairs/lift preferences, unknown-access rejection and provenance on each leg.
- Bus stop sequence adapters and real ETA for KMB, MTR and Citybus. Twelve KMB route/direction/variant patterns are recorded; nine upstream bus legs are usable in the research graph. Multiple stands are never merged by name.
- Conditional bus→walk→MTR and Admiralty→Hung Hom→Austin→West Kowloon journeys. Running time/headway parameters are clearly estimated, not an official timetable. Arrival-only MTR predictions are not silently converted into departure events.
- HSR verification completion before D−30 minutes; gate opening D−15 and closing D−5, with independently configurable margins, queuing, security and immigration assumptions. Early arrival waits legally; equality is a boundary, not a guarantee.
- Live/stale/no prediction/upstream error/replay/simulated states; original source time, reception time and hashes preserved. Replay blocks future snapshots. Simulation never invents live ETAs.
- Anonymous queries by default. Saving requires an explicit flag and random owner token. Revision history, completed-leg preservation on replanning and owner-scoped deletion use a separate SQLite database.
- Versioned graph builds, source probes, exact dependency declarations, test suite and reproducible 360-case synthetic experiment.

## Verification

```sh
python -m pytest -q
python scripts/benchmark.py
cd web && npm run build
```

The 56 backend tests exercise all 30 plan Appendix C categories as software tests plus API/security boundaries. This is **not** the plan’s independent 60-OD route audit or Beijing regression. The upstream Beijing archive and data referenced by the plan were not supplied to this repository and are not fabricated. The graph is small; benchmark timings are not evidence of full-network performance.

## Architecture and evidence

- `app/`: FastAPI contracts, privacy-scoped SQLite persistence and service orchestration
- `adapters/`: MTR/KMB/Citybus normalization, local GTFS import, CSDI graph import contracts
- `routing/`: constrained multi-state route engine and replanning hysteresis
- `rules/`: sourced high-speed rail rules and explicit assumptions
- `scripts/`: collection, build, bounded observation and benchmarks
- `data/normalized/`: reviewable research model and operator mappings
- `web/`: interactive map, floors, route steps, ETA, HSR, sources and exports
- `docs/`: evidence, limitations, API notes, implementation traceability and measurements

See [implementation and open gates](docs/IMPLEMENTATION.md) and [API and algorithms](docs/API.md). The original 8-week / 120-person-day plan includes fieldwork, dual human review, long-running stability checks and legal/operational sign-off that a code delivery cannot truthfully substitute. Those gates remain visible rather than being marked done.

## Recorded static preview

The normal frontend talks to the local Python API. To regenerate the optional read-only static review bundle, start from the bundled official snapshots and run `python scripts/export_preview.py`, then `cd web && VITE_REPLAY_PREVIEW=1 npm run build`. Large network preview JSON files are generated locally and are not versioned; the smaller licensed source snapshots and generator are included. This mode does not run the Python journey planner or supply live ETA.
