/** Exact reverse distances shared by destination, only on prepared immutable graphs.
 * The request overlay is checked structurally, using actual IDs, never ID prefixes.
 * Origin-only nodes must be reverse-graph leaves: core -> origin leaf -> origin root.
 * Removing them cannot change a core relaxation or its arithmetic. Reconstructing
 * their distances uses the same (distance + seconds) expression and strict <.
 * Unexpected topology returns undefined so the caller runs its unchanged oracle.
 */
export function destinationLowerBounds(index,graph,config){
 const {prepared,originId,destinationId,originCandidates,destinationCandidates,overlay,mode,destinationKey,seconds,skip,Heap,compact}=config;
 if(!prepared||originId===destinationId||!index.nodeIds||index.nodeIds.has(originId)||index.nodeIds.has(destinationId))return;
 const originLeaves=new Set(),destinationLeaves=new Set(),originTargets=new Set();
 for(const {id,candidate} of originCandidates){
  originTargets.add(id);
  if(candidate.node_id){if(id!==candidate.node_id||!index.nodeIds.has(id))return;}
  else {if(index.nodeIds.has(id)||id===originId||id===destinationId||originLeaves.has(id))return;originLeaves.add(id);}
 }
 for(const {id,candidate} of destinationCandidates){
  if(id===originId||id===destinationId||originLeaves.has(id))return;
  if(candidate.node_id){if(id!==candidate.node_id||!index.nodeIds.has(id))return;}
  else {if(index.nodeIds.has(id)||destinationLeaves.has(id))return;destinationLeaves.add(id);}
 }
 const isCore=id=>index.nodeIds.has(id)||destinationLeaves.has(id)||id===destinationId;
 const coreArcs=[],leafArcs=[],rootArcs=[];
 for(const list of overlay.values())for(const arc of list){
  if(skip(arc))continue;
  const weight=seconds(arc);
  if(typeof weight!=='number'||Number.isNaN(weight)||weight<0)return;
  const item={from:arc.from,to:arc.to,seconds:weight};
  if(arc.from===originId){if(!originTargets.has(arc.to))return;rootArcs.push(item);}
  else if(originLeaves.has(arc.from)){if(!isCore(arc.to))return;leafArcs.push(item);}
  else {if(!isCore(arc.from)||!isCore(arc.to))return;coreArcs.push(item);}
 }
 let state=index.hkDestinationLowerBounds;
 if(!state||state.graph!==graph){
  const nodeIndex=new Map(graph.nodes.map((node,position)=>[node.id,position]));
  const bytes=nodeIndex.size*8+Math.ceil(nodeIndex.size/8);
  state={graph,nodeIndex,capacity:Math.max(1,Math.min(64,Math.floor(16*1024*1024/Math.max(1,bytes)))),reverseByMode:new Map(),cache:new Map()};
  index.hkDestinationLowerBounds=state;
 }
 // The complete target request is retained in the key. The exact core overlay
 // additionally guards candidate order, generated IDs and all fractional costs.
 const exactNumber=value=>Object.is(value,-0)?'-0':Number.isFinite(value)?value:String(value);
 const key=JSON.stringify([destinationKey,destinationId,coreArcs.map(arc=>[arc.from,arc.to,exactNumber(arc.seconds)])]);
 let core=state.cache.get(key);
 if(!core){
  const modeKey=mode==='walk'?'walk':'all';
  let reverse=state.reverseByMode.get(modeKey);
  if(!reverse){
   reverse=new Map();
   for(const list of index.adjacency.values())for(const arc of list){
    if(skip(arc))continue;
    const weight=seconds(arc);
    if(!index.nodeIds.has(arc.from)||!index.nodeIds.has(arc.to)||typeof weight!=='number'||Number.isNaN(weight)||weight<0)return;
    const list=reverse.get(arc.to)??[];list.push({from:arc.from,seconds:weight});reverse.set(arc.to,list);
   }
   state.reverseByMode.set(modeKey,reverse);
  }
  const queryReverse=new Map();
  // Copy only the few overlay destinations, keeping base arcs before query arcs
  // exactly as the original combined reverse Map. Never mutate cached arrays.
  for(const arc of coreArcs){const list=queryReverse.get(arc.to)??[...(reverse.get(arc.to)??[])];list.push(arc);queryReverse.set(arc.to,list);}
  const bounds=new Map([[destinationId,0]]),heap=new Heap();
  for(heap.push({id:destinationId,access:0,cost:0,tie:''});heap.length;){
   const current=heap.pop();
   if(current.cost===bounds.get(current.id))for(const arc of queryReverse.get(current.id)??reverse.get(current.id)??[]){
    const distance=current.cost+arc.seconds;
    if(distance<(bounds.get(arc.from)??Infinity)){bounds.set(arc.from,distance);heap.push({id:arc.from,access:0,cost:distance,tie:''});}
   }
  }
  core=compact(bounds,state.nodeIndex);
  if(state.cache.size>=state.capacity)state.cache.delete(state.cache.keys().next().value);
  state.cache.set(key,core);
 }
 const extra=new Map();
 for(const arc of leafArcs){
  const distance=(core.get(arc.to)??Infinity)+arc.seconds;
  if(distance<(extra.get(arc.from)??Infinity))extra.set(arc.from,distance);
 }
 for(const arc of rootArcs){
  const distance=(extra.has(arc.to)?extra.get(arc.to):core.get(arc.to)??Infinity)+arc.seconds;
  if(distance<(extra.get(arc.from)??Infinity))extra.set(arc.from,distance);
 }
 // Method references only its two value stores; do not retain request/config,
 // candidate geometry, callbacks, the overlay or a transient Dijkstra heap.
 return {core,extra,size:core.size+extra.size,get(key){return this.extra.has(key)?this.extra.get(key):this.core.get(key);}};
}
