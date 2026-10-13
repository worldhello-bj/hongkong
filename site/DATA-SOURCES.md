# Data sources, attribution and limitations

This demo combines official snapshot data, OpenStreetMap-derived roads and explicitly modeled behavior. Their ownership and reuse conditions differ. This document records provenance; it does not grant a new blanket license over third-party material or claim that a reachable public URL makes every response freely redistributable.

## Government / CSDI spatial data

**Attribution: Map from Lands Department · © Government of the Hong Kong SAR. Source: Government of the Hong Kong Special Administrative Region and the CSDI Portal.** Intellectual property remains with the Government and the relevant data-owning organisations.

Primary references:

- [Lands Department 3D Indoor MTR Station Map API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/3d-indoor-mtr-station-map)
- [CSDI terms and conditions](https://portal.csdi.gov.hk/csdi-webpage/doc/TNC)
- [Stored source/probe records](dist/preview/sources.json)
- [Current station model and routing coverage](dist/preview/station-model-coverage.json)

The station API supplies source station layouts, floors, units and associated indoor features. The API notice requires the Lands Department logo on the map and its copyright attribution. Preserve these alongside the Government/CSDI source identification when distributing or displaying the data. Reuse remains subject to the published terms, intellectual-property notices and any relevant provider conditions; these data are not labelled CC0 by this project.

Government/CSDI data are supplied as available, without a warranty of completeness, accuracy, timeliness or suitability for a particular use. Their notices disclaim Government/provider responsibility for loss or damage arising from reliance on the data. Consult the linked original notices for the full conditions. This independently developed demo is not an official Government or transport-operator service or endorsement.

### Indoor geometry and Hung Hom preservation evidence

The retained station JSON files are under [`dist/preview/`](dist/preview/); routing graphs are under [`dist/area/`](dist/area/). Source geometry, route connectivity and modeled access are distinct evidence layers. A floor polygon alone does not establish a walkable connection, opening hours, wheelchair eligibility or current lift operation. XYZ values retain source elevation; they are not automatically floor height or depth below ground.

The Hung Hom floor geometry has the following preservation record:

- File: [`dist/preview/geometry-HUH-levels.json`](dist/preview/geometry-HUH-levels.json)
- Size: **132,679 bytes**
- SHA-256: `b37464f575d0f859d996e977d195c83e8261f631615c92834680f6963bc877b5`
- Audit reference: matched to the official WFS response and the published source baseline `d75c82b497cc92729140230beb18b7b4adfa81e8`; the local file's size and SHA-256 were independently rechecked on 2026-10-12

This verifies that particular file's identity and provenance. It does not certify every station connection or current physical conditions. Separate source-backed endpoint evidence is retained in [`src/station-evidence/huh-b2-lift.json`](src/station-evidence/huh-b2-lift.json).

### Outdoor pedestrian network and map context

The pedestrian expansion uses the Lands Department [CSDI PedestrianRoute layer](https://portal.csdi.gov.hk/server/rest/services/common/landsd_rcd_1637222018065_52265/MapServer/0). Acquisition bounds, page URLs, retrieval timestamps, byte sizes and hashes are recorded in the [acquisition manifest](src/walk-evidence/visible-rectangle-acquisition.json); the [source schema](src/walk-evidence/pedestrian-source-schema.json), [expansion audit](src/walk-evidence/visible-rectangle-audit.json) and [reproduction notes](src/walk-evidence/README.md) explain the transformation.

The imported subset is bounded. An enclosing rectangle is not a guarantee that every building, entrance, road crossing or accessible connection inside it is represented. Background water/vegetation and the detailed Admiralty building/surface layers provide visual context; their presence never creates route edges or certifies that a passage is usable. Preserve their Lands Department/Government attribution.

## Public transport data and operator references

[`dist/transit/services.json`](dist/transit/services.json) records these timetable/stop sources:

- Transport Department [public transport headway GTFS archive](https://static.data.gov.hk/td/pt-headway-en/gtfs.zip), with archive date `2026-09-30` in the bundled metadata
- Transport Department [Chinese stop names](https://static.data.gov.hk/td/pt-headway-sc/stops.txt)
- [Hong Kong Tramways](https://www.hktramways.com/) for operator advisory context

Attribute government-published transport data to the Transport Department, the Government of the Hong Kong SAR and DATA.GOV.HK, with the relevant organisations retaining their intellectual property. Their [DATA.GOV.HK terms](https://data.gov.hk/en/terms-and-conditions) apply alongside any dataset/provider-specific conditions. The data carry no promise of accuracy, completeness, timeliness or fitness for a particular journey.

The bundled service warnings are material: departures are simulated from headways, intermediate stop and dwell times are estimates, and vehicle locations are simulated. Tram line drawing can be schematic. Historical advisory text in a snapshot is not confirmation of today's operating status.

[`dist/preview/sources.json`](dist/preview/sources.json) also records historical MTR schedule and KMB route/stop/ETA probes with original URLs and timestamps. Those snapshots do not make the current planner a live ETA service. MTR, KMB and Hong Kong Tramways remain separate source owners; government terms are not assumed to license every directly linked operator response.

### Admiralty–Mong Kok: reference only

MTR's journey-planner responses for [ADM → MOK](https://www.mtr.com.hk/share/customer/jp/api/HRRoutes/?o=2&d=6&lang=E) and [MOK → ADM](https://www.mtr.com.hk/share/customer/jp/api/HRRoutes/?o=6&d=2&lang=E) were checked on 2026-10-12 and reported approximately **10 minutes, without a transfer**. This is a weekday-peak platform-to-platform estimate, includes possible waiting and excludes entry/exit access. It is not a door-to-door promise.

[`src/navigation/rail-reference.js`](src/navigation/rail-reference.js) uses that fact and source link solely to disclose a coverage gap. It does **not** add synthetic Tsuen Wan Line edges, invent Mong Kok station access, shorten existing route durations, or count the reference as a computed candidate. Comparisons in the loaded network must not be described as optimal across the full MTR network.

An open redistribution license for the complete internal `HRRoutes` response has not been established. This project cites the limited factual reference and link; it does not redistribute the complete response under a claimed open-data license.

### Station and mall evidence

Official MTR station/accessibility maps and the ELEMENTS L1 map support specific facility relationships documented in [`src/station-evidence/kow-c1-modeled-corridor.json`](src/station-evidence/kow-c1-modeled-corridor.json). Exact corridor turns, widths, clearances and current operation remain unverified. The supplemental corridor stays explicitly modeled; citing these maps neither makes the modeled line official nor creates a general redistribution license for the source images/PDFs.

## Taxi roads and facilities

The driving graph is derived from OpenStreetMap, not from a newly imported government road network. Attribution: **© OpenStreetMap contributors**. The [source manifest](src/taxi/source-manifest.json) records the official OSM map API tiles and retrieval date. OSM data are covered by the [Open Database License](https://opendatacommons.org/licenses/odbl/1-0/); retain attribution and applicable database sharing obligations described on [OpenStreetMap's copyright page](https://www.openstreetmap.org/copyright). This is separate from CSDI and operator terms.

The [taxi government-source notes](src/taxi/government-sources.md) and [facility snapshot](src/taxi/government-data.json) document Transport Department taxi stands and pickup/drop-off facilities, with source URLs and restrictions. These are static reference facilities, not live fleet locations or proof of a same-level pedestrian approach. The notes distinguish B1/B2/G/F access and identify government road layers that were researched but not imported.

The current fleet, orders, availability, pickup forecasts and fare calculations are synthetic demonstrations. The researched Amigo service did not yield vehicle records; its catalogue listing is not evidence of a working live integration. No observed personal taxi trajectories or real order histories are claimed.

## Prices, modeled routes and validation

All displayed prices are **demo estimates, not actual operator quotes, official fare commitments or payable charges**. Source-backed schedules and geometry do not validate simulated pricing. Ranking weights represent the application's comparison policy, not measured passenger preferences or a guarantee of the cheapest/fastest real journey.

Modeled connectors and facility-dependent alternatives retain uncertainty labels. Strict-accessibility results and separately marked accessibility demonstrations must be read with their evidence fields; neither a 3D model nor a successful algorithm result certifies a currently step-free trip.

See [intermodal validation](validation/intermodal/), [preference-matrix validation](validation/preference-matrix/) and the [root run/check instructions](README.md#checks-and-validation). Match reports to `dist/build-meta.json`. Unfinished runs, pending refinement and diagnostic watchdogs must remain distinguishable from completed checks. Runtime tests do not establish browser visual quality or actual on-site accessibility.

## Exhibition Centre B3: exact official boundary composition

The build imports only official indoor features 1001097474 and 1000805010 from the existing station graph into the area graph, using the exact shared XYZ endpoint of outdoor footbridge 290046359. It adds two nodes, four directed physical edges and the original B3 portal. Existing floor/elevation geometry, source restrictions, amenity identity and portal coordinates are preserved; the 1.6 m source elevation change is not flattened. No paid-area bypass, new rail stop or wheelchair-accessibility guarantee is introduced.

Raw official extracts, SHA-256 pins and acquisition URLs are retained in `scripts/data/exc-b3-boundary/`. The importer revalidates both source records and the exact outdoor boundary, including repeated builds. See [Lands Department indoor network](https://portal.csdi.gov.hk/server/rest/services/common/landsd_rcd_1742809197336_78665/MapServer/0), [pedestrian network](https://portal.csdi.gov.hk/server/rest/services/common/landsd_rcd_1637222018065_52265/MapServer/0), and [CSDI terms](https://portal.csdi.gov.hk/csdi-webpage/doc/TNC). Map from Lands Department · © Government of the Hong Kong SAR. These source records do not certify current opening, slope usability or facility operation.

The existing 272 walk-cache records are preserved verbatim as JSON data and rebound only after a checked single-attachment, non-snappable, nonnegative-cost leaf-addition proof. All prior nodes, edges, portals and other graph metadata must remain equal; every new node must belong to that one attachment. This does not introduce a new B3 cache record or disable the runtime graph-version guard. Multiple attachments, projection eligibility, changed old records or unknown cache versions fail closed and require regeneration or new evidence.
