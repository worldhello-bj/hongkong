/** Preserve bounded source composition when the requested endpoints remain in it.
 * The original KOW branch stays unchanged. EXC's two-node import is not a
 * substitute for other station-only endpoints (for example a paid platform).
 */
export function preserveExactBoundaryGraph(graph, points) {
 const find = id => graph.nodes.find(node => node.id === id);
 const exact = points.map(point => point.node_id ? find(point.node_id) : undefined);
 if (graph.kowloon_exact_boundary_join && exact.some(node => node?.source_region_id === 'KOW')) return true;
 if (!graph.exc_b3_exact_boundary_join || !exact.some(node => node?.source_region_id === 'EXC')) return false;
 return points.every((point, index) => point.node_id ? !!exact[index] :
  !point.node_ids?.length || point.node_ids.every(id => !!find(id)));
}
