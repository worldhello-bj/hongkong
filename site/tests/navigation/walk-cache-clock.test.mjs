import test from'node:test';
import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import vm from'node:vm';
import{patchWalkCacheClock,restoreWalkCacheClock,walkCacheClockAssets}from'../../scripts/repair-walk-cache-clock.mjs';

globalThis.document??={createElement:()=>({relList:{supports:()=>true}})};
const once=(source,before,after)=>{assert.equal(source.split(before).length,2,before);return source.replace(before,after);};
const engines=[];
for(const file of walkCacheClockAssets){
 const url=new URL('../../dist/assets/'+file,import.meta.url),raw=restoreWalkCacheClock(readFileSync(url,'utf8')),worker=file.startsWith('app-');
 const load=async source=>{
  const context={self:{},setTimeout,clearTimeout,DOMException,console,__walkCalls:0};
  for(const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)";/g)){
   const module=await import(new URL(match[2],url).href);
   for(const binding of match[1].split(',')){const[name,alias]=binding.trim().split(/\s+as\s+/);context[alias??name]=module[name];}
  }
  // Count calls below the owner memo without changing either route implementation.
  source=once(source,worker?'R=ft(W,{origin:i':'S=Te($,{origin:e',worker?'globalThis.__walkCalls++,R=ft(W,{origin:i':'globalThis.__walkCalls++,S=Te($,{origin:e');
  source=source.replace(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)";/g,'').replace(/export\{[^;]+;/g,'');
  source=worker?once(source,'let tt;self.onmessage','globalThis.engine={router:jt,prepare:Ae};let tt;self.onmessage'):source+'\nglobalThis.engine={router:ft,prepare:Ae};';
  vm.createContext(context);vm.runInContext(source,context);return{...context.engine,context};
 };
 engines.push({file,raw,baseline:await load(raw),candidate:await load(patchWalkCacheClock(raw).source)});
}
const xy=i=>[114.16+i*.0001,22.28];
function area(){
 const nodes=[0,1].map(i=>({id:'n'+i,region_id:'R',coordinates:xy(i)}));
 const edges=[[0,1],[1,0]].map(([a,b])=>({id:`e${a}-${b}`,physical_id:`e${a}-${b}`,from_id:'n'+a,to_id:'n'+b,region_id:'R',kind:'walk',name:'walk',length_m:10,duration_s:10,coordinates:[xy(a),xy(b)],geometry_mode:'official',source_id:'TEST',snap_eligible:true,accessible_eligible:true,disabled:false}));
 return{version:'clock-fixture',nodes,edges,regions:[{id:'R',center:xy(0),radius_m:1000}],portals:nodes.map(n=>({id:'s'+n.id,node_id:n.id,region_id:'R',name:n.id,coordinates:n.coordinates}))};
}
const origin=()=>({lon:xy(0)[0],lat:xy(0)[1],node_id:'n0'});
const destination=()=>({lon:xy(1)[0],lat:xy(1)[1],node_id:'n1',access_time_id:'DEST',access_schedule:{source_rule_id:'DEST',kind:'daily',timezone:'Asia/Hong_Kong',windows:[{start_s:100,end_s:200}]}});
const request=(departureS,dest=destination(),departureDate='2026-10-12')=>({origin:origin(),destination:dest,preference:'fast',allowedModes:['bus'],departureS,departureDate,horizonS:1000});
const make=engine=>engine.router(engine.prepare(area()),{stops:[],patterns:[],connections:[]},{graph_version:'clock-fixture',preference:'fast',connections:[],warnings:[]});
const run=async(router,req,signal)=>structuredClone(await router.route(req,signal));

test('repair is reversible, idempotent, layered, capacity-preserving and rejects anchor drift',()=>{
 for(const{raw}of engines){
  const result=patchWalkCacheClock(raw);assert.equal(result.changes,1);assert.equal(restoreWalkCacheClock(result.source),raw);assert.equal(patchWalkCacheClock(result.source).changes,0);
  const layered='/* unrelated outer patch */\n'+result.source;assert.equal(patchWalkCacheClock(layered).source,layered);assert.equal(restoreWalkCacheClock(layered),'/* unrelated outer patch */\n'+raw);
  assert.equal(result.source.replace('/* HK_WALK_CACHE_CLOCK_V1 */\n','').length-raw.length,-11);
  assert.equal((result.source.match(/(?:H|z)\.size>=512/g)??[]).length,1);
  assert.throws(()=>patchWalkCacheClock(raw+raw),/anchor drift/);
  assert.throws(()=>patchWalkCacheClock(result.source.replace(/JSON\.stringify\(\[(?:i,m,v,U,K|e,i,m,R,E)\]\)/,'BROKEN_KEY')),/anchor drift/);
  assert.throws(()=>patchWalkCacheClock(result.source.replace('/* HK_WALK_CACHE_CLOCK_V1 */\n','')),/unmarked/);
 }
 assert.throws(()=>patchWalkCacheClock('unknown'),/anchor drift/);
});
test('both actual unmodified routers reproduce stale opening waits and closed-destination acceptance',async()=>{
 for(const{file,baseline}of engines){
  const a=make(baseline);await run(a,request(0));const warm=await run(a,request(100)),cold=await run(make(baseline),request(100));
  assert.equal(warm.arrivalS,200.00002,file);assert.equal(cold.arrivalS,110.00002,file);assert.notDeepEqual(warm,cold);
  const b=make(baseline);await run(b,request(100));assert.equal((await run(b,request(250))).status,'CONDITIONAL');assert.equal((await run(make(baseline),request(250))).status,'NO_ROUTE');
 }
});
test('repaired owners match complete cold results before, during and after destination opening in either query order',async()=>{
 for(const{file,candidate}of engines)for(const order of[[0,100,150,199,200,250],[250,200,199,150,100,0]]){
  const owner=make(candidate);
  for(const time of order){const req=request(time),before=structuredClone(req);assert.deepEqual(await run(owner,req),await run(make(candidate),req),file+' t='+time);assert.deepEqual(req,before);}
  assert.equal((await run(owner,request(100))).status,'CONDITIONAL');assert.equal((await run(owner,request(250))).status,'NO_ROUTE');
 }
});
test('weekly endpoint rules use the original departure date, including cold/warm closed-day queries',async()=>{
 for(const{baseline,candidate}of engines){
  const dest=destination();Object.assign(dest.access_schedule,{kind:'weekly',week_start:'MON'});
  const monday=request(100,dest,'2026-10-12'),tuesday=request(100,dest,'2026-10-13'),old=make(baseline);await run(old,monday);
  assert.equal((await run(old,tuesday)).status,'CONDITIONAL');assert.equal((await run(make(baseline),tuesday)).status,'NO_ROUTE');
  for(const order of[[monday,tuesday],[tuesday,monday]]){const owner=make(candidate);for(const req of order)assert.deepEqual(await run(owner,req),await run(make(candidate),req));}
 }
});
test('full endpoint contents retain same-clock schedule changes and exact source-node restrictions',async()=>{
 for(const{baseline,candidate}of engines)for(const engine of[baseline,candidate]){
  const owner=make(engine),req=request(100);await run(owner,req);
  req.destination.access_schedule.windows=[{start_s:300,end_s:400}];const before=structuredClone(req);
  assert.deepEqual(await run(owner,req),await run(make(engine),req));assert.deepEqual(req,before);
  const missing={...req,destination:{...req.destination,node_id:'missing-source-node'}};
  assert.equal((await run(owner,missing)).status,'OUT_OF_REGION');assert.deepEqual(await run(owner,missing),await run(make(engine),missing));
 }
});
test('origin opening checks also remain independent of earlier cached closed or open departures',async()=>{
 for(const{candidate}of engines)for(const order of[[0,100,250],[250,100,0]]){
  const owner=make(candidate);
  for(const time of order){
   const req=request(time),rule=req.destination.access_schedule;req.origin={...req.origin,access_time_id:'DEST',access_schedule:rule};delete req.destination.access_time_id;delete req.destination.access_schedule;
   const before=structuredClone(req),result=await run(owner,req);assert.equal(result.status,time===100?'CONDITIONAL':'NO_ROUTE');assert.deepEqual(result,await run(make(candidate),req));assert.deepEqual(req,before);
  }
 }
});
test('invalid clocks and dates keep validation behavior without populating the owner cache',async()=>{
 for(const{baseline,candidate}of engines)for(const engine of[baseline,candidate]){
  const owner=make(engine);await run(owner,request(100));const calls=engine.context.__walkCalls;
  for(const time of[undefined,null,NaN,Infinity,-Infinity])await assert.rejects(owner.route(request(time)),/Invalid route time\/horizon\/penalty/);
  for(const date of[null,'unknown','2026-02-30'])assert.equal((await run(owner,request(100,destination(),date))).status,'NO_ROUTE');
  assert.equal(engine.context.__walkCalls,calls);
 }
});
test('missing, unknown and malformed endpoint rules remain fail-closed after a valid warm result',async()=>{
 for(const{candidate}of engines)for(const side of['origin','destination']){
  for(const invalid of[undefined,null,{kind:'unknown'}, {...destination().access_schedule,source_rule_id:'OTHER'}, {...destination().access_schedule,windows:[]}, {...destination().access_schedule,windows:[{start_s:200,end_s:100}]}]){
   const owner=make(candidate);await run(owner,request(100));const req=request(100);req[side]={...req[side],access_time_id:'DEST',access_schedule:invalid};const before=structuredClone(req);
   assert.equal((await run(owner,req)).status,'NO_ROUTE');assert.deepEqual(await run(owner,req),await run(make(candidate),req));assert.deepEqual(req,before);
  }
 }
});
test('same full-precision clock/date hits the existing memo; distinct fractional clocks do not collide',async()=>{
 for(const{candidate}of engines){
  const owner=make(candidate),req=request(100.00000000000001),start=candidate.context.__walkCalls;
  const first=await run(owner,req),filled=candidate.context.__walkCalls;assert.equal(filled-start,1);
  assert.deepEqual(await run(owner,structuredClone(req)),first);assert.equal(candidate.context.__walkCalls,filled);
  const next=request(100.00000000000003);assert.deepEqual(await run(owner,next),await run(make(candidate),next));assert.equal(candidate.context.__walkCalls,filled+2);
 }
});
test('cancellation before work and at the original cooperative yield is preserved with warm and cold owners',async()=>{
 for(const{baseline,candidate}of engines)for(const engine of[baseline,candidate])for(const warm of[false,true]){
  const owner=make(engine),req=request(100);if(warm)await run(owner,req);const before=structuredClone(req),calls=engine.context.__walkCalls;
  let controller=new AbortController();controller.abort();await assert.rejects(owner.route(req,controller.signal),{name:'AbortError'});assert.equal(engine.context.__walkCalls,calls);
  controller=new AbortController();const pending=owner.route(req,controller.signal);queueMicrotask(()=>controller.abort());await assert.rejects(pending,{name:'AbortError'});assert.equal(engine.context.__walkCalls,calls);assert.deepEqual(req,before);
 }
});
