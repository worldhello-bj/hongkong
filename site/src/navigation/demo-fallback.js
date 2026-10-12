import {preferenceAllows,annotatePreferenceResult,PREFERENCE_PROFILES} from "./preference-routing.js";
/** Unknown facilities can support a labelled demo, never accessibility certification. */
const accessibilityGraphCache = new WeakMap();
const walkLinksCache = new WeakMap();
const excludedKinds = new Set(['stairs', 'stair', 'staircase', 'steps', 'escalator', 'stairlift', 'travelator', 'movingwalkway']);
const normalKind = kind => String(kind ?? '').toLowerCase().replace(/[\s_-]/g, '');
const isFacilityProfile = need => ['accessible','luggage','lift','escalator'].includes(need);
const closedPhysicalIds = graph => new Set((graph?.closures ?? []).flatMap(closure => closure.physical_ids ?? []));
const physicallyBlocked = (edge, closed) => !!edge?.disabled || closed.has(edge?.physical_id);
const facilityBlocked = edge => edge?.wheelchair_barrier === 1 || excludedKinds.has(normalKind(edge?.kind));

/**
 * Retain source nodes, metadata, direction and schedules; only remove known barriers.
 * Eligibility is deliberately not rewritten: an ordinary-profile demo search may use
 * unknown facilities, while its result must still be marked as requiring confirmation.
 * Inputs are immutable graph snapshots, like the routing engine's prepared graphs.
 */
export function createDemoAccessibilityGraph(graph) {
  if (graph == null) return graph;
  if (!Array.isArray(graph.edges)) throw new TypeError('A demo graph requires an edges array.');
  if (accessibilityGraphCache.has(graph)) return accessibilityGraphCache.get(graph);
  const closed = closedPhysicalIds(graph);
  const filtered = {...graph, edges: graph.edges.filter(edge => !physicallyBlocked(edge, closed) && !facilityBlocked(edge))};
  accessibilityGraphCache.set(graph, filtered);
  return filtered;
}

/**
 * Cached inter-stop walks were calculated against the ordinary graph and can contain
 * stairs even after the live graph is filtered. Keep only auditable source-backed
 * connections. Pass [area, station, block] or {area, station, block}; area comes first.
 * Explicit schematic endpoint access stays pending the existing land/closure guard.
 */
export function createDemoWalkLinks(links, graphs) {
  if (links == null) return links;
  const sources = (Array.isArray(graphs) ? graphs : [graphs?.area, graphs?.station, graphs?.block]).filter(Boolean);
  if (!Array.isArray(links.connections) || !sources.length || sources.some(graph => !Array.isArray(graph.edges))) {
    throw new TypeError('Demo walk links require connections and filtered source graphs, with area first.');
  }
  let cache = walkLinksCache.get(links);
  if (!cache) walkLinksCache.set(links, cache = new WeakMap());
  for (const graph of sources) {
    let next = cache.get(graph);
    if (!next) cache.set(graph, next = new WeakMap());
    cache = next;
  }
  if (cache.result) return cache.result;
  const closed = new Set(sources.flatMap(graph => [...closedPhysicalIds(graph)]));
  const edges = new Map();
  for (const graph of sources) for (const edge of graph.edges) {
    const records = edges.get(edge.id) ?? [];
    records.push(edge);
    edges.set(edge.id, records);
  }
  const forbidden = record => physicallyBlocked(record, closed) || facilityBlocked(record);
  const sourceId = id => typeof id === 'string' ? id.replace(/:split:\d+$/, '').replace(/^(ACCESS:(?:origin|destination)):\d+$/, '$1') : null;
  const supported = (rawId, record) => {
    const id = sourceId(rawId);
    if (!id || forbidden(record)) return false;
    const originals = edges.get(id);
    if (!originals) return record.kind === 'access_connector' && record.geometry_mode === 'schematic'
      && /^ACCESS:(?:origin|destination)$/.test(id);
    return originals.every(original => !forbidden(original)
      && (record.physical_id == null || original.physical_id === record.physical_id)
      && (normalKind(record.kind) !== 'lift' || normalKind(original.kind) === 'lift'));
  };
  const connections = links.connections.filter(connection => {
    const route = connection.route;
    if (connection.disabled || route?.status !== 'CONDITIONAL' || !Array.isArray(route.legs)
      || !route.legs.length || !Array.isArray(route.geometry?.features)) return false;
    for (const leg of route.legs) {
      if (forbidden(leg)) return false;
      const ids = leg.edge_ids ?? leg.source_edge_ids;
      if (!Array.isArray(ids) || (!ids.length && leg.kind !== 'wait') || !ids.every(id => supported(id, leg))) return false;
    }
    return route.geometry.features.every(feature => {
      const properties = feature?.properties;
      return !!properties && supported(properties.edge_id ?? properties.id, properties);
    });
  });
  cache.result = {...links, graph_version: sources[0].version, connections};
  return cache.result;
}

/**
 * Accept only a complete fallback result. Validate traversed source edges even when a
 * summary disguises them as walking or an overlay accidentally reintroduces a barrier.
 * Unused barriers elsewhere in the graph do not invalidate an otherwise safe route.
 * Returns null on rejection and never changes the original result or confirmed routes.
 */
export function annotateDemoFallback(result, originalRequest = {}) {
  result=annotatePreferenceResult(result,originalRequest);
  const journey = result?.journey;
  if (journey?.complete !== true || !Array.isArray(journey.steps)) return null;
  const need = originalRequest.need ?? 'ordinary';
  const needsFacilityConfirmation = isFacilityProfile(need);
  const graph = journey.graph;
  const closed = closedPhysicalIds(graph);
  const edges = new Map();
  for (const edge of graph?.edges ?? []) {
    // Keep duplicate source records visible to validation instead of allowing a
    // later, permissive record to hide a prohibited physical edge with the same ID.
    const records = edges.get(edge.id) ?? [];
    records.push(edge);
    edges.set(edge.id, records);
  }
  const forbidden = edge => physicallyBlocked(edge, closed) || need==='accessible' && facilityBlocked(edge) || !preferenceAllows(edge,need);
  for (const step of journey.steps) {
    const guidance = step?.guidance;
    if (!step || step.blocked || normalKind(step.kind) === 'gap' || forbidden(step) || forbidden(guidance)) return null;
    const ids = [...new Set([...(guidance?.edge_ids ?? []), ...(step.edge_ids ?? [])])];
    const traversed = ids.flatMap(id => edges.get(id) ?? []);
    if (traversed.some(forbidden)) return null;
    // Official physical steps must resolve to their source graph. Transit services
    // and explicit schematic endpoint connectors may have synthetic service IDs.
    const officialPhysical = guidance?.geometry_mode === 'official'
      && !['rail', 'metro', 'bus', 'tram', 'taxi', 'wait', 'station_overview'].includes(step.kind);
    if (needsFacilityConfirmation && officialPhysical && (!ids.length || ids.some(id => !edges.has(id)))) return null;
    if ([step.kind, guidance?.kind].some(kind => normalKind(kind) === 'lift')
      && (!ids.length || ids.some(id => !edges.has(id)) || !traversed.some(edge => normalKind(edge.kind) === 'lift'))) return null;
  }
  // Summaries can be coarser than navigation steps, but must not contradict them.
  if ((result.segments ?? []).some(forbidden)) return null;
  const reviewLabel = needsFacilityConfirmation ? '演示路线 · 设施待确认' : '演示路线 · 接驳待确认';
  const message = result.luggageCarryRequired?result.message:needsFacilityConfirmation
    ? `演示路线已连通；${need === 'accessible' ? '无障碍设施' : need==='luggage'?'行李通行设施':'换层设施'}与接入条件待确认，不能视为已核验无障碍路线。`
    : '演示路线已连通；补充接驳按模型估算，实际通行条件待确认。';
  return {
    ...result,
    scenarioOnly: true,
    simulationOnly: true,
    confidence: 'modeled',
    needsConfirmation: true,
    needsFacilityConfirmation,
    accessibilityVerified: false,
    accessibility: 'unverified',
    originalNeed: need,
    requestedPreference:need,
    effectivePreference:need==='accessible'?'fast-filtered-accessibility':PREFERENCE_PROFILES[need]?.engine??'fast',
    reviewLabel,
    message,
    warnings: [...new Set([...(result.warnings ?? []), message])],
  };
}
