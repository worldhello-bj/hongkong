# Lightweight urban Hong Kong taxi demo

Browser-local ES modules; no booking server or live fleet. Random trips, waits and speeds are synthetic. The default 48 cars are a visual demo population, not an estimate of Hong Kong supply.

## Coverage and geography

The road network covers longitude 114.115–114.255, latitude 22.260–22.355: Hong Kong Island's north shore and the main Kowloon urban area. Actual OSM road polylines include Western Harbour Crossing, Cross-Harbour Tunnel and Eastern Harbour Crossing. Harbour travel uses road tunnels, never straight lines across the water.

The compact graph contains 24,219 nodes, 37,495 directed edges and 1,921 via-node turn restrictions. The outer bbox is an extent, not a promise that every point is covered; outlying northeast corners are clipped. `source-manifest.json` records every fetched tile.

The fleet initializes equally across four geographic zones: western/eastern Island and western/eastern Kowloon. Seeded random origins and destinations are chosen from connected road-node pools. Ongoing trips initially remain within a zone; subsequent roaming samples mostly local destinations with a 25% chance to sample from the full urban pool. Vehicles follow the resulting road route to its destination, then choose another destination.

`SCENE` remains an optional Austin / West Kowloon / M+ preset; it no longer bounds taxi coverage.

## API

```js
import {createTaxiSimulation, nearestRoadNode, COVERAGE} from './taxi/roaming.js';
const sim = createTaxiSimulation({seed:42, fleetSize:48, nowS:28800});
const pickup = nearestRoadNode([114.172,22.298]);
const dropoff = nearestRoadNode([114.159,22.283]);
// Both return {id, coordinate, distanceM, covered, approximate:true}.
const quotes = sim.offerQuotes({
  pickup,
  destination:dropoff,
  passengerReadyS:29100,
  nowS:28800,
  maxCandidates:12
});
const selected = sim.reserveQuote(quotes[0].id);
sim.prepareUntil(29400);
const fleet = sim.simulateAt(28900);
```

Coordinates use `[longitude, latitude]`; time uses seconds on the caller's simulation clock. `nearestRoadPoint` aliases `nearestRoadNode`. Generic snapping uses approximate curb candidates, excluding motorways/trunks, tunnels, bridges and foot=no roads; a result within 450 m has `covered:true`. It is not proof that stopping or the connector walk is legal, accessible or surveyed. The frontend must display a modeled connector and preserve the user's actual endpoint. Pass a node id to route an already selected road location.

Fleet size is configurable 6–72. `offerQuotes` first shortlists up to 12 vehicles by availability and a distance-based estimate, then calculates actual road routes for that shortlist; `maxCandidates:48` can request an exhaustive 48-car comparison. This is a simple demo heuristic, not globally optimal production dispatch.

Quotes include physical availability time/place, car arrival, passenger arrival, pickup time, passenger wait, vehicle wait, dropoff time, prior order, deadhead route and passenger route. Pickup is the later of passenger and car arrival. A occupied car finishes its previous trip. A roaming car completes its current road edge before diverting. Reserving a quote preserves existing order segments and locks one next trip; duplicate/stale reservations are rejected.

Four states: `roaming`, `existingorder`, `pickup`, `passengertrip`. No cancellation, fraud, live reoptimization or actual booking is modeled.

## Lightweight playback

Road geometry keeps all original bends while compressing nonjunction degree-two nodes into short polylines. Routing uses A* and a bounded 512-route cache. Initial playback precomputes at least five minutes; `simulateAt` performs binary search and polyline interpolation only, never routing. Call `prepareUntil(time + 300)` on coarse simulation steps, outside frame rendering. Preparation refills a small future window and trims history older than thirty minutes. No backwards scrub beyond retained history: reset with the same seed instead. `getPreparedRange()` exposes available times. Quote storage is capped at 96 entries; `getCars()` is for testing/debugging rather than animation.

Synthetic road speeds are 7 m/s urban, 12 m/s motorway/trunk and 4 m/s service roads. Random initial offsets span 0–20 seconds and small between-route delays 0–12 seconds. These are animation assumptions, not live ETAs or permission to wait at arbitrary curbs.

## Sources and reproduction

© OpenStreetMap contributors, ODbL: https://www.openstreetmap.org/copyright

Road snapshots were fetched 2026-10-11 through the official OSM map API, in small bbox tiles: https://api.openstreetmap.org/api/0.6/map . `osm-source.xml` retains driving ways, their geometry nodes and restriction relations; `build_graph.py` rebuilds `road-graph.js`. The raw source is for recovery and should not be deployed to the website.

The builder honors one-way, vehicle access and via-node turn restrictions, with taxi-specific access taking precedence. It excludes pedestrian paths, private/no-vehicle roads, parking aisles and driveways. Hong Kong left-driving road topology is retained without inventing lane offsets. Lane changes, conditional/via-way restrictions, live closures and traffic signals are not modeled. This is not turn-by-turn navigation.

Transport Department verifies prebooked fleet taxi stopping places outside West Kowloon Exit B at G/F, B2 stopping places, and pedestrian connections to Austin Station:
https://www.td.gov.hk/en/transport_in_hong_kong/land_based_cross_boundary_transport/access_to_hong_kong_west_kowloon_station/index.html

M+ verifies vehicle access via Museum Drive to the pickup/dropoff area and B1 entrance:
https://www.mplus.org.hk/en/plan-your-visit/

Preset coordinates are explicitly approximate road points, not surveyed bays. Didi research inspires pickup cost/destination/time as useful inputs only; this demo's advance connection reservation is a local extension, not a claim about Didi's system.

## Verification

Run `node tests/taxi/roaming.test.mjs` and `node tests/taxi/benchmark.mjs`. Tests cover reproducibility, random OD, initial spatial distribution, tunnel connectivity, preserved polylines, legal turns, ETA/wait feasibility, retained previous orders, continuous motion, reservations without overlap, and bounded/no-routing frame sampling. Copy only `roaming.js` and `road-graph.js` to `dist/taxi/`.

Final bounded-network benchmark (cloud Node, 2026-10-11; see `tests/taxi/benchmark-results.json`): in sequential 12/24/48-car runs, 48 cars initialized in 326 ms, sampled in 0.0126 ms per frame, and produced a 12-candidate quote set in 23 ms (cached repeat 0.18 ms). A separate fresh-process seed-42 run initialized 48 cars in 722 ms, including a cold bounded state pool and empty route cache but excluding module import/parse. The 12/24-car first-quote times were 146/50 ms, illustrating route/seed dependence. Four simulated hours retained at most 747 segments per vehicle. The graph module remains 11.4 MB raw / 2.16 MB gzip-equivalent. These measurements are environment-specific, not mobile guarantees.

All 13 taxi test groups pass. Additional fixed seeds 7, 42, 81 and 2026 each keep 48 cars and every synthetic/preloaded polyline vertex inside the showcase at 0/10/30/60 minutes, with no clipped-road stranded holds. Explicit outside trips retain continuous dropoff positions and can be rebooked without teleporting.

## Fixed fleet showcase boundary

`DEMO_FLEET_BOUNDS = [114.142,22.267,114.205,22.326]` fits inside the main map's illustrated background. It is the default `roamingBounds` option. Initial origins, synthetic previous orders, and every subsequent synthetic roaming route are constrained to this region. The bounded router filters every polyline vertex, so a route with both endpoints inside cannot briefly leave the boundary. This does not reduce the full road graph or explicit taxi request coverage.

An explicit requested pickup/passenger trip can leave this showcase using the full urban graph. If it finishes outside, the vehicle remains continuously at the dropoff point rather than teleporting into the showcase. Its state stays `roaming` (available), with `segment.waitingOutsideBounds: true`; this is a simulation hold, not a claim that parking is permitted. The car can take the next explicit request immediately. Rendering should show the wider road context for such a requested trip. Passing `roamingBounds:null` disables the showcase constraint.

The bounded synthetic pool is the largest strongly connected component of `(road node, incoming way)` states after removing out-of-bounds geometry. This incorporates both one-way streets and turn restrictions. Synthetic routes are kept inside that state component, preventing cars from reaching clipped one-way dead ends. Initialization and random destinations use its reachable curb-node pool. The full graph used for requested trips is unchanged.
