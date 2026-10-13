const root=fileURLToPath(new URL('../../../',import.meta.url));
const runtime=fileURLToPath(new URL('../runtime-2e2fcf795897/',import.meta.url));
const out=fileURLToPath(new URL('./',import.meta.url));
import fs from 'node:fs';
import vm from 'node:vm';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';

const file=pathToFileURL(runtime+'assets/app-transit-worker-CaCMeUxU.js');
let source=fs.readFileSync(file,'utf8');
const context={self:{},setTimeout,clearTimeout,DOMException,console,__walkCalls:0,__scheduledCalls:0};
for(const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)";/g)){
 const mod=await import(new URL(match[2],file).href);for(const item of match[1].split(',')){const[name,alias]=item.trim().split(/\s+as\s+/);context[alias??name]=mod[name];}
}
const once=(a,b)=>{assert.equal(source.split(a).length,2,a);source=source.replace(a,b);};
once('function ft(t,e){','function ft(t,e){globalThis.__walkCalls++;throw Error("NO WALK SEARCH AUTHORIZED");');
once('function Dt(t,e){','function Dt(t,e){globalThis.__scheduledCalls++;globalThis.__captured={network:t,request:e};return null;');
once('resolveConnectionAt:le,connectionOpeningTimesS:ze','resolveConnectionAt:le,__auditDynamicIds:[...oe.keys()],__auditOrigins:ne,__auditDestinations:V,connectionOpeningTimesS:ze');
once('let tt;self.onmessage','globalThis.engine={router:jt,prepare:Ae,prepareTrips:Ot};let tt;self.onmessage');
source=source.replace(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)";/g,'');
vm.createContext(context);vm.runInContext(source,context);
const json=path=>JSON.parse(path.endsWith('.gz')?zlib.gunzipSync(fs.readFileSync(root+path)):fs.readFileSync(root+path));
const area=json('dist/area/area-graph.json.gz'),block=json('dist/area/admiralty-block-graph.json.gz'),station=json('dist/area/station-graph.json.gz'),services=json('dist/transit/services.json'),links=json('dist/transit/walk-links.json.gz');
const main=fs.readFileSync(root+'src/navigation/main.recovered.js','utf8'),start=main.indexOf('function g2('),end=main.indexOf('async function f2(',start);assert.ok(start>=0&&end>start);
context.m2=context.engine.prepare;context.V1=new WeakMap();vm.runInContext(main.slice(start,end),context);const detailed=context.g2(area,block);
const report=json('validation/performance/od36-current-clock120-2e2fcf795897-od36-ordinary/report.json');
const req={...report.request,preference:'fast',allowedModes:['bus','tram','metro'],departureS:28800,departureDate:'2026-10-12',horizonS:21600};
const owner=context.engine.router(context.engine.prepare(area),services,links,context.engine.prepare(station),detailed);await owner.route(req);
assert.equal(context.__walkCalls,0);assert.equal(context.__scheduledCalls,1);
const {network,request}=context.__captured;
const dynamic=new Set(request.__auditDynamicIds),arcs=[];
for(const edge of network.connections){if(edge.kind==='metro'&&!request.allowedModes.includes('metro'))continue;const seconds=dynamic.has(edge.id)?0:Math.floor(edge.durationS);arcs.push({from:edge.fromId,to:edge.toId,time:seconds,walk:edge.kind==='walk'?seconds:0,kind:dynamic.has(edge.id)?'dynamic':'static',id:edge.id});}
for(const p of network.patterns){if(!request.allowedModes.includes(p.mode))continue;const trips=context.engine.prepareTrips(p,request.departureS-p.stops.at(-1).arrivalOffsetS,request.departureS+request.horizonS);if(!trips.length)continue;for(let i=0;i+1<p.stops.length;i++){const seconds=Math.min(...trips.map(t=>Math.floor(t.startS+p.stops[i+1].arrivalOffsetS)-Math.floor(t.startS+p.stops[i].departureOffsetS)));arcs.push({from:p.stops[i].stopId,to:p.stops[i+1].stopId,time:seconds,walk:0,kind:'pattern',id:p.id});}}
const nodes=new Set(arcs.flatMap(e=>[e.from,e.to]));
const distances=field=>{const d=new Map([[request.toId,0]]);for(let pass=0;pass<nodes.size;pass++){let changed=false;for(const e of arcs){const value=e[field]+(d.get(e.to)??Infinity);if(value<(d.get(e.from)??Infinity)){d.set(e.from,value);changed=true;}}if(!changed)return d;}throw Error('unexpected negative cycle');};
const td=distances('time'),wd=distances('walk');const summary=json('validation/performance/od36-current-clock120-2e2fcf795897-od36-ordinary/final-summary.json');
const tops=summary.latestScheduled.labelIndex.topNodes;
const counts=dist=>({zero:[...nodes].filter(n=>dist.get(n)===0).length,positive:[...nodes].filter(n=>Number.isFinite(dist.get(n))&&dist.get(n)>0).length,unreachable:[...nodes].filter(n=>!dist.has(n)).length});
const result={runtime:json('dist/build-meta.json').version,searchInvocations:{walk:context.__walkCalls,scheduledOriginal:0},inputCounts:{areaNodes:area.nodes.length,detailedNodes:detailed.nodes.length,stationNodes:station.nodes.length,stops:network.stops.length,patterns:network.patterns.length,connections:network.connections.length,dynamic:dynamic.size,macroNodes:nodes.size},origins:request.__auditOrigins.map(s=>s.id),destinations:request.__auditDestinations.map(s=>s.id),time:counts(td),walk:counts(wd),topNodes:tops.map(row=>({...row,timeBound:td.get(row.node)??null,walkBound:wd.get(row.node)??null})),allBounds:[...nodes].map(node=>({node,time:td.get(node)??null,walk:wd.get(node)??null})),arcs};
fs.writeFileSync(out+'topology.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,arcs:undefined,allBounds:undefined},null,2));
