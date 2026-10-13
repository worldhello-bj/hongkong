import test from 'node:test';import assert from 'node:assert/strict';
import{readFileSync,writeFileSync,mkdtempSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';import{pathToFileURL}from'node:url';import vm from'node:vm';
import{routeMemo,connectionEvidence,indoorGraph}from'../../src/navigation/route-memory.js';
import{patchRouteMemory,restoreRouteMemory,routeMemoryAssets}from'../../scripts/repair-route-memory.mjs';
const key=(id,time)=>JSON.stringify([id,time]);
test('bounded memo pairs evidence eviction, retains null hits, and does not mutate referenced results',()=>{
 const evidence=new Map,memo=routeMemo(2,evidence),route={legs:[{id:'kept'}]};
 evidence.set('a',route);assert.equal(memo.set('a',route),memo);memo.set('b',null);assert.equal(memo.get('b'),null);assert.ok(memo.has('b'));memo.set('a',route);memo.set('c',3);
 assert.equal(memo.has('a'),false);assert.equal(evidence.has('a'),false);assert.deepEqual(route,{legs:[{id:'kept'}]});assert.equal(memo.size,2);memo.delete('b');memo.set('d',4);assert.equal(memo.size,2);memo.clear();assert.equal(memo.size,0);assert.equal(evidence.size,0);
});
test('duplicate IDs retain original memo alias semantics while unique IDs stay bounded',()=>{
 const evidence=new Map,memo=routeMemo(1,evidence,[{id:'duplicate'},{id:'duplicate'},{id:'unique'}]);
 for(let time=0;time<5;time++){const k=key('duplicate',time);evidence.set(k,{time});memo.set(k,time)}
 memo.set(key('unique',0),null);memo.set(key('unique',1),1);assert.equal(memo.size,6);assert.equal(evidence.size,5);assert.equal(memo.get(key('duplicate',0)),0);assert.equal(memo.has(key('unique',0)),false);
});
test('evidence replay uses full floating departure and original endpoints; null/cancel never fall back to stale route',()=>{
 const evidence=new Map,source={id:'c',fromId:'a',toId:'b'},connections=[source],memo=routeMemo(1,evidence,connections),leg={connectionId:'c',fromId:'a',toId:'b',departureS:100.123456789},resolvers=new Map([['c',true]]),staticEvidence=new Map([['c',{stale:true}]]);let calls=0;
 const resolve=(connection,time)=>{assert.equal(connection,source);assert.equal(time,leg.departureS);calls++;evidence.set(key('c',time),{fresh:true});memo.set(key('c',time),connection);return connection};
 assert.deepEqual(connectionEvidence(evidence,memo,staticEvidence,connections,leg,resolve,key,resolvers),{fresh:true});assert.equal(calls,1);connectionEvidence(evidence,memo,staticEvidence,connections,leg,resolve,key,resolvers);assert.equal(calls,1);
 memo.set(key('other',0),null);assert.equal(connectionEvidence(evidence,memo,staticEvidence,connections,leg,()=>null,key,resolvers),undefined);
 assert.throws(()=>connectionEvidence(evidence,memo,staticEvidence,connections,leg,()=>{throw new DOMException('Aborted','AbortError')},key,resolvers),{name:'AbortError'});
 assert.deepEqual(connectionEvidence(evidence,memo,staticEvidence,connections,leg,resolve,key,new Map),{stale:true});
});
test('both production bundle transforms are narrow, reversible, configurable and idempotent',()=>{
 for(const file of routeMemoryAssets){const source=restoreRouteMemory(readFileSync(new URL('../../dist/assets/'+file,import.meta.url),'utf8'));const patched=patchRouteMemory(source);assert.equal(patched.changes,1);assert.equal(patchRouteMemory(patched.source).changes,0);assert.equal(restoreRouteMemory(patched.source),source);const small=patchRouteMemory(patched.source,{connectionLimit:1,stationLimit:2});assert.equal(restoreRouteMemory(small.source),source);assert.equal(patchRouteMemory(small.source,{connectionLimit:1,stationLimit:2}).changes,0)}
 assert.throws(()=>patchRouteMemory('drift'),/anchor drift/);assert.throws(()=>routeMemo(0),/capacity/);
});
const dir=mkdtempSync(join(tmpdir(),'hk-route-memory-'));
globalThis.document={createElement:()=>({relList:{supports:()=>true}})};
const stats={evictions:0,replays:0};globalThis.__routeMemoryStats=stats;
function counted(source){return source.replace('if(order.size>=capacity)remove(order.values().next().value);','if(order.size>=capacity){globalThis.__routeMemoryStats.evictions++;remove(order.values().next().value);}') .replace('memo.delete(key);\n if(!resolve','globalThis.__routeMemoryStats.replays++;memo.delete(key);\n if(!resolve')}
const engines=[];
for(const file of routeMemoryAssets){const url=new URL('../../dist/assets/'+file,import.meta.url),original=restoreRouteMemory(readFileSync(url,'utf8')),worker=file.startsWith('app-');let baseline,candidate;
 const load=async(source,label)=>{
  if(worker){const context={self:{},setTimeout,clearTimeout,DOMException,console,__routeMemoryStats:stats};for(const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)";/g)){const module=await import(new URL(match[2],url).href);for(const binding of match[1].split(',')){const [name,alias]=binding.trim().split(/\s+as\s+/);context[alias??name]=module[name]}}source=source.replace(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)";/g,'');vm.createContext(context);source=source.replace('let tt;self.onmessage','globalThis.engine={router:jt,prepare:Ae,walk:ft,station:Lt,scheduled:Dt};let tt;self.onmessage');vm.runInContext(source,context);return context.engine}
  source=source.replace(/from\s*["'](\.\.?\/[^"']+)["']/g,(_,p)=>'from '+JSON.stringify(new URL(p,url).href));source+='\nexport {ft as router,Ae as prepare,Te as walk,Ye as station,Xe as scheduled};';const path=join(dir,label+'.mjs');writeFileSync(path,source);return import(pathToFileURL(path).href)
 };
 baseline=await load(original,file+'-original');candidate=await load(counted(patchRouteMemory(original,{connectionLimit:1,stationLimit:2}).source),file+'-candidate');engines.push({file,baseline,candidate});
}
const prefs=['fast','few_stairs','accessible','escalator_first','lift_first','luggage'];
function graph({timed=false,noWait=false}={}){
 const nodes=Array.from({length:9},(_,i)=>({id:'n'+i,region_id:'R',coordinates:[114.16+i*.001,22.28,0],...(noWait&&i===4?{wait_allowed:false}:{})}));
 nodes.push({id:'isolated',region_id:'R',coordinates:[...nodes[0].coordinates]},{id:'__area_origin__',region_id:'R',coordinates:[...nodes[0].coordinates]},{id:'upper',region_id:'R',coordinates:[114.16,22.28,20]});
 const edges=[];for(let i=0;i<8;i++)for(const [from,to]of[[i,i+1],[i+1,i]])edges.push({id:`e${from}-${to}`,physical_id:`e${from}-${to}`,region_id:'R',from_id:'n'+from,to_id:'n'+to,kind:i===3?'stairs':'walk',name:'edge '+i,length_m:100,duration_s:20,coordinates:[nodes[from].coordinates,nodes[to].coordinates],geometry_mode:'official',source_id:'CSDI-INDOOR',snap_eligible:true,accessible_eligible:true,disabled:false,...timed&&i===4?{access_time_id:'daily',access_schedule:{source_rule_id:'daily',kind:'daily',label:'test daily',windows:[{start_s:50,end_s:800}]}}:{}});
 return{version:'fixture',regions:[{id:'R',center:[114.164,22.28],radius_m:10000}],nodes,edges,portals:nodes.map((n,i)=>({id:'s'+i,node_id:n.id,region_id:'R',name:'stop '+i,coordinates:n.coordinates,offset_m:0})),warnings:[]};
}
const normalize=result=>structuredClone(result);
test('sparse indoor graph retains all nodes/edges and drops only edge-isolated synthetic portals',()=>{
 const g=graph(),nodes=g.nodes,ids=new Set(nodes.map(n=>n.id)),sparse=indoorGraph(g,'R',nodes,ids);assert.equal(sparse.nodes,nodes);assert.deepEqual(sparse.edges,g.edges);assert.equal(sparse.portals.length,9);assert.equal(sparse.nodes.length,12);assert.equal(sparse.portals.some(p=>p.node_id==='isolated'),false);
});
test('both actual station resolvers preserve all preferences, dates, no-wait rules and isolated same-coordinate node diagnostics',()=>{
 let compared=0,success=0;for(const {file,baseline,candidate}of engines)for(const timed of[false,true])for(const noWait of[false,true]){
  const raw=graph({timed,noWait}),a=baseline.station(baseline.prepare(structuredClone(raw))),b=candidate.station(candidate.prepare(structuredClone(raw)));
  for(const preference of prefs)for(const [from,to]of[['n0','n8'],['n8','n0'],['isolated','n0'],['isolated','isolated'],['upper','n0'],['__area_origin__','n8']])for(const departure of[0,100,900])for(const date of['2026-10-11','2026-10-12']){
   const result=normalize(b(from,to,preference,departure,date));assert.deepEqual(result,normalize(a(from,to,preference,departure,date)),`${file}/${timed}/${noWait}/${preference}/${from}/${to}/${departure}`);compared++;if(result)success++;
  }
 }
 assert.equal(compared,1728);assert.ok(success>0);assert.ok(stats.evictions>0);console.log('station oracle',compared,'successful',success,'memo evictions',stats.evictions);
});
test('actual walk outputs retain exact isolated-node diagnostics, multi-node anchors and synthetic node collision behavior',()=>{
 let compared=0;for(const {file,baseline,candidate}of engines){
  const raw=graph({timed:true}),nodes=raw.nodes,derived=indoorGraph(raw,'R',nodes,new Set(nodes.map(n=>n.id))),full={...derived,portals:nodes.map(n=>({id:'EXACT:'+n.id,node_id:n.id,name:'官方站内节点',region_id:'R',coordinates:n.coordinates,offset_m:0}))};
  const a=baseline.prepare(structuredClone(full)),b=candidate.prepare(structuredClone(derived));
  for(const preference of prefs)for(const id of['isolated','upper','__area_origin__','n0'])for(const multi of[false,true]){
   const node=nodes.find(n=>n.id===id),origin={lon:node.coordinates[0],lat:node.coordinates[1],...multi?{node_ids:[id,'n1']}:{node_id:id}},request={origin,destination:{lon:114.168,lat:22.28,node_id:'n8'},preference,mode:'walk',departureS:0,departureDate:'2026-10-12'};
   assert.deepEqual(normalize(candidate.walk(b,request)),normalize(baseline.walk(a,request)),`${file}/${preference}/${id}/${multi}`);compared++;
  }
 }
 assert.equal(compared,96);
});
function inputs(options){const area=graph(options),coordinates=i=>area.nodes[i].coordinates.slice(0,2),services={stops:[1,7].map(i=>({id:'s'+i,name:'stop '+i,coordinates:coordinates(i)})),connections:[],patterns:[{id:'bus',routeId:'bus',label:'bus',mode:'bus',direction:'forward',geometryMode:'official',stops:[{stopId:'s1',arrivalOffsetS:0,departureOffsetS:0,shapeIndex:0},{stopId:'s7',arrivalOffsetS:10,departureOffsetS:10,shapeIndex:1}],shape:[coordinates(1),coordinates(7)],schedule:{departuresS:[40,100,200,500]},provenance:{sourceUrl:'fixture',scheduleKind:'scheduled',timingNote:'fixture'}}]},links={graph_version:area.version,preference:'fast',connections:[],warnings:[]};return{area,services,links}}
test('both actual full intermodal engines preserve successful multileg routes under forced paired eviction and replay',async()=>{
 let compared=0,success=0,multileg=0;const priorReplays=stats.replays;
 for(const {file,baseline,candidate}of engines)for(const timed of[false,true])for(const noWait of[false,true]){
  const data=inputs({timed,noWait}),a=baseline.router(baseline.prepare(structuredClone(data.area)),structuredClone(data.services),structuredClone(data.links)),b=candidate.router(candidate.prepare(structuredClone(data.area)),structuredClone(data.services),structuredClone(data.links));
  for(const preference of prefs)for(const departureS of[0,80,900])for(const date of['2026-10-11','2026-10-12']){
   const request={origin:{lon:114.16,lat:22.28,node_id:'n0'},destination:{lon:114.168,lat:22.28,node_id:'n8'},preference,departureS,departureDate:date,horizonS:1200,allowedModes:['bus'],walkPenalty:2.5};
   const expected=normalize(await a.route(request)),actual=normalize(await b.route(request));assert.deepEqual(actual,expected,`${file}/${timed}/${noWait}/${preference}/${departureS}`);compared++;if(actual.status==='CONDITIONAL'){success++;if(actual.timedLegs.some(l=>l.kind==='bus')&&actual.timedLegs.filter(l=>l.connectionId).length>=2)multileg++}
  }
  const controller=new AbortController();controller.abort();for(const router of[a,b])await assert.rejects(router.route({origin:{lon:114.16,lat:22.28},destination:{lon:114.168,lat:22.28},departureS:0},controller.signal),{name:'AbortError'});
  for(const router of[a,b]){const controller=new AbortController(),pending=router.route({origin:{lon:114.16,lat:22.28},destination:{lon:114.168,lat:22.28},departureS:0},controller.signal);queueMicrotask(()=>controller.abort());await assert.rejects(pending,{name:'AbortError'})}
 }
 assert.equal(compared,288);assert.ok(success>0);assert.ok(multileg>0);assert.ok(stats.replays>priorReplays);console.log('full intermodal oracle',compared,'successful',success,'multileg',multileg,'replays',stats.replays-priorReplays);
});
test.after(()=>{delete globalThis.__routeMemoryStats;rmSync(dir,{recursive:true,force:true})});
