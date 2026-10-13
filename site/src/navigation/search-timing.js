/** Static timing metadata for the engine's already prepared (deep-frozen) graph.
 * The caller's per-preference index owns the cache, so owner disposal releases it.
 * Request endpoints, departure/date, opening waits and traversal checks remain dynamic.
 * Unprepared graphs are deliberately recomputed; their caller may still mutate them.
 */
export function searchTimingProfile(index,graph,prepared,hasSchedule,isAlwaysOpen){
 const cached=index.hkSearchTimingProfile;
 if(prepared&&cached?.graph===graph)return cached.value;
 const value={
  waitingAllowed:graph.nodes.every(node=>node.waiting_allowed!==false&&node.wait_allowed!==false)&&graph.edges.every(edge=>edge.waiting_allowed!==false&&edge.wait_allowed!==false),
  scheduledEdges:graph.edges.filter(edge=>hasSchedule(edge)&&!isAlwaysOpen(edge)),
 };
 if(prepared)index.hkSearchTimingProfile={graph,value};
 return value;
}
