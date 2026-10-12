// Canonicalize only the same official entrance, never a nearby entrance.
export function canonicalStationEndpoint(id, legacyPortals, station) {
  const old = legacyPortals.get(id);
  if (!old) return id;
  const current = station?.portals?.find(p => p.id === id);
  const fallback = old.node_id ?? id;
  if (!current || current.node_id === old.node_id) return fallback;
  if (!old.source_feature_id || old.source_feature_id !== current.source_feature_id ||
      !old.station_id || old.station_id !== current.station_id) return fallback;
  const a = old.source_coordinates, b = current.source_coordinates;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length < 3 || b.length < 3 ||
      !a.every((v, i) => Number.isFinite(v) && Number.isFinite(b[i]) && Math.abs(v - b[i]) < 1e-9)) return fallback;
  const node = station.nodes?.find(n => n.id === current.node_id);
  if (!node || node.region_id !== current.region_id) return fallback;
  const xyz = node.coordinates;
  if (!Array.isArray(xyz) || xyz.length < 3 || !xyz.every(Number.isFinite) ||
      Math.hypot((xyz[0]-b[0])*102900,(xyz[1]-b[1])*111320,xyz[2]-b[2]) > .01) return fallback;
  return current.node_id;
}
// Existing network entrance stops are reachable from an exact station node only
// through the station router. This adds candidates, never straight-line edges.
export function stationOutdoorCandidates(point, legacyPortals, station) {
  if (!point.node_id) return [];
  const origin = station?.nodes?.find(n => n.id === point.node_id);
  if (!origin) return [];
  return [...legacyPortals.values()].filter(old => {
    const current = station.portals?.find(p => p.id === old.id);
    return current && current.region_id === origin.region_id &&
      canonicalStationEndpoint(old.id, legacyPortals, station) === current.node_id;
  }).map(p => ({id:p.id}));
}
