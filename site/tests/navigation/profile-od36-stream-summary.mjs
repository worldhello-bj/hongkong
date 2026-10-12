/** Bounded-memory offline attribution; accepts raw or gzip NDJSON. No route execution. */
import {createReadStream,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createGunzip} from 'node:zlib';
import {createInterface} from 'node:readline';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const dir=resolve(process.argv[2]),base=JSON.parse(readFileSync(dir+'/report.json','utf8'));
const file=process.argv[3]?resolve(process.argv[3]):['instrumented/live-events.ndjson','instrumented/live-events.ndjson.gz','instrumented/followthrough-events.ndjson','instrumented/followthrough-events.ndjson.gz','events.ndjson','events.ndjson.gz'].map(p=>dir+'/'+p).find(existsSync);
if(!file)throw Error('No event stream');
let stream=createReadStream(file);if(file.endsWith('.gz'))stream=stream.pipe(createGunzip());
const active=new Map(),memos=new Map(),portalGraphs=[],completedScheduled=[],walkGroups=new Map(),destinationKeys=new Set(),workerErrors=[],workers=new Set(),eventCounts={};
const timed={completed:0,fullFtMs:0,loopMs:0,temporalPrepMs:0,lowerPrepMs:0,lowerBuildMs:0};
const destination={calls:0,used:0,fallbacks:0,coreLookups:0,coreHits:0,coreMisses:0,coreBuilds:0,baseLookups:0,baseHits:0,baseBuilds:0,baseBuildMs:0,coreDijkstraMs:0,coreCompactMs:0,leafRebuildMs:0,totalMs:0};
let latestScheduled,lastEvent,lines=0,maxActiveSpans=0,evidenceReplays=0;const checkpoints=[];
const add=(obj,key,value)=>obj[key]=(obj[key]??0)+(value??0);
function scheduledSnapshot(cut){return [...completedScheduled,...[...active.values()].filter(s=>s.worker===5&&s.name==='scheduled-search').map(s=>{const children={...s.children};for(const child of active.values())if(child.worker===s.worker&&child.parentSid===s.sid)add(children,child.name,Math.max(0,cut-child.t));const elapsedMs=cut-s.t;return{sid:s.sid,complete:false,elapsedMs,directChildrenMs:children,residualMs:elapsedMs-Object.values(children).reduce((a,b)=>a+b,0)};})];}
function snapshot(e){return JSON.parse(JSON.stringify({event:e.event,atMs:e.t,windowMs:e.windowMs??(e.event==='observation-end'?60000:e.event==='followthrough-end'?120000:undefined),state:e.state,latestScheduled,completedTimedWalk:{...timed,otherWallMs:timed.fullFtMs-timed.loopMs-timed.temporalPrepMs-timed.lowerPrepMs},destinationBounds:{...destination,distinctCoreKeys:destinationKeys.size},scheduled:scheduledSnapshot(e.t),completedWalkByGraphAndStatus:[...walkGroups.values()],routeMemos:[...memos.values()],evidenceReplays}));}
for await(const line of createInterface({input:stream,crlfDelay:Infinity})){
 if(!line.trim())continue;const e=JSON.parse(line);lines++;lastEvent=e;add(eventCounts,e.event,1);const id=e.worker+':'+e.sid;
 if(e.event==='worker-create')workers.add(e.worker);
 if(e.event==='worker-error')workerErrors.push(e);
 if(e.event==='worker-span-start'){active.set(id,{worker:e.worker,sid:e.sid,parentSid:e.parentSid,name:e.name,t:e.t,graph:e.graph,children:{}});maxActiveSpans=Math.max(maxActiveSpans,active.size);}
 const s=active.get(id);
 if(s&&e.event==='time-semantics-preparation')s.prep=e;
 if(s&&e.event==='walk-hotspot-end')s.loop=e;
 if(s&&e.event==='lower-bound-preparation')s.bound=e;
 if(e.event==='worker-span-end'&&s){
  const parent=active.get(e.worker+':'+s.parentSid);if(parent)add(parent.children,e.name,e.durationMs);
  if(e.worker===5&&e.name==='walk-query'){
   const gkey=JSON.stringify([s.graph?.nodes,s.graph?.edges,s.prep?.timed??null,e.status]);const g=walkGroups.get(gkey)??{nodes:s.graph?.nodes,edges:s.graph?.edges,timed:s.prep?.timed??null,status:e.status,calls:0,fullMs:0,loopMs:0,temporalPrepMs:0,lowerPrepMs:0};g.calls++;g.fullMs+=e.durationMs;g.loopMs+=s.loop?.elapsedMs??0;g.temporalPrepMs+=s.prep?.elapsedMs??0;g.lowerPrepMs+=s.bound?.preparationMs??0;walkGroups.set(gkey,g);
   if(s.prep?.timed){timed.completed++;timed.fullFtMs+=e.durationMs;timed.loopMs+=s.loop?.elapsedMs??0;timed.temporalPrepMs+=s.prep?.elapsedMs??0;timed.lowerPrepMs+=s.bound?.preparationMs??0;timed.lowerBuildMs+=s.bound?.buildMs??0;}
  }
  if(e.worker===5&&e.name==='scheduled-search')completedScheduled.push({sid:s.sid,complete:true,elapsedMs:e.durationMs,directChildrenMs:s.children,residualMs:e.durationMs-Object.values(s.children).reduce((a,b)=>a+b,0)});
  active.delete(id);
 }
 if(e.worker===5&&e.event.startsWith('scheduled-hotspot-'))latestScheduled=e;
 for(const memo of e.routeMemos??[])memos.set(e.worker+':'+memo.memoId,{worker:e.worker,...memo});
 if(e.event==='route-memo-create'||e.event==='route-memo-progress')memos.set(e.worker+':'+e.memoId,{...e});
 if(e.event==='route-evidence-replay')evidenceReplays++;
 if(e.worker===5&&e.event==='indoor-derived-graph')portalGraphs.push(e);
 if(e.worker===5&&e.event==='destination-bound-preparation'){
  destination.calls++;destination.used+=+e.used;destination.fallbacks+=+!e.used;destination.coreLookups+=+!!e.coreLookedUp;destination.coreHits+=+(e.coreLookedUp&&e.coreCacheHit||false);destination.coreMisses+=+(e.coreLookedUp&&!e.coreCacheHit||false);destination.coreBuilds+=+!!e.coreBuilt;destination.baseLookups+=+!!e.baseLookedUp;destination.baseHits+=+(e.baseLookedUp&&e.baseCacheHit||false);destination.baseBuilds+=+!!e.baseBuilt;
  for(const k of ['baseBuildMs','coreDijkstraMs','coreCompactMs','leafRebuildMs','totalMs'])add(destination,k,e[k]);
  destination.maxCoreCacheSize=Math.max(destination.maxCoreCacheSize??0,e.coreCacheSize??0);destination.maxCoreArrayBytes=Math.max(destination.maxCoreArrayBytes??0,e.coreArrayBytes??0);destination.coreCacheCapacity=e.coreCacheCapacity??destination.coreCacheCapacity;
  if(e.coreKey)destinationKeys.add(createHash('sha256').update(e.coreKey).digest('hex'));else if(e.coreKeyId!==undefined)destinationKeys.add(e.worker+':'+e.coreKeyId);
 }
 if(['observation-end','followthrough-end','extended-checkpoint','extended-observation-end'].includes(e.event))checkpoints.push(snapshot(e));
}
const result={runtime:base.runtime,stream:file.slice(dir.length+1),lines,lastEventAtMs:lastEvent?.t,maxActiveSpans,workersCreated:workers.size,workerErrors,eventCounts,checkpoints,lastDurable:snapshot(lastEvent),portalGraphs,activeSpans:[...active.values()].map(s=>({worker:s.worker,sid:s.sid,parentSid:s.parentSid,name:s.name,t:s.t})),limits:['Streaming analysis retains only active spans and scalar aggregates; completed per-query records are discarded.','Last durable raw event is not necessarily the 600-second report. Compare extended-progress.json and worker-lifecycle.ndjson.','Wall-time partitions are inclusive timings, not sampled CPU attribution. Worker heap samples are GC-sensitive.']};
writeFileSync(dir+'/stream-attribution.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({lines,lastEventAtMs:result.lastEventAtMs,maxActiveSpans,workerErrors,lastDurable:result.lastDurable},null,2));
