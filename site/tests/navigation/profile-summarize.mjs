/** Summarize profile-navigation.mjs output; no routing is executed here. */
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const dir=resolve(process.argv[2]??'validation/performance/baseline-6e52ec3d2521-od7-luggage');
const report=JSON.parse(readFileSync(dir+'/report.json','utf8')),allEvents=readFileSync(dir+'/events.ndjson','utf8').trim().split('\n').map(JSON.parse);
const observationAt=allEvents.find(e=>e.event==='observation-end')?.t??(allEvents.find(e=>e.event==='plan-click').t+report.wallMs),events=allEvents.filter(e=>e.t<=observationAt);
const totals={},workers={},pending=new Map(),queries=[];
for(const e of events){
 if(e.event==='worker-create')workers[e.worker]={kind:e.kind,createdAt:e.t,initializations:0,queries:0,cloneSendMs:0,spans:{}};
 if(e.event==='worker-post'){const w=workers[e.worker];w.initializations+=+e.initializes;w.queries++;w.cloneSendMs+=e.cloneSendMs;}
 if(e.event==='worker-exit')workers[e.worker].exitAt=e.t;
 if(e.event==='worker-span-start'){pending.set(e.worker+':'+e.sid,e);if(e.name==='walk-query')queries.push(e);}
 if(e.event==='worker-span-end'){pending.delete(e.worker+':'+e.sid);const name=e.kind+':'+e.name;const t=totals[name]??={count:0,totalMs:0,maxMs:0};t.count++;t.totalMs+=e.durationMs;t.maxMs=Math.max(t.maxMs,e.durationMs);const a=workers[e.worker].spans[e.name]??={count:0,totalMs:0,maxMs:0};a.count++;a.totalMs+=e.durationMs;a.maxMs=Math.max(a.maxMs,e.durationMs);}
}
const grouped=(key)=>{const rows=new Map();for(const q of queries){const k=key(q);const a=rows.get(k)??{key:k,count:0,workers:new Set(),times:new Set()};a.count++;a.workers.add(q.worker);a.times.add(q.request?.departureS);rows.set(k,a);}return [...rows.values()].map(x=>({...x,workers:[...x.workers],times:[...x.times]})).sort((a,b)=>b.count-a.count);};
const exact=grouped(q=>JSON.stringify([q.graph,q.request]));
const sameWorkerExact=grouped(q=>JSON.stringify([q.worker,q.graph,q.request]));
const spatial=grouped(q=>{const r={...q.request};delete r.departureS;return JSON.stringify([q.graph,r]);});
const cpu=[];
for(const file of readdirSync(dir).filter(f=>f.endsWith('.cpuprofile'))){let p;const raw=readFileSync(dir+'/'+file,'utf8');try{p=JSON.parse(raw);}catch{p=JSON.parse(raw.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g,'\\\\'));}if(p.cpuProfile)p=p.cpuProfile;const nodes=new Map(p.nodes.map(n=>[n.id,n])),self=new Map();for(let i=0;i<(p.samples?.length??0);i++){const node=nodes.get(p.samples[i]);const key=node.callFrame.functionName+'@'+node.callFrame.url.split('/').at(-1)+':'+(node.callFrame.lineNumber+1);self.set(key,(self.get(key)??0)+(p.timeDeltas?.[i]??1000));}cpu.push({file,sampledMs:(p.endTime-p.startTime)/1000,topSelf:[...self].sort((a,b)=>b[1]-a[1]).slice(0,15).map(([frame,us])=>({frame,ms:us/1000}))});}
const queue=events.filter(e=>e.event==='queue-start'),switches=queue.filter(e=>e.previousOwner!==undefined&&e.owner!==e.previousOwner);
const mainSpans={};for(const e of events.filter(e=>e.event==='span-end')){const a=mainSpans[e.name]??={count:0,totalMs:0,maxMs:0};a.count++;a.totalMs+=e.durationMs;a.maxMs=Math.max(a.maxMs,e.durationMs);}
const searchState=events.filter(e=>e.event==='walk-search-progress'||e.event==='walk-search-end');
const summary={runtime:report.runtime,id:report.id,need:report.need,state:report.state,wallMs:report.wallMs,routePerformance:report.routePerformance,memory:report.memory,eventLoopDelayMs:report.eventLoopDelayMs,mainSpans,workerTotals:totals,workers,queue:{tasks:queue.length,ownerSwitches:switches.length,initialOwnerActivations:queue.filter(e=>e.previousOwner===undefined).length,continuedOwnerQueries:queue.filter(e=>e.previousOwner===e.owner).length,starts:queue},pendingWorkerSpans:[...pending.values()].filter(x=>!workers[x.worker].exitAt),searchState,walkSubqueries:{sameWorkerExactRepeated:sameWorkerExact.filter(x=>x.count>1),crossWorkerCaveat:'Graph metadata does not establish identical semantics across Workers; demo and official graphs must remain isolated.',total:queries.length,exactUnique:exact.length,exactRepeated:exact.filter(x=>x.count>1),spatialUnique:spatial.length,topSpatial:spatial.slice(0,15)},cpu,candidates:report.candidates};
writeFileSync(dir+'/summary.json',JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
