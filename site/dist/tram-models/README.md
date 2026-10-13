# Official Hong Kong tram-stop vicinity meshes

Prepared for the existing 32-stop academic demo corridor. 21 shared, on-demand GLBs retain official Lands Department source geometry, textures, coordinate scale and orientation. These are spatial extracts of official infrastructure, not newly modelled or AI-generated shelters.

## Attribution
Map from Lands Department. Copyright Hong Kong SAR Government.
Official catalogue: https://data.gov.hk/en-data/dataset/hk-landsd-openmap-3d-visualisation-map-individualised-models
Public download API: https://3d.map.gov.hk/download-api
The Lands Department logo is included as landsd-logo.svg. No warranty of accuracy, completeness or fitness for purpose.

## Coverage and limitations
- All 32 existing TD stop IDs have geographic vicinity assets, shared across 21 groups. No extra corridor stops were invented.
- 18 group crops show raised canopy/platform-like source geometry in both textured and texture-free renders. The source mesh has no semantic shelter-to-stop ID join.
- Western Market (td:99140), Hillier Street (td:99213), and Macau Ferry Terminal (td:99211) have official street infrastructure but shelter geometry is not confirmed. Do not describe these three as complete shelter models. Generic and nearby individual-model candidates were also inspected; no substitute shelter was invented.
- Only selected source categories are shown. Excluded buildings or ground surfaces are not evidence of physical absence.
- Stop identity uses exact TD IDs in the existing GTFS-based app and independent official TD GeoJSON. Maximum coordinate difference is 1.437 m. Official point source: https://static.data.gov.hk/td/routes-fares-geojson/JSON_TRAM.json
- No safe walking access, accessibility certification, rail gauge, track topology, or current survey claim is derived from the visual models.
- HTTP Last-Modified dates are source-file metadata, not model capture dates.

## Coordinate and mesh contract
GLB is standard glTF 2.0: local X east, local Y source elevation, local Z south, in metres. Recover source HK80 (EPSG:2326) using E=X+originHK80[0], N=-Z+originHK80[1], H=Y+originHK80[2]. Original root matrices are preserved in manifest provenance and GLB extras. Node transforms are baked once; do not rotate again.

Each oriented envelope extends 55 m along and 16 m across each stop anchor. Opposite-direction stops may share one group crop. Interior source vertices are unchanged. Outer context triangles are clipped with interpolated source UVs. No collapse decimation is used: lossless indexing and UV-atlas reduction keep column/platform geometry.

Embedded JPEG/PNG textures have maximum dimension 1024. Transparent texture alpha is retained. UVs may be outside 0–1 for repeated textures: honor sampler wrap modes. REPEAT textures are power-of-two; NPOT atlas textures use CLAMP_TO_EDGE (WebGL1 should use LINEAR without mipmaps).

## Validation
validation.json records all 21 GLBs: headers/chunks/buffers, finite attributes, normalized normals, valid triangle indices, embedded image decoding, hashes and matching HK80 bounds. Blender imports and both textured/clay renders were checked. This asset QA does not claim the browser UI was tested.
