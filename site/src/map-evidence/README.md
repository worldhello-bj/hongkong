# Viewport map display sources and limits

Checked 2026-10-13. The display layer does not contribute route edges, station portals,
opening times, connectivity or facility capability evidence.

- Lands Department Topographic Map API: https://portal.csdi.gov.hk/csdi-webpage/apidoc/TopographicMapAPI
- Lands Department Map Label API: https://portal.csdi.gov.hk/csdi-webpage/apidoc/MapLabelAPI
- CSDI terms: https://portal.csdi.gov.hk/csdi-webpage/doc/TNC
- Raster requests use the documented `v1.0.0/xyz/basemap/WGS84/z/x/y.png` and
  `v1.0.0/xyz/label/hk/sc/WGS84/z/x/y.png` endpoints. No key or account is used.
- The public docs require Lands Department logo and copyright attribution on the
  map, and prohibit large bursts of requests. Both remain visible in the app.
- CSDI terms permit free commercial/noncommercial browsing, download and reproduction
  subject to their attribution, intellectual-property, disclaimer and other conditions.
  No full-territory mirror or bulk offline download is implemented.
- A public Admiralty reference tile, z17/x107102/y57211, was checked as a 256x256 PNG
  with CORS `Access-Control-Allow-Origin: *`. Its bounds contain 114.165,22.279.
  Standard XYZ Mercator tile corners are converted into the application's existing
  local longitude/latitude projection. Adjacent tile boundaries are numerically shared.
  Within each small tile, the raster is stretched between those exact bounds;
  this cartographic approximation is never used for route geometry or distances.
- Requests use no credentials or referrer, at most four concurrent requests and a
  minimum 85 ms start spacing. New views debounce 120 ms. Only visible cells and a
  bounded adjacent margin are selected; old requests are cancelled. Individual
  failures cool down and expose explicit retry, with older/coarse local map fallback.
- Object URLs and decoded-image estimates are bounded to 96 tiles on narrow views
  (24 MiB RGBA estimate) or 144 on desktop (36 MiB estimate), excluding browser/GPU
  overhead and the independently loaded indoor model. Cache entries are memory-only;
  standard browser HTTP cache follows the provider's response headers.
- Existing Admiralty display geometry is byte-preserved in `dist/map-detail/admiralty.json`,
  formerly embedded in the mobile navigation module. It is now fetched only for that
  local detailed view or station/navigation context. SVG, canvas and building-height
  indexes are constructed after that request; the routing data do not depend on it.
- Plain roads/buildings can be shown beyond the routing graph's surveyed coverage.
  The app continues to disclose route/indoor coverage separately and never fabricates
  connecting paths from visible map features.
