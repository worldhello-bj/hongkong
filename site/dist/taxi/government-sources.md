# Hong Kong government reference data

Checked 2026-10-11 UTC. The current roaming engine uses seeded synthetic vehicles and an OSM-derived driving graph. The government facility subset is reference material; it is not silently substituted into the routing graph.

## Downloaded facility snapshot

`government-data.json` contains only static public taxi facilities inside longitude 114.150–114.170, latitude 22.298–22.311. Full-source hashes, URLs, original feature counts and attribution are in the JSON. Both file endpoints returned HTTP 200 and valid GeoJSON.

- Taxi Stands: 518 features in the full source; [official metadata](https://portal.csdi.gov.hk/csdi-webpage/metadata/td_rcd_1697081907714_17556/html). Published update frequency: twice yearly.
- Taxi Pick-up & Drop-off Points: 275 full-source features; [official dataset](https://portal.csdi.gov.hk/csdi-webpage/dataset/td_rcd_1697082382328_14459).
- [CSDI terms](https://portal.csdi.gov.hk/csdi-webpage/doc/TNC) allow commercial and noncommercial reuse free of charge subject to their terms, source/IP attribution and other conditions. Data are supplied as-is; this is not a CC0 dataset.

### Important location and level distinctions

- Cultural Drive urban taxi stand: `[114.158912656, 22.3014982223]` (source OBJECTID 201). This supports the M+ vicinity anchor, not an exact B1 doorway or a proved 3D pedestrian connection.
- West Kowloon urban taxi stand: `[114.1655131514, 22.3048966398]`, explicitly **B2/F**. Nearby cross-harbour stand is also **B2/F**. Do not replace the G/F reserved fleet-taxi pickup with either point merely because it is close in plan view.
- The pickup/drop-off dataset labels B1 West Kowloon as **drop-off** in the location text even though its generic status says Taxi PU/DF. Preserve the more specific restriction; generic status is insufficient.
- [Transport Department's station guide](https://www.td.gov.hk/en/transport_in_hong_kong/land_based_cross_boundary_transport/access_to_hong_kong_west_kowloon_station/index.html) verifies reserved fleet-taxi stopping places outside Exit B on **G/F** and in the B2 car park; Austin has pedestrian connections to West Kowloon. Exact G/F bay coordinates were not established by the downloaded facility datasets.
- [M+ visitor guide](https://www.mplus.org.hk/en/plan-your-visit/) identifies its designated taxi pickup/drop-off access via Museum Drive to the B1 entrance. [September 2026 official museum map](https://webmedia.mplus.org.hk/documents/202609-mplus-map-en.pdf), PDF pages 4–5, identifies the Cultural Drive B1 entrance and the lift connecting it with the Artist Square entrance on G. A short planar gap alone does not establish a same-level walk connection.

## Government road network, available but not imported here

[Road Network (2nd Generation) official metadata](https://portal.csdi.gov.hk/csdi-webpage/metadata/td_rcd_1638949160594_2844/html) describes traffic direction, turn restrictions and stopping restrictions; it is updated monthly. Prefer it over a geometry-only centreline dataset for a future official-network import.

Verified published file API URL:
https://portal.csdi.gov.hk/csdi-webpage/file-api?dataset_id=td_rcd_1638949160594_2844&format=geojson&layer_name=CENTERLINE

The same metadata publishes TURN, VEHICLE_RESTRICTION, PROHIBITION, SPEED_LIMIT, NSR and PEDESTRIAN_ZONE layer URLs with the corresponding layer_name. These road layers were not downloaded or incorporated in this demo. Metadata identifies HK1980 Grid EPSG:2326 for the source dataset; inspect each export's actual coordinate representation before importing. Do not infer that a line intersection is an at-grade junction.

## Optional future live fleet data: documented, runtime blocked

[DATA.GOV.HK Amigo dataset](https://data.gov.hk/en-data/dataset/amigo-tis_41-taxi-fleet-information-amigo) says the data are owned/released by Amigo, with a 30-second update frequency. It is a government-catalogued operator dataset, not government-owned coverage of every Hong Kong taxi.

[Official API specification hosted by TD](https://www.td.gov.hk/datagovhk_td/taxi-fleet-information-amigo/Amigo_spec.pdf) was downloaded successfully (HTTP 200; 91,424 bytes). It documents:

- GET https://api.amigo.taxi/webx/v1/vehicle/list
- GET https://api.amigo.taxi/webx/v1/vehicle/nearby with lat, lng, radius, unit and count (max 200).
- Response fields: veh_id, taxi_type, passenger_cap, lat, long, time_stamp and op_status. Status values are occupied, vacant and no-service. time_stamp is data-received time in ISO 8601 with +08:00 offset. The specification states 6 decimal places and accuracy ±0.5% for coordinates; this is not a curb-precision guarantee.

Direct cloud GET checks on 2026-10-11 around 02:42 UTC returned HTTP 403, including the already-started request with an Origin header. No vehicle records were obtained or retained. No observed update freshness, response-time measurement or successful browser CORS behavior can be claimed. Do not bypass the denial or make the current demo depend on this service. A later authorized integration must verify ordinary access, CORS and freshness in its own environment before enabling a live mode.

[DATA.GOV.HK terms](https://data.gov.hk/en/terms-and-conditions) permit commercial/noncommercial reuse subject to attribution and their other terms; source ownership remains with Amigo. Linked services may also have their own terms. Retain this licensing distinction if adding operator data. For synthetic initialization, use coarse aggregate distributions if needed and synthetic vehicle IDs; do not publish individual current vehicle IDs or locations in Git.

This API does **not** document order origins/destinations, historical trip trajectories, previous-order ending time, or future availability. Those remain synthetic demo fields.

## Demand evidence and light randomness

[TCS 2022 final report](https://www.td.gov.hk/filemanager/en/content_5349/tcs2022_eng.pdf) is aggregate household travel-survey evidence, not a public per-taxi GPS/order log. No individual taxi OD download was verified in this research. Do not present uniform or hand-weighted random endpoints as an observed HK demand distribution.

Keep the small existing seeded pool. Sample initial positions and destination nodes from connected, taxi-usable road nodes or verified facility anchors; route over directed edges and respect turn restrictions. A completed leg becomes the next leg's start. Randomize departure offsets and modest speed multipliers with the same seed. Never generate independent random longitude/latitude points and join them across water or buildings. Existing active orders retain their endpoint and finish time; future pickup evaluates from that endpoint.
