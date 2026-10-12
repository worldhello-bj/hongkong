/** Bounded result memo, never a search-state or predecessor store.
 * Paired evidence is evicted atomically. Duplicate connection IDs retain the
 * original unbounded alias semantics because an ID alone cannot replay them.
 */
export function routeMemo(capacity=64,paired=null,connections=null){
 if(!Number.isInteger(capacity)||capacity<1)throw new RangeError('Invalid route memo capacity');
 const memo=new Map(),order=new Set(),seen=new Set(),duplicates=new Set();
 for(const connection of connections??[]){if(seen.has(connection.id))duplicates.add(connection.id);seen.add(connection.id)}
 const remove=key=>{order.delete(key);paired?.delete(key);return Map.prototype.delete.call(memo,key)};
 memo.delete=remove;
 memo.clear=()=>{order.clear();paired?.clear();Map.prototype.clear.call(memo)};
 memo.set=(key,value)=>{
  if(!memo.has(key)&&!(duplicates.size&&duplicates.has(JSON.parse(key)[0]))){
   if(order.size>=capacity)remove(order.values().next().value);
   order.add(key);
  }
  Map.prototype.set.call(memo,key,value);return memo;
 };
 return memo;
}
/** Recompute only evicted dynamic evidence, at the exact original departure.
 * Static fallback remains valid only for a connection without a resolver.
 * A cancelled/closed recomputation propagates instead of using stale evidence.
 */
export function connectionEvidence(evidence,memo,staticEvidence,connections,leg,resolve,keyOf,resolvers){
 const key=keyOf(leg.connectionId,leg.departureS),cached=evidence.get(key);
 if(cached)return cached;
 if(!resolvers.has(leg.connectionId))return staticEvidence.get(leg.connectionId);
 const source=connections.find(connection=>connection.id===leg.connectionId&&connection.fromId===leg.fromId&&connection.toId===leg.toId);
 if(!source)return undefined;
 memo.delete(key);
 if(!resolve(source,leg.departureS))return undefined;
 return evidence.get(key);
}
/** Keep every source node and edge; omit only useless synthetic portal objects.
 * Incidence uses every retained edge, independent of preference/access rules.
 */
export function indoorGraph(graph,regionId,nodes,nodeIds){
 const edges=graph.edges.filter(edge=>edge.region_id===regionId&&edge.source_id==='CSDI-INDOOR'&&edge.geometry_mode==='official'&&nodeIds.has(edge.from_id)&&nodeIds.has(edge.to_id));
 const incident=new Set();for(const edge of edges){incident.add(edge.from_id);incident.add(edge.to_id)}
 return {...graph,regions:graph.regions.filter(region=>region.id===regionId),nodes,edges,
  portals:nodes.filter(node=>incident.has(node.id)).map(node=>({id:'EXACT:'+node.id,node_id:node.id,name:'官方站内节点',region_id:regionId,coordinates:node.coordinates,offset_m:0}))};
}
