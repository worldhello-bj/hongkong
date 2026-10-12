/** Exact source identity precedes overlapping geographic acquisition envelopes.
 * Prepared graphs are immutable snapshots. Mutable graphs are never cached.
 * null means no exact identity was requested; {region:undefined} fails closed
 * for missing or conflicting identities instead of silently choosing a neighbour.
 */
const exactRegionNodes = new WeakMap();
export function exactSourceRegion(graph,point){
 if(!point || !(point.node_id || point.node_ids?.length))return null;
 let nodes=graph.nodes;
 if(!nodes || typeof nodes.get!=='function'){
  nodes=Object.isFrozen(graph)?exactRegionNodes.get(graph):undefined;
  if(!nodes){nodes=new Map((graph.nodes??[]).map(node=>[node.id,node]));if(Object.isFrozen(graph))exactRegionNodes.set(graph,nodes);}
 }
 const ids=point.node_id?[point.node_id]:point.node_ids,regions=new Set();
 for(const id of ids){
  const node=nodes.get(id);if(!node)return {region:undefined};
  if(point.node_id && point.coordinates!==undefined){
   const expected=point.coordinates,actual=node.coordinates;
   if(!Array.isArray(expected)||![2,3].includes(expected.length)||!Array.isArray(actual)
    || expected.some((value,index)=>!Number.isFinite(value)||!Number.isFinite(actual[index])
      ||Math.abs(value-actual[index])>(index===2?.005:1e-7)))return {region:undefined};
  }
  regions.add(node.region_id);
 }
 if(regions.size!==1)return {region:undefined};
 const id=regions.values().next().value;
 return {region:graph.regions.find(region=>region.id===id)};
}
