# Hong Kong MaaS

The single supported application is the compact, map-led navigation in [`site/`](site/). It includes whole-journey public transport/taxi comparison, four passenger preferences and indoor multi-floor 3D.

## Default start, build, test and deploy

Use Node.js 22+ and Python 3. No npm dependencies are required for the current static app.

```sh
npm run build
npm start
# http://127.0.0.1:4173/
npm test
```

Deploy only the generated `site/dist/` directory. For the existing Sites project, run its source/package/publish workflow from `site/` using `site/.openai/hosting.json`; preserve its identity and existing audience. Do not deploy `web/`. Building is not publication.

The existing demo URL is https://hongkong-maas-review.canvas22.chatgpt.site/ . See the PR/deployment evidence for the currently verified source commit, rather than assuming this branch is already live.

Legacy `/area.html`, `/metro.html`, and `/research.html` URLs load the same new shell and canonicalize into navigation/station/information views. Back/Forward stays in that shell. The retired standalone bundles are removed. Old `web/` source is historical research only; its default commands forward to the new app and its old HTML no longer mounts the former UI.

## Evidence and limitations

See [`site/README.md`](site/README.md), [`site/DATA-SOURCES.md`](site/DATA-SOURCES.md), and [`site/validation/`](site/validation/). Match results to `site/dist/build-meta.json`. Source geometry, modeled links, simulated schedules/vehicles/fares, official reference times and actual on-site measurements are distinct. This demo does not establish full-network optimality, official quotes, live dispatch, or currently usable accessibility.

The original Python API, routing research, collectors and historical frontend source remain available for reproducibility. They are not the default demo. Their original instructions are archived in [`docs/HISTORICAL-README.md`](docs/HISTORICAL-README.md); backend research tests remain in CI.

Government/CSDI, Transport Department and OpenStreetMap attribution and source-specific terms are retained. The repository code license does not supersede third-party dataset terms. The 25 MB raw OSM XML acquisition is omitted from this app import; its source manifest and derived road graph are included. Existing identical data blobs are reused rather than re-uploaded.

The retired strict-accessibility mode is no longer a product option. Old stored selections and links migrate explicitly to ordinary travel. Unknown facility suitability is never certified by choosing a preference; source-backed ordinary paths and their original restrictions remain intact.
