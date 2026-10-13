/** Lossless read-only representation of cached reverse lower bounds.
 * Real node IDs share one index per graph/preference; synthetic query nodes stay
 * in a small Map. A presence bitmap preserves missing entries, NaN and signed zero.
 * This changes storage/retention only, never keys, costs, traversal or search order.
 */
export function compactLowerBounds(bounds,nodeIndex){
 const values=new Float64Array(nodeIndex.size),present=new Uint8Array(Math.ceil(nodeIndex.size/8)),extra=new Map();
 for(const [key,value] of bounds){
  if(typeof value!=='number')throw new TypeError('Lower-bound distance must be numeric');
  const position=nodeIndex.get(key);
  if(position===undefined)extra.set(key,value);
  else {values[position]=value;present[position>>3]|=1<<(position&7);}
 }
 return {size:bounds.size,byteLength:values.byteLength+present.byteLength,
  get(key){const position=nodeIndex.get(key);return position===undefined?extra.get(key):(present[position>>3]&(1<<(position&7)))?values[position]:undefined;}};
}
export function retainLowerBounds(index,graph,key,bounds,{arrayBudgetBytes=16*1024*1024,maxEntries=64}={}){
 let metadata=index.hkLowerBoundNodes;
 if(!metadata||metadata.graph!==graph){
  const nodeIndex=new Map(graph.nodes.map((node,position)=>[node.id,position]));
  const bytesPerEntry=nodeIndex.size*8+Math.ceil(nodeIndex.size/8);
  metadata={graph,nodeIndex,capacity:Math.max(1,Math.min(maxEntries,Math.floor(arrayBudgetBytes/Math.max(1,bytesPerEntry))))};
  index.hkLowerBoundNodes=metadata;
 }
 const result=compactLowerBounds(bounds,metadata.nodeIndex),cache=index.remainingCache;
 if(!cache.has(key)&&cache.size>=metadata.capacity)cache.delete(cache.keys().next().value);
 cache.set(key,result);return result;
}
