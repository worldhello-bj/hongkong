import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Worker as NodeWorker} from 'node:worker_threads';
const base=fileURLToPath(new URL('../../dist',import.meta.url));
const workers=[];
globalThis.requestAnimationFrame=callback=>setTimeout(callback,0);
const els=new Map(),listeners=new Map();
function el(id){if(els.has(id))return els.get(id);const e={id,focus(){},innerHTML:'',textContent:'',style:{},dataset:{},clientWidth:1000,clientHeight:800,childElementCount:0,hidden:false,relList:{supports:()=>true},classList:{add(){},remove(){},toggle(){return false}},querySelector:s=>el(s),querySelectorAll:()=>[],setAttribute(){},getAttribute(){return null},toggleAttribute(){},getBoundingClientRect:()=>({height:200,width:1000,top:0,left:0}),addEventListener:(t,fn)=>listeners.set(id+':'+t,fn),insertAdjacentHTML(_,s){this.innerHTML+=s},matches:()=>false};els.set(id,e);return e}
globalThis.document={createElement:()=>el('created'),querySelector:el,querySelectorAll:()=>[]};
globalThis.window={innerWidth:1000,addEventListener(){}};globalThis.history={replaceState(){},pushState(){}};globalThis.location={hash:'#navigation'};Object.defineProperty(globalThis,"navigator",{value:{},configurable:true});globalThis.localStorage={getItem:()=>JSON.stringify({version:1,account:{id:"old-user",name:"演示旅客",kind:"local-demo",createdAt:1},preferences:{priority:"fast",stepFree:false,avoidCrowds:false,allowedModes:["taxi"]},privacy:{rememberOnDevice:true,serviceCreditOptIn:false},orders:[],providerAvailability:{},bookingKeys:{},paymentKeys:{},creditOrderIds:[]}),setItem(){},removeItem(){}};window.localStorage=globalThis.localStorage;
globalThis.fetch=async url=>{const path=new URL(url,'http://localhost').pathname;if(path.endsWith(process.env.HK_BOOT_CASE==='block'?'admiralty-block-graph.json.gz':'station-access-alternatives.json'))return new Promise(()=>{});try{return new Response(readFileSync(base+path),{status:200})}catch(e){return new Response('',{status:404})}};
globalThis.Worker=class {constructor(url){const path=base+new URL(url).pathname.replace(base,'');workers.push(this);this.w=new NodeWorker(`const {parentPort}=require('node:worker_threads');globalThis.self=globalThis;globalThis.postMessage=x=>parentPort.postMessage(x);parentPort.on('message',x=>globalThis.onmessage({data:x}));require(${JSON.stringify(path)});`,{eval:true,resourceLimits:{maxOldGenerationSizeMb:384}});this.w.on('message',data=>this.onmessage?.({data}));this.w.on('error',e=>{console.error('WORKER ERROR',e);this.onerror?.(e)});}postMessage(x){this.w.postMessage(x)}terminate(){this.w.terminate()}};
const version=JSON.parse(readFileSync(base+'/build-meta.json')).version;
console.log('TEST_RUNTIME',version);
let api;try{let source=readFileSync(base+'/assets/main-integrated.js','utf8').replace(/from\s*["'](\.\/[^"']+)["']/g,(_,p)=>'from '+JSON.stringify(new URL(p,'file://'+base+'/assets/main-integrated.js').href)).replace(/import\("(\.\.?\/[^"]+)"\)/g,(_,p)=>'import('+JSON.stringify(new URL(p,'file://'+base+'/assets/main-integrated.js').href)+')').replaceAll('import.meta.url',JSON.stringify('file://'+base+'/assets/main-integrated.js'));if(process.env.HK_DEBUG)source=source.replace('const accept=raw=>compatibleWithOverlay(raw,demoArea,demoBlock)?annotateDemoFallback(annotatePreferenceResult(raw,request),request):null;','const accept=raw=>{console.log("RAW_DEMO",JSON.stringify({message:raw.message,complete:raw.journey?.complete,blocked:raw.journey?.steps?.filter(s=>s.blocked),connectors:raw.journey?.steps?.filter(s=>s.kind==="access_connector"||s.guidance?.geometry_mode==="schematic"),routedEndpoints:raw.routedEndpoints}));return compatibleWithOverlay(raw,demoArea,demoBlock)?annotateDemoFallback(annotatePreferenceResult(raw,request),request):null;};');api=await import('data:text/javascript;base64,'+Buffer.from(source+'\nexport {r,S1,C,d1,V,f,D1,n1,publicDataPromise,f2,L1,Q,b2,z,O,t1};').toString('base64'));console.log('IMPORT OK')}catch(e){console.error('BOOT ERROR',e.stack);process.exitCode=1}
await api.publicDataPromise;
assert.equal(window.__navigationLoad.status,'ready');
assert.ok(el('[data-app="panel"]').innerHTML.includes('公交'));
assert.ok(el('[data-app="panel"]').innerHTML.includes('电车'));
if(process.env.HK_STOPS_ONLY){
 await new Promise(resolve=>setTimeout(resolve,10));
 assert.match(el('[data-app="transit-stops"]').innerHTML,/data-transit-stop/);
 const services=JSON.parse(readFileSync(base+'/transit/services.json')),stop=services.stops[0];
 api.f.x=(stop.coordinates[0]-114.165)*102900-100;api.f.y=-(stop.coordinates[1]-22.279)*111320-100;api.f.w=1000;api.n1();await new Promise(resolve=>setTimeout(resolve,10));
 listeners.get('[data-app="map"]:click')({type:'click',clientX:0,clientY:0,target:{closest:()=>({dataset:{transitStop:'0'}})},preventDefault(){},stopPropagation(){}});
 assert.equal(el('[data-app="stop-card"]').hidden,false);assert.match(el('[data-app="stop-card"]').innerHTML,/设为起点/);
 for(const side of ['origin','destination']){listeners.get('[data-app="stop-card"]:click')({target:{closest:()=>({dataset:{stopSide:side},hasAttribute:()=>false})}});assert.equal(api.r[side].id,stop.id);assert.deepEqual(api.r[side].coordinates,stop.coordinates);}
 assert.equal(api.r.need,'ordinary');assert.equal(api.t1.has('taxi'),false);
 console.log('STOP ENTRY PASS: default markers, card, both exact stop endpoints, preference/taxi unchanged');process.exit(0);
}
if(process.env.HK_BOOT_CASE==='quote-failure')api.O.createQuote=()=>{throw new Error('simulated pricing outage')};
const click=dataset=>listeners.get('#navigation-app:click')({target:{closest:()=>({dataset})}});
if(['land','accessible'].includes(process.env.HK_BOOT_CASE)||process.env.HK_LAND_ID){
 const fallbackRequest=process.env.HK_LAND_ID?JSON.parse(readFileSync(new URL('./fixtures/fallback-cross-shore.json',import.meta.url))).find(row=>row.id===Number(process.env.HK_LAND_ID)).request:JSON.parse(readFileSync(new URL('./fixtures/demo-fallback-requests.json',import.meta.url)))[2];
 const coordinates=(process.env.HK_BOOT_CASE==='accessible'||process.env.HK_LAND_ID)?[["origin",fallbackRequest.origin.coordinates],["destination",fallbackRequest.destination.coordinates]]:[['origin',[114.17405457978654,22.312218704929617]],['destination',[114.1750543331201,22.302091394706313]]];
 for(const [side,coordinate]of coordinates){
  api.r.target=side;api.f.x=(coordinate[0]-114.165)*102900-api.f.w/2;api.f.y=-(coordinate[1]-22.279)*111320-api.f.h/2;click({action:'confirm-map'});await new Promise(r=>setTimeout(r,2));
 }
 if(process.env.HK_BOOT_CASE==='accessible'||process.env.HK_LAND_ID)api.r.need=process.env.HK_NEED??fallbackRequest.need;
 if(process.env.HK_LAND_ID)for(const side of ['origin','destination'])if(fallbackRequest[side].node_id)api.r[side]={...fallbackRequest[side]};
 if(process.env.HK_TAXI==='1')api.t1.add('taxi');else if(process.env.HK_TAXI==='0')api.t1.clear();
 click({action:'plan'});
}else click({demoPreset:process.env.HK_BOOT_CASE==='block'?'same-shore':'rail'});
try{
 for(let i=0;i<(process.env.HK_FULL?180:90)&&api.d1&&(process.env.HK_FULL||!api.C.some(c=>c.available)||(process.env.HK_TAXI==='1'&&api.r.need!=='accessible'&&!api.C.some(c=>c.result.taxiQuote)));i++){await new Promise(r=>setTimeout(r,1000));if(i%10===0)console.log("PROGRESS",i,JSON.stringify(window.__navigationPerformance?.stages),api.C.map(c=>[c.id,c.available,c.result.message]));}
 for(const choice of api.C.filter(c=>c.available)){const pts=choice.result.journey?.steps?.flatMap(st=>st.guidance?.geometry?.type==='LineString'?st.guidance.geometry.coordinates:[])??[];if(pts.length){for(const [side,point] of [['origin',pts[0]],['destination',pts.at(-1)]]){assert.ok(Math.abs(point[0]-api.r[side].coordinates[0])<1e-7&&Math.abs(point[1]-api.r[side].coordinates[1])<1e-7,'original endpoint XY preserved: '+side);if(api.r[side].coordinates.length===3)assert.ok(Math.abs(point[2]-api.r[side].coordinates[2])<=1,'original endpoint height retained: '+side);}console.log('ENDPOINT_DIAGNOSTIC',JSON.stringify({id:choice.id,first:pts[0],last:pts.at(-1),totalMinutes:choice.result.totalMinutes}));}}
 for(const choice of api.C.filter(c=>c.available)){const result=choice.result,graph=result.journey?.graph;const ids=new Set((result.journey?.steps??[]).flatMap(st=>st.guidance?.edge_ids??[]));const used=(graph?.edges??[]).filter(e=>ids.has(e.id)),closed=new Set((graph?.closures??[]).flatMap(c=>c.physical_ids??[]));const forbidden=used.filter(e=>e.disabled||closed.has(e.physical_id)||(api.r.need==='accessible'&&(e.wheelchair_barrier===1||['stairs','stairlift','escalator','travelator'].includes(e.kind))));assert.equal(forbidden.length,0,'known forbidden source edges absent');console.log('EDGE_AUDIT',JSON.stringify({id:choice.id,usedCount:used.length,forbidden:forbidden.map(e=>e.id),modeled:used.filter(e=>e.source_id?.startsWith('MODELED')).map(e=>({id:e.id,length_m:e.length_m,duration_s:e.duration_s,coordinates:e.coordinates})),sourceIds:[...ids]}));}
 console.log('MEMORY_DIAGNOSTIC',JSON.stringify({memory:process.memoryUsage(),maxRSS:process.resourceUsage().maxRSS}));
 console.log('FINAL_DIAGNOSTIC',JSON.stringify(window.__navigationPerformance),api.C.map(c=>[c.id,c.available,c.result.message]),el('[data-app="status"]').textContent);
 if(process.env.HK_BOOT_CASE==='accessible'){
  // This fixed map-point fixture has unverified first/last access. The old
  // assertion incorrectly demanded an enabled Start for an ordinary-profile
  // fallback relabelled strict. A complete strict source path has its own
  // positive engine tests; this is the explicit negative startup/UI contract.
  const strictInput=JSON.parse(readFileSync(new URL('./fixtures/demo-fallback-requests.json',import.meta.url)))[2];
  assert.equal(api.r.need,'accessible');for(const side of ['origin','destination'])assert(api.r[side].coordinates.every((v,i)=>Math.abs(v-strictInput[side].coordinates[i])<1e-7),'strict original endpoint preserved');
  assert.equal(api.d1,false,'all strict phases actually terminate');
  assert.equal(window.__navigationPerformance.comparisonStatus,'complete');
  assert.deepEqual(window.__navigationPerformance.failedStages,[]);
  assert.equal(api.C.filter(c=>c.available).length,0,'unverified endpoint access cannot become a strict candidate');
  assert(api.C.some(c=>/无障碍.*尚未核验/.test(c.result.message)),'exact unverified-access reason remains visible');
  assert(!/data-action="start"(?![^>]*disabled)/.test(el('[data-app="panel"]').innerHTML),'no navigation start for unknown strict access');
  const beforeStage=api.r.stage;click({action:'start'});assert.equal(api.r.stage,beforeStage,'programmatic start cannot bypass strict completeness');
  console.log('Strict negative fixture passed: original endpoints retained, unknown access rejected, no enabled or programmatic Start');
 }else{
 assert.ok(/data-action="start"(?![^>]*disabled)/.test(el('[data-app="panel"]').innerHTML),'start button usable immediately');
 if(process.env.HK_TAXI!==undefined){const quotes=api.C.filter(c=>c.result.taxiQuote);assert.equal(quotes.length>0,process.env.HK_TAXI==='1'&&api.r.need!=='accessible','taxi policy matches selected profile/toggle');if(api.r.need==='luggage'&&quotes.length){assert.equal(quotes[0].result.needsVehicleConfirmation,true);assert.equal(quotes[0].result.luggageSpaceUnverified,true);assert.match(quotes[0].result.message,/后备厢容量/);assert.equal(quotes[0].luggageCompatible,undefined);}}
 click({action:'cancel-plan'});
 assert.equal(api.d1,false,'routing completes');
 assert.ok(api.C.some(c=>(process.env.HK_NEED||c.id.startsWith('transit'))&&c.available),'public route stays available with optional resource stalled and legacy taxi-only stored preferences');
 assert.ok(api.C.some(c=>c.available&&!c.result.taxiQuote&&el('[data-app="panel"]').innerHTML.includes('data-choice="'+c.id+'"')),'usable public result rendered by stable route identity');
 if(api.r.need==='accessible'){const result=api.C.find(c=>c.available);assert.equal(result.accessibility,'unknown');assert.equal(result.result.accessibilityVerified,false);assert.equal(result.result.needsConfirmation,true);}
 }
 console.log('Full entry + real Worker + rendered public route passed:',process.env.HK_BOOT_CASE??'metadata','stalled; legacy stored taxi-only policy and navigation hash');
}finally{for(const worker of workers)worker.terminate();}

process.exit(process.exitCode??0); // Dispose the demo fleet timer after a successful harness run.
