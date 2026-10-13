/** Low-frequency search-state counters. Only injected into copied Worker bundles. */
export function instrumentWalkState(source,path){
 const walk=path.includes('app-walk'),transit=path.includes('app-transit');
 if(!walk&&!transit)return source;
 const s=walk?{heap:'fe',label:'i',labels:'Ke',states:'W',parents:'we',bases:'Se',dead:'be',timed:'x',start:'O',dest:'de',add:'se.add(T,A.elapsed)',bucket:'se'}:{heap:'ne',label:'a',labels:'oe',states:'U',parents:'K',bases:'ge',dead:'_e',timed:'H',start:'Y',dest:'Z',add:'F.add(b,L.elapsed)',bucket:'F'};
 const begin=`for(${s.heap}.push({id:${s.start},`,loop=`const ${s.label}=${s.heap}.pop();`,end=`if(!${s.states}.has(${s.dest}))return`;
 for(const anchor of [begin,loop,end,s.add])if(!source.includes(anchor))throw new Error('Missing search stats anchor '+anchor+' in '+path);
 const report=(event)=>`globalThis.__profile.record({event:${JSON.stringify(event)},request:__profileRequest(e),timed:${s.timed},fifo:hkFifoWaiting,elapsedMs:performance.now()-__psStarted,expanded:__psExpanded,labelsAllocated:${s.labels},stateRecords:${s.states}.size,predecessors:${s.parents}.size,baseStates:${s.bases}.size,invalidated:${s.dead}.size,queue:${s.heap}.length,peakQueue:__psPeak,maxTieLength:__psTie,maxKeyLength:__psKey,maxAllocatedPerBaseState:__psPerBase,heapUsed:process.memoryUsage().heapUsed});`;
 source=source.replace(begin,`let __psExpanded=0,__psPeak=0,__psTie=0,__psKey=0,__psPerBase=0;const __psStarted=performance.now();${begin}`);
 source=source.replace(loop,`${loop}__psPeak=Math.max(__psPeak,${s.heap}.length);__psTie=Math.max(__psTie,${s.label}.tie?.length??0);__psKey=Math.max(__psKey,${s.label}.id?.length??0);if((++__psExpanded&1023)===0){${report('walk-search-progress')}}`);
 source=source.replace(s.add,`${s.add};${s.bucket}.__profileAllocated=(${s.bucket}.__profileAllocated??0)+1;__psPerBase=Math.max(__psPerBase,${s.bucket}.__profileAllocated)`);
 return source.replace(end,report('walk-search-end')+end);
}
