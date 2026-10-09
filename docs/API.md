# API and algorithm notes

Start the backend and use `/docs` for the generated field-level OpenAPI specification. All business envelopes include `request_id`, `generated_at`, `as_of`, `model_version`, `data_state`, `warnings`, and `result`. Source generation, observation and reception timestamps remain separate. Official geometry endpoints return a GeoJSON FeatureCollection directly for MapLibre.

## Main endpoints

- GET `/api/v1/bootstrap`: research graph, venues, source state
- GET `/api/v1/venues?q=金钟`: simplified/traditional/English search
- GET `/api/v1/venues/ADM/model?level=L5`: schematic nodes and same-floor links
- GET `/api/v1/venues/ADM/geometry?layer=units&level=L5`: official geometry, only after source fetch
- GET `/api/v1/stops/ADM/departures?line=EAL&mode=LIVE`: official near-term information
- GET `/api/v1/bus/services`: verified route/direction/service-type/stop records
- GET `/api/v1/stops/3007D34FB91FB27E/departures?provider=KMB&route=601&direction=I&service_type=1`: exact-stop feed filtering; route must actually serve it
- POST `/api/v1/indoor-route` and `/api/v1/journeys/plan`: `{from_id,to_id,departure_at,preference,mode,closed_facilities,hsr_departure,queue_minutes,allow_provisional}`
- POST `/api/v1/hsr/check`: independent process scenario
- GET `/api/v1/sources/status`: current requested feed health, static references and explicit probe index

`mode=SIMULATED` returns no invented predictions. `mode=REPLAY&clock=...` cannot access a snapshot received after the virtual clock. Raw snapshots are downloaded locally, not shipped as evergreen realtime fixtures. Replay status remains visible even if a snapshot happens to be fresh relative to the virtual time.

## Saving and replan

Default planning does not persist personal itineraries. To save, set `save: true` and send an unpredictable `X-Journey-Token` of at least 24 characters. Keep that token private. It scopes GET/DELETE `/api/v1/journeys/{id}` and POST `/api/v1/journeys/{id}/replan`. The latter takes the same planning request plus `completed_legs`; completed records are preserved, and a new revision is added. This research token scheme is not multi-user production authentication.

Creating a stored simulation requires the configured `HK_ADMIN_TOKEN` in `X-Admin-Token`. Without configuration the endpoint is disabled. Ordinary route query closure parameters change only that calculation, never source data or operator systems.

## Time and cost

- Absolute timestamps use ISO-8601 with offsets. Naive UI dates are interpreted in Asia/Hong_Kong. GTFS 25:10 belongs to the original service day and resolves to next-day 01:10.
- Lengths remain null if unknown. Diagram scaling cannot change route times. A real imported metric length uses the requested walking speed; schematic edges have declared duration assumptions and cannot support empirical speed sensitivity claims.
- A channel with `open_rule.semantics=whole` must be completely traversed by closing. Entrance semantics only checks entry. Waiting needs `allow_wait=true` and is bounded to one hour.
- Fees remain null when unknown. No free/fare optimum is implied. No success probability is invented.
- High-speed rule timings live in `rules/hsr.json`. Queue completion, not arrival at a desk, is used. Both conservative margins must be strictly positive for conditional feasibility.

## Robustness

Fixed provider URLs, identifier validation, local-only default binding, no arbitrary URL/SQL/path API, bounded request body, parameter validation, finite numeric values, coalesced per-feed locks and small feed caches. Unavailable data yields structured error or estimated mode. Production deployment still requires authentication, hardened rate limiting/retention and HTTPS. Source histories in runtime should be pruned to the applicable terms and initial seven-day policy; use the cleanup script explicitly.

## Actual official 3D network

GET `/api/v1/network/ADM` or `/api/v1/network/HUB` lists true 3D endpoints (`id`, lon/lat/z, floor IDs) and coverage. GET `/api/v1/network/{region}/geometry` returns real centre-lines. POST `/api/v1/network/{region}/route` takes `{from_node,to_node,preference,closed_facilities,walk_speed}` and returns actual route geometry, metric distance, source-backed legs and independently estimated travel time. It does not snap a user-selected platform to the nearest polygon.

Coincident 3D endpoints are joined within the source's millimetre tolerance; intersections in 2D alone remain disconnected. Direction codes control moving facilities. Disabled edges and unresolved AccessTimeID rules are excluded. Paid-area exit and re-entry shortcuts are excluded. Paid-area changes are explicitly reported as gate mappings requiring confirmation. WheelchairBarrier code 2 level walks and ramps may be traversed conditionally; stairs and moving facilities without operating evidence are excluded. This is a source-based physical network, not audited turn-by-turn platform guidance. Region extraction boundaries and unknown controls remain visible.
