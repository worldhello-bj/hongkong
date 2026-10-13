/**
 * Cheap equivalent of the existing engine origin-access check for canonical
 * source-backed named floors. This does not inspect destination access:
 * a route can legitimately arrive after the destination opens.
 *
 * The caller supplies the production engine's canTraverse predicate. Only a
 * schedule on the loaded source graph can stop planning here; request metadata
 * and a nearby/linked place never establish a closure.
 */
export function evaluateOriginOpening(request, graph, canTraverse) {
  const origin = request?.origin;
  if (!origin || !origin.floorId || origin.node_id || origin.node_ids || typeof canTraverse !== 'function') return null;
  const place = graph?.places?.find(p => p.id === (origin.namedPlaceId ?? origin.id));
  if (!place) return null;
  const floor = origin.floorId ? place.floors?.find(f => f.id === origin.floorId) : undefined;
  if (origin.floorId && !floor) return null;
  if (origin.id !== (floor ? `${place.id}:floor:${floor.id}` : place.id)) return null;

  // Match f2's named-place resolver: at least one existing source portal/node
  // must be present. Missing identity or topology is left to that resolver.
  const entranceIds = floor?.entrance_ids ?? place.entrance_ids ?? [];
  const portals = new Map((graph.portals ?? []).map(p => [p.id, p]));
  const nodes = new Set((graph.nodes ?? []).map(n => n.id));
  if (!entranceIds.some(id => nodes.has(portals.get(id)?.node_id))) return null;

  const schedule = place.access_schedule;
  if (place.access_time_id == null || !schedule ||
      schedule.source_rule_id !== place.access_time_id ||
      !['daily', 'weekly'].includes(schedule.kind) ||
      !Array.isArray(schedule.windows) ||
      schedule.timezone !== undefined && schedule.timezone !== 'Asia/Hong_Kong' ||
      schedule.kind === 'weekly' && schedule.week_start !== undefined && schedule.week_start !== 'MON') return null;
  const cycleS = schedule.kind === 'daily' ? 86400 : 604800;
  if (!schedule.windows.every(w => w && Number.isFinite(w.start_s) && Number.isFinite(w.end_s) &&
      w.start_s >= 0 && w.end_s <= cycleS && w.end_s > w.start_s)) return null;
  const { departureS, departureDate } = request;
  if (!Number.isFinite(departureS) || departureS < 0 || departureS > Number.MAX_SAFE_INTEGER ||
      typeof departureDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(departureDate) || departureDate.startsWith('0000-')) return null;
  const date = new Date(`${departureDate}T00:00:00.000Z`);
  if (!Number.isFinite(+date) || date.toISOString().slice(0, 10) !== departureDate) return null;
  const sourceOrigin = { ...origin, access_time_id: place.access_time_id, access_schedule: schedule };
  if (canTraverse(sourceOrigin, departureS, 0, departureDate)) return null;
  return {
    failureStatus: 'NO_ROUTE',
    reason: 'source-origin-opening-constraint',
    placeId: place.id,
    floorId: floor?.id,
    sourceRuleId: place.access_time_id,
    sourceUrl: schedule.source_url,
    message: `起点已载入的来源通道在所选香港时刻未开放。开放规则：${schedule.label ?? '已载入来源时段'}。请选择开放时刻，或明确另选公共室外地点；原起终点未更改。这不代表整座场地关闭。`,
    warnings: ['依据已载入的来源开放规则；临时关闭与设施运行仍需现场核验。'],
    lines: []
  };
}
