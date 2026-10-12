/** Offline attribution for preserved 60/120 and extended same-process checkpoints. */
import{readFileSync,writeFileSync,existsSync}from'node:fs';import{resolve}from'node:path';
const dir=resolve(process.argv[2]),base=JSON.parse(readFileSync(dir+'/report.json','utf8'));
const stream=existsSync(dir+'/instrumented/followthrough-events.ndjson')?dir+'/instrumented/followthrough-events.ndjson':dir+'/events.ndjson';
const events=readFileSync(stream,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const checkpoints=events.filter(e=>['observation-end','followthrough-end','extended-checkpoint','extended-observation-end'].includes(e.event));
function summarize(cut){
 const observed=events.filter(e=>e.t<=cut.t),spans=new Map(),prep=new Map(),loops=new Map(),bounds=new Map(),memos=new Map(),byGraph=new Map();let latestScheduled;
 for(const e of observed){
  const id=e.worker+':'+e.sid;
  if(e.event==='worker-span-start')spans.set(id,{...e});
  if(e.event==='worker-span-end'&&spans.has(id))Object.assign(spans.get(id),{durationMs:e.durationMs,endAt:e.t,status:e.status,error:e.error});
  if(e.event==='time-semantics-preparation')prep.set(id,e);
  if(e.event==='walk-hotspot-end')loops.set(id,e);
  if(e.event==='lower-bound-preparation')bounds.set(id,e);
  if(e.worker===5&&e.event.startsWith('scheduled-hotspot-'))latestScheduled=e;
  for(const memo of e.routeMemos??[])memos.set(e.worker+':'+memo.memoId,{worker:e.worker,...memo});
  if(e.event==='route-memo-create'||e.event==='route-memo-progress')memos.set(e.worker+':'+e.memoId,{...e});
  if(e.worker!==5||e.event!=='lower-bound-preparation'||!e.lookedUp)continue;
  const key=JSON.stringify([e.graphNodes,e.graphEdges]),g=byGraph.get(key)??{nodes:e.graphNodes,edges:e.graphEdges,lookups:0,hits:0,misses:0,evictions:0,buildMs:0,prepMs:0,keys:new Set(),maxArrayBytes:0};
  g.lookups++;g.hits+=+e.cacheHit;g.misses+=+!e.cacheHit;g.evictions+=+(e.evictedKey!==undefined);g.buildMs+=e.buildMs;g.prepMs+=e.preparationMs;g.keys.add(e.cacheKey);g.maxArrayBytes=Math.max(g.maxArrayBytes,e.retainedArrayBytes??0);byGraph.set(key,g);
 }
 const dest=observed.filter(e=>e.worker===5&&e.event==='destination-bound-preparation');const total=field=>dest.reduce((sum,e)=>sum+(e[field]??0),0);const destinationBounds={calls:dest.length,used:dest.filter(e=>e.used).length,fallbacks:dest.filter(e=>!e.used).length,coreLookups:dest.filter(e=>e.coreLookedUp).length,coreHits:dest.filter(e=>e.coreLookedUp&&e.coreCacheHit).length,coreMisses:dest.filter(e=>e.coreLookedUp&&!e.coreCacheHit).length,coreBuilds:dest.filter(e=>e.coreBuilt===true).length,baseLookups:dest.filter(e=>e.baseLookedUp).length,baseHits:dest.filter(e=>e.baseLookedUp&&e.baseCacheHit).length,baseBuilds:dest.filter(e=>e.baseBuilt===true).length,distinctCoreKeys:new Set(dest.filter(e=>e.coreKey??e.coreKeyId).map(e=>e.coreKey??e.coreKeyId)).size,baseBuildMs:total('baseBuildMs'),coreDijkstraMs:total('coreDijkstraMs'),coreCompactMs:total('coreCompactMs'),leafRebuildMs:total('leafRebuildMs'),totalMs:total('totalMs')};
 const timed={completed:0,fullFtMs:0,loopMs:0,temporalPrepMs:0,lowerPrepMs:0,lowerBuildMs:0};
 for(const [id,span]of spans){if(span.worker!==5||span.name!=='walk-query'||span.durationMs===undefined||!prep.get(id)?.timed)continue;timed.completed++;timed.fullFtMs+=span.durationMs;timed.loopMs+=loops.get(id)?.elapsedMs??0;timed.temporalPrepMs+=prep.get(id)?.elapsedMs??0;timed.lowerPrepMs+=bounds.get(id)?.preparationMs??0;timed.lowerBuildMs+=bounds.get(id)?.buildMs??0;}
 timed.otherWallMs=timed.fullFtMs-timed.loopMs-timed.temporalPrepMs-timed.lowerPrepMs;
 const scheduled=[];for(const span of spans.values())if(span.worker===5&&span.name==='scheduled-search'){
  const end=Math.min(span.endAt??cut.t,cut.t),children={};
  for(const child of spans.values())if(child.worker===5&&child.parentSid===span.sid){const ms=child.durationMs??Math.max(0,end-child.t);children[child.name]=(children[child.name]??0)+ms;}
  const elapsedMs=span.durationMs??Math.max(0,end-span.t);scheduled.push({sid:span.sid,complete:span.durationMs!==undefined,elapsedMs,directChildrenMs:children,residualMs:elapsedMs-Object.values(children).reduce((a,b)=>a+b,0)});
 }
 return{event:cut.event,atMs:cut.t,windowMs:cut.windowMs??(cut.event==='observation-end'?60000:cut.event==='followthrough-end'?120000:cut.event==='extended-observation-end'?JSON.parse(readFileSync(dir+'/extended-report.json','utf8')).windowMs:null),state:cut.state,workerErrors:observed.filter(e=>e.event==='worker-error'),workersCreated:observed.filter(e=>e.event==='worker-create').length,latestScheduled,routeMemos:[...memos.values()],evidenceReplays:observed.filter(e=>e.event==='route-evidence-replay').length,lowerBounds:[...byGraph.values()].map(g=>({...g,uniqueKeys:g.keys.size,repeatedMisses:g.misses-g.keys.size,keys:undefined})),completedTimedWalk:timed,destinationBounds,scheduled,portalGraphs:observed.filter(e=>e.event==='indoor-derived-graph'&&e.worker===5)};
}
const result={runtime:base.runtime,id:base.id,need:base.need,stream:stream.slice(dir.length+1),checkpoints:checkpoints.map(summarize),caveats:['Analysis only: no routing or production change.','The 60-second report and 120-second report remain the primary original-window evidence.','Completed ft partitions exclude unfinished queries. Scheduled residual subtracts direct nested spans, including partial spans at cutoff; it is wall time, not sampled CPU time.','Worker heap points are GC-sensitive and not retained-size attribution.','Read execution-context.json for known host concurrency; the run label alone does not prove an exclusive host.']};
writeFileSync(dir+'/followthrough-attribution.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result.checkpoints.map(c=>({windowMs:c.windowMs,state:c.state,errors:c.workerErrors.length,labels:c.latestScheduled?.retainedLabels,heapMiB:c.latestScheduled?.heapUsed/2**20,lowerBounds:c.lowerBounds,timed:c.completedTimedWalk,scheduled:c.scheduled})),null,2));
