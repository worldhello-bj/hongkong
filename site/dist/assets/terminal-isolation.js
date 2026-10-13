/**
 * Conservative terminal cut for the reviewed exact-single-source-node public router.
 * null means UNKNOWN: run the unchanged routers. Never call this from a timeout.
 * All source edges (including disabled/closed/paid/service/scheduled edges) enter
 * the directed reverse union. This is deliberately wider than any actual route.
 * No source graph is copied. Only a bounded terminal closure and anchor IDs live
 * here. The bound limits this optimization; exceeding it never means NO_ROUTE.
 */
export const TERMINAL_RESOLVER_POLICY_ID = 'hongkong-public-terminal-ingress-v1';
const MODES = ['metro', 'bus', 'tram'];
const NEEDS = ['ordinary', 'luggage', 'escalator', 'lift'];
const FACILITIES = new Set(['stairs', 'escalator', 'lift', 'stairlift', 'travelator']);
const MAX_CLOSURE = 128;
const string = value => typeof value === 'string' && value.length > 0;
const coords = value => Array.isArray(value) && [2, 3].includes(value.length) && value.every(Number.isFinite);
const equal = (a, b) => coords(a) && coords(b) && a.length === b.length && a.every((v, i) => v === b[i]);
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !value.startsWith('0000-') && Number.isFinite(Date.parse(value + 'T00:00:00Z'))
  && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
const exact = point => point && string(point.id) && string(point.node_id) && point.node_ids === undefined
  && !point.floorId && !point.namedPlaceId && !point.demoSourceCoordinates && coords(point.coordinates)
  && point.coordinates.length === 3 && point.lon === point.coordinates[0] && point.lat === point.coordinates[1];
// Generators keep the proof pure and allow the UI driver to yield between
// bounded chunks. Their yields are progress boundaries, never partial answers.
const CHUNK = 2048;
function createCheckpoint() {
  let records = 0, started = performance.now(), resumed = false;
  return () => {
    // Start the next WORK slice after resumption. Browser task/timer waiting
    // must not consume its 4 ms budget and collapse it to 64 records per yield.
    if (resumed) { started = performance.now(); resumed = false; }
    ++records;
    if (records % 64 !== 0) return false;
    const now = performance.now();
    if (records < CHUNK && now - started < 4) return false;
    records = 0; resumed = true; return true;
  };
}
function* immutable(graph, checkpoint) {
  if (!Object.isFrozen(graph) || !Object.isFrozen(graph.nodes) || !Object.isFrozen(graph.edges)
    || !Object.isFrozen(graph.portals)) return false;
  for (const node of graph.nodes) {
    if (!Object.isFrozen(node) || !Object.isFrozen(node.coordinates)) return false;
    if (checkpoint()) yield;
  }
  for (const records of [graph.edges, graph.portals]) for (const record of records) {
    if (!Object.isFrozen(record)) return false;
    if (checkpoint()) yield;
  }
  return true;
}
function* graphShape(graph, checkpoint) {
  if (!graph || graph.schema_version !== 1 || !string(graph.version)
    || !['nodes', 'edges', 'portals', 'regions'].every(key => Array.isArray(graph[key]))) return false;
  for (const n of graph.nodes) {
    if (!string(n.id) || !string(n.region_id) || !coords(n.coordinates)) return false;
    if (checkpoint()) yield;
  }
  for (const e of graph.edges) {
    if (!string(e.id) || !string(e.from_id) || !string(e.to_id) || !string(e.kind)
      || typeof e.snap_eligible !== 'boolean' || !['official','schematic','none'].includes(e.geometry_mode)) return false;
    if (checkpoint()) yield;
  }
  for (const p of graph.portals) {
    if (!string(p.id) || !string(p.node_id) || !coords(p.coordinates)) return false;
    if (checkpoint()) yield;
  }
  return true;
}

/** The result deliberately admits every base portal and every rail target, even
 * unserved ones. It also admits both legacy/canonical portal identities, all raw
 * public and cached endpoints, and cached exact snapped endpoints. Public XY
 * stops enter a walking graph only by outdoor projection, checked separately.
 */
function* ingressAnchors({area, station, detail, services, walkLinks}, graphs, checkpoint) {
  if (!services || services.version !== 1 || services.timezone !== 'Asia/Hong_Kong'
    || !['stops', 'patterns', 'connections'].every(k => Array.isArray(services[k]))
    || !walkLinks || walkLinks.graph_version !== area.version || walkLinks.services_version !== services.version
    || walkLinks.preference !== 'fast' || !Array.isArray(walkLinks.connections)) return null;
  const ids = new Set(), exactNodes = new Set();
  for (const p of area.portals) { ids.add(p.id); exactNodes.add(p.node_id); }
  for (const node of area.nodes) { if (node.id.startsWith('RAIL:')) ids.add(node.id); if (checkpoint()) yield; }
  for (const stop of services.stops) {
    if (!string(stop.id) || !coords(stop.coordinates) || stop.coordinates.length !== 2
      || stop.node_id !== undefined || stop.node_ids !== undefined || stop.floorId !== undefined) return null;
    ids.add(stop.id);
  }
  for (const pattern of services.patterns) {
    if (!MODES.includes(pattern.mode) || !Array.isArray(pattern.stops)) return null;
    for (const call of pattern.stops) { if (!string(call.stopId)) return null; ids.add(call.stopId); }
  }
  for (const connection of [...services.connections, ...walkLinks.connections]) {
    if (!string(connection.fromId) || !string(connection.toId)) return null;
    ids.add(connection.fromId); ids.add(connection.toId);
    for (const side of ['origin', 'destination']) {
      const snapped = connection.route?.['snapped_' + side];
      if (snapped?.node_id !== undefined) {
        if (!string(snapped.node_id)) return null;
        exactNodes.add(snapped.node_id);
      }
    }
  }
  if (walkLinks.station_access_points !== undefined && !Array.isArray(walkLinks.station_access_points)) return null;
  for (const point of walkLinks.station_access_points ?? []) {
    if (!string(point.id) || !coords(point.coordinates) || !Array.isArray(point.platform_ids)
      || point.node_id !== undefined || point.node_ids !== undefined) return null;
    ids.add(point.id);
    for (const id of point.platform_ids) { if (!string(id)) return null; ids.add(id); }
  }
  // CanonicalStationEndpoint can change a legacy portal's node, but cannot
  // resolve outside these source records. Keep every matching version.
  for (const graph of graphs) {
    if (graph.station_targets !== undefined && (!graph.station_targets || typeof graph.station_targets !== 'object')) return null;
    for (const targets of Object.values(graph.station_targets ?? {})) {
      if (!targets || typeof targets !== 'object') return null;
      for (const target of Object.values(targets)) {
        if (!string(target?.node_id)) return null;
        exactNodes.add(target.node_id);
      }
    }
    for (const portal of graph.portals) if (ids.has(portal.id)) exactNodes.add(portal.node_id);
    for (const node of graph.nodes) { if (ids.has(node.id)) exactNodes.add(node.id); if (checkpoint()) yield; }
    // Admit endpoints of every declared modal connection, regardless of its
    // eligibility or whether current endpoint aliasing would select it.
    for (const edge of graph.edges) {
      if (['rail', 'metro', 'bus', 'tram', 'transfer', 'station_access'].includes(edge.kind)) {
        exactNodes.add(edge.from_id); exactNodes.add(edge.to_id);
      }
      if (checkpoint()) yield;
    }
  }
  return exactNodes;
}

function* graphsConsistent(graphs, checkpoint) {
  // Temporary indexes retain source references, never clone a graph.
  const union = new Map();
  for (const graph of graphs) {
    const ids = new Set(), edges = new Set();
    for (const node of graph.nodes) {
      if (ids.has(node.id)) return false;
      ids.add(node.id);
      const previous = union.get(node.id);
      if (previous && !equal(previous.coordinates, node.coordinates)) return false;
      union.set(node.id, node);
      if (checkpoint()) yield;
    }
    for (const edge of graph.edges) {
      if (edges.has(edge.id) || !ids.has(edge.from_id) || !ids.has(edge.to_id)) return false;
      edges.add(edge.id);
      if (checkpoint()) yield;
    }
  }
  return true;
}

// Modal data are small, mutable application objects. Validate their exact
// ingress-relevant fields at both ends of a cooperative proof. A mid-proof
// mutation invalidates this attempt rather than mixing two source snapshots.
function anchorRevision({services, walkLinks, area, station, detail}) {
  try {
    const endpoints = rows => rows.map(row => [row.fromId,row.toId,row.route?.snapped_origin?.node_id,row.route?.snapped_destination?.node_id]);
    return JSON.stringify([services.version,services.timezone,services.stops.map(p=>[p.id,p.coordinates,p.node_id,p.node_ids,p.floorId]),
      services.patterns.map(p=>[p.mode,p.stops.map(s=>s.stopId)]),endpoints(services.connections),
      walkLinks.graph_version,walkLinks.services_version,walkLinks.preference,endpoints(walkLinks.connections),
      walkLinks.station_access_points?.map(p=>[p.id,p.coordinates,p.platform_ids,p.node_id,p.node_ids]),
      [area,station,detail].map(g=>g.station_targets)]);
  } catch { return null; }
}

// Capture only small modal ingress fields before the first cooperative yield.
// No cached route geometries or source graph arrays are cloned. This prevents
// ABA changes (an anchor removed then restored) from disappearing during a pass.
function captureIngress({services, walkLinks}, graphs) {
  try {
    const bounded = rows => Array.isArray(rows) && rows.length <= 4096;
    if (!services || !walkLinks || !bounded(services.stops) || !bounded(services.patterns)
      || !bounded(services.connections) || !bounded(walkLinks.connections)
      || walkLinks.station_access_points !== undefined && !bounded(walkLinks.station_access_points)) return null;
    const stops=services.stops.map(p=>{
      if (!p || !coords(p.coordinates) || p.coordinates.length!==2 || p.node_id!==undefined || p.node_ids!==undefined || p.floorId!==undefined) throw Error('Unknown stop anchor');
      return {id:p.id,coordinates:p.coordinates.slice()};
    });
    const patterns=services.patterns.map(p=>{
      if (!p || !bounded(p.stops)) throw Error('Unknown pattern anchors');
      return {mode:p.mode,stops:p.stops.map(s=>({stopId:s?.stopId}))};
    });
    const connections=rows=>rows.map(c=>({fromId:c?.fromId,toId:c?.toId,route:{
      snapped_origin:{node_id:c?.route?.snapped_origin?.node_id},snapped_destination:{node_id:c?.route?.snapped_destination?.node_id}
    }}));
    const access=walkLinks.station_access_points?.map(p=>{
      if (!p || !coords(p.coordinates) || !bounded(p.platform_ids) || p.node_id!==undefined || p.node_ids!==undefined) throw Error('Unknown station access');
      return {id:p.id,coordinates:p.coordinates.slice(),platform_ids:p.platform_ids.slice()};
    });
    const targets=graphs.map(g=>{
      if (g.station_targets===undefined) return undefined;
      if (!g.station_targets || typeof g.station_targets!=='object' || Array.isArray(g.station_targets)) throw Error('Unknown station target');
      return Object.fromEntries(Object.entries(g.station_targets).map(([region,entries])=>{
        if (!entries || typeof entries!=='object' || Array.isArray(entries)) throw Error('Unknown station target');
        return [region,Object.fromEntries(Object.entries(entries).map(([key,t])=>[key,{node_id:t?.node_id}]))];
      }));
    });
    const snapshot={services:{version:services.version,timezone:services.timezone,stops,patterns,connections:connections(services.connections)},
      walkLinks:{graph_version:walkLinks.graph_version,services_version:walkLinks.services_version,preference:walkLinks.preference,
        connections:connections(walkLinks.connections),station_access_points:access},targets};
    const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value)}};
    freeze(snapshot);return snapshot;
  } catch { return null; }
}

function* reverseClosure(graphs, destinationId, checkpoint) {
  const closure = new Set([destinationId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const graph of graphs) for (const edge of graph.edges) {
      if (checkpoint()) yield;
      if (!edge || !string(edge.from_id) || !string(edge.to_id)) return null;
      if (closure.has(edge.to_id) && !closure.has(edge.from_id)) {
        closure.add(edge.from_id); changed = true;
        if (closure.size > MAX_CLOSURE) return null;
      }
    }
  }
  return closure;
}

/**
 * Create once per loaded graph snapshot, after all three sources are ready.
 * Build must verify the resolver-policy fingerprint before supplying policyId.
 * Mutable source graphs are revalidated/recomputed on EVERY call; immutable
 * prepared graphs share only completed shape/consistency validation. Terminal
 * closures are always request-local and are never cached.
 */
export function createExactPublicTerminalPrecheck(inputs) {
  const {area, station, detail, services, walkLinks} = inputs ?? {};
  const sources = {area, station, detail, services, walkLinks};
  const graphs = [area, station, detail];
  let graphValid, frozen = false;
  function* steps(request, {taxiAllowed, detailState, policyId, cooperative = false} = {}) {
    const checkpoint = createCheckpoint();
    const originalRequest = request;
    const requestRevision = JSON.stringify(request);
    request = JSON.parse(requestRevision); // Small, stable endpoint/preferences snapshot before any yield.
    if (policyId !== TERMINAL_RESOLVER_POLICY_ID || taxiAllowed !== false || detailState !== 'ready'
      || request?.mode !== 'transit' || !NEEDS.includes(request.need) || !date(request.departureDate)
      || !Number.isFinite(request.departureS) || request.departureS < 0 || request.departureS >= 86400
      || !Array.isArray(request.allowedTransitModes) || request.allowedTransitModes.length !== MODES.length
      || !MODES.every(mode => request.allowedTransitModes.includes(mode))
      || !exact(request.origin) || !exact(request.destination)
      || request.origin.node_id === request.destination.node_id) return null;
    // These checks are intentionally BEFORE any graph-wide validation. Other
    // public requests must not pay this optimization's preparation cost.
    if (!graphs.every(graph => graph && Array.isArray(graph.nodes) && Array.isArray(graph.edges) && Array.isArray(graph.portals))) return null;
    if (cooperative && !graphs.every(graph => Object.isFrozen(graph) && Object.isFrozen(graph.nodes) && Object.isFrozen(graph.edges) && Object.isFrozen(graph.portals))) return null;
    const endpointNodes = [];
    for (const point of [request.origin, request.destination]) {
      const node = station.nodes.find(n => n?.id === point.node_id);
      const portal = station.portals.find(p => p?.id === point.id && p.node_id === point.node_id);
      if (!node || !portal || !equal(node.coordinates, point.coordinates) || !equal(portal.coordinates, node.coordinates)) return null;
      endpointNodes.push(node);
    }
    // Reviewed same-station exact-source class; high-speed and regional endpoint
    // substitution paths are intentionally outside this optimization.
    if (endpointNodes[0].region_id !== endpointNodes[1].region_id
      || !request.origin.id.startsWith(endpointNodes[0].region_id + ':portal:')
      || !request.destination.id.startsWith(endpointNodes[1].region_id + ':portal:')) return null;
    // Most normal station exits already are public anchors: no cut proof can
    // apply, so leave these ordinary requests before a single full-edge scan.
    if (area.portals.some(p => p?.id === request.destination.id || p?.node_id === request.destination.node_id)) return null;
    const anchorState = anchorRevision(sources);
    if (anchorState === null) return null;
    const ingress = captureIngress(sources, graphs);
    if (!ingress) return null;
    const anchorSources = {...sources,services:ingress.services,walkLinks:ingress.walkLinks};
    const anchorGraphs = graphs.map((g,index)=>({nodes:g.nodes,edges:g.edges,portals:g.portals,station_targets:ingress.targets[index]}));
    // Establish deep immutable topology before ANY cooperative edge read. A
    // shallow-frozen graph can otherwise change and freeze an edge after a cut
    // was read. This pass is cooperative and commits only when fully complete.
    if (cooperative && !frozen) {
      for (const graph of graphs) if (!(yield* immutable(graph, checkpoint))) return null;
      frozen = true;
    }
    const closure = yield* reverseClosure(graphs, request.destination.node_id, checkpoint);
    if (!closure || closure.has(request.origin.node_id)) return null;
    // Only genuinely small candidate cuts merit complete validation. A large
    // or already connected reverse closure immediately resumes normal routing.
    if (!graphValid || !frozen) {
      for (const graph of graphs) if (!(yield* graphShape(graph, checkpoint))) return null;
      if (!(yield* graphsConsistent(graphs, checkpoint))) return null;
      let allFrozen = frozen;
      if (!allFrozen) {
        allFrozen = true;
        for (const graph of graphs) if (!(yield* immutable(graph, checkpoint))) allFrozen = false;
      }
      // Publish validation cache only after the complete cooperative pass.
      graphValid = true; frozen = allFrozen;
    }
    if (cooperative && !frozen) return null;
    const anchors = yield* ingressAnchors(anchorSources, anchorGraphs, checkpoint);
    if (!anchors || closure.has(request.origin.node_id) || [...anchors].some(id => closure.has(id))) return null;
    const nodes = new Map();
    for (const graph of graphs) {
      for (const node of graph.nodes) {
        if (checkpoint()) yield;
        if (closure.has(node.id)) {
        const old = nodes.get(node.id);
        if (old && !equal(old.coordinates, node.coordinates)) return null;
        nodes.set(node.id, node);
        }
      }
      for (const edge of graph.edges) {
        if (checkpoint()) yield;
        // O4 / W4 may project anonymous stops onto ANY outdoor physical edge.
        // Include disabled/scheduled edges and both ends, including an outward
        // edge whose interior origin projection could have ambiguous direction.
        if (edge.geometry_mode === 'official' && edge.snap_eligible && edge.location === 1
          && !FACILITIES.has(edge.kind) && (closure.has(edge.from_id) || closure.has(edge.to_id))) return null;
      }
    }
    if (nodes.size !== closure.size || !closure.has(request.destination.node_id) || anchorState !== anchorRevision(sources) || requestRevision !== JSON.stringify(originalRequest)) return null;
    return {
      failureStatus: 'NO_ROUTE', reason: 'SOURCE_TERMINAL_ISOLATED', warnings: [], lines: [],
      message: '所选终点在已载入路网中缺少与其他道路及公共交通连接的完整通道。已保留原起终点；这不代表现实中不可达，也不会自动改用附近入口。',
      terminalProof: {
        policyId, destinationNodeId: request.destination.node_id, originNodeId: request.origin.node_id,
        graphVersions: graphs.map(g => g.version), servicesVersion: services.version,
        walkLinksGraphVersion: walkLinks.graph_version,
        closureNodeIds: [...closure].sort(), closureSize: closure.size,
        allSourceEdgesAdmitted: true, allServiceTimesAdmitted: true,
        modalAnchorsInClosure: 0, outdoorProjectionEdgesInClosure: 0,
      },
    };
  }
  const evaluate = (request, options) => {
    try {
      const iterator = steps(request, options);
      for (;;) { const item = iterator.next(); if (item.done) return item.value; }
    } catch { return null; }
  };
  evaluate.steps = steps;
  return evaluate;
}

/** Cooperative driver. Chunk boundaries bound work rather than total search.
 * Aborted/stale work returns no result to publish. The source data are captured
 * immutable snapshots in production; a replacement requires a new evaluator.
 */
const activeChecks = new WeakMap();
export async function runExactPublicTerminalPrecheck(evaluate, request, options, {signal, isCurrent = () => true, yieldControl = () => new Promise(resolve => setTimeout(resolve, 0)), onSlice = () => {}} = {}) {
  const token = {};
  activeChecks.set(evaluate, token);
  const current = () => activeChecks.get(evaluate) === token && !signal?.aborted && isCurrent();
  const iterator = evaluate.steps(request, {...options, cooperative:true});
  try {
    for (;;) {
      if (!current()) return null;
      const started = performance.now(), item = iterator.next();
      onSlice(performance.now() - started);
      if (item.done) return current() ? item.value : null;
      await yieldControl();
    }
  } catch { return null; }
  finally { iterator.return(); if (activeChecks.get(evaluate) === token) activeChecks.delete(evaluate); }
}
