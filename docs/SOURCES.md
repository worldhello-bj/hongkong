# Sources and licensing

Source review and actual retrieval: 2026-10-09. `source-probes.json` records actual URLs, timestamps, byte counts, HTTP results and SHA-256. A received response is not automatically semantic success. `continuous-observation.json` separates business validity, source time and count for a short controlled observation. Raw data and PDF images are intentionally untracked.

| Source | Official reference | Use and limit |
|---|---|---|
| Lands Department CSDI | https://portal.csdi.gov.hk/csdi-webpage/apidoc/3d-indoor-mtr-station-map | Real venue/layer geometry for ADM, AUS and KOW; 5,000-record truncation guard. Does not itself prove walkable network connectivity. |
| LandsD indoor network | https://data.gov.hk/en-data/dataset/hk-landsd-openmap-3d-indoor-network | Actual ArcGIS layer 0 acquired: 1,396 ADM + 1,898 hub 3D segments, exact count and unique ID checked. Floor relations and official coded schema acquired. Semantic boarding-position/gate mapping remains a release gate. |
| LandsD route search | https://portal.csdi.gov.hk/csdi-webpage/apidoc/3d-pedestrian-route-search | Official independent route comparison entry point, not a guarantee of custom closure/access constraints. |
| MTR Next Train | https://data.gov.hk/en-data/dataset/mtr-data2-nexttrain-data | Actual responses for ADM EAL/TWL/ISL/SIL, AUS TML, KOW TCL/AEL. HTTP 200/status 0 is an error. `seq` is not a vehicle identity. |
| MTR contract | https://opendata.mtr.com.hk/doc/Next_Train_DataDictionary_v1.7.pdf | Fields and direction meanings reviewed. PDF not redistributed. EAL `timeType=A` is arrival, `D` departure. |
| KMB | https://data.gov.hk/en-data/dataset/hk-td-tis_21-etakmb | Actual stops, route directions, variants and predictions; no vehicle GPS or fares inferred. |
| Citybus | https://data.gov.hk/en-data/dataset/ctb-eta-transport-realtime-eta | Adapter provided. No claim of current hub mapping or continuous Citybus service validation. |
| MTR station layout | https://www.mtr.com.hk/en/customer/services/system_map.html | ADM/AUS/KOW official layout PDFs locally reviewed. No pixel-to-metre conversion. Images are not redistributed. |
| West Kowloon connections | https://www.highspeed.mtr.com.hk/en/guide/wek.html | Austin/Kowloon connecting footbridges or tunnels; exact route and times need audit. |
| West Kowloon processes | https://www.highspeed.mtr.com.hk/en/guide/process-departure.html | B1 verification and B3 procedures/deadlines, versioned separately from map. Queue times are assumptions. |
| GTFS specification | https://gtfs.org/documentation/schedule/reference/ | Local import semantics, over-24-hour service times and frequency distinction. No completed official HK GTFS network ingestion claim. |

## Terms and attribution

- CSDI terms: https://portal.csdi.gov.hk/csdi-webpage/doc/TNC
- LandsD Map API terms: follow the live terms link on the Map API documentation before deployment. The Map API documentation requires the Lands Department logo and copyright attribution on maps. The UI must show these when rendering official geometry. Do not claim operator endorsement.
- DATA.GOV.HK terms: https://data.gov.hk/en/terms-and-conditions
- MTR and bus operator current terms apply to their feeds; access, caching, redistribution and commercial use are different questions. This project stores live feed research responses locally and publishes retrieval metadata. Selected CSDI spatial data are distributed as dated gzip snapshots under the explicit distribution permission in the CSDI terms with ownership/source acknowledgment; protected MTR PDFs are not distributed.
- Application source uses the repository Apache-2.0 license. Third-party data and graphics are not relicensed under Apache-2.0. Dependency license inventory is derived from pinned Python/npm packages; MapLibre GL JS is BSD-3-Clause, FastAPI MIT, Uvicorn BSD-3-Clause, Pydantic MIT, HTTPX BSD-3-Clause, pytest MIT. Consult installed distributions for full notices.

## Specific graph evidence

ADM official layout reviewed: G entrance, L1 concourse, L2 platforms 3/4, L3 platforms 1/2, L4 interchange lobby, L5 East Rail 7/8, L6 South Island 5/6. Austin layout reviewed: platform 1 toward Tuen Mun and 2 toward Wu Kai Sha, concourse/exit lift connections; CSDI floor labels C and P. Kowloon layout reviewed: ground TCL concourse, TCL platforms 3/4 at L4; Airport Express 1/2 at L2 (visible geometry, not added as an invented same-paid-area route).

Abstract transfer nodes simplify those layouts. Their schematic x/y positions are original diagram coordinates. Route edges are not surveyed centre-lines. Lift endpoints, actual lift operation, opening hours, precise gates, accessible widths and footpath links require independent review. All are explicitly non-verified for strict accessibility. Station reference map centres are approximate viewing anchors, not entrances or user locations.

Official network service actually queried: https://portal.csdi.gov.hk/server/rest/services/common/landsd_rcd_1742809197336_78665/MapServer . The source `Direction` domain specifies +1 forward, -1 reverse, 0 both; `Enabled` 1 active, 2 disabled; `Location` 3 paid; `WheelchairBarrier` 1 barrier, 2 no barrier. These are source codes, not inferred values.
