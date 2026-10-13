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
const rows=JSON.parse(readFileSync(new URL('./fixtures/land-coverage-72.json',import.meta.url))).rows;
const index=Number(process.env.HK_MATRIX_OD??1)-1,need=process.env.HK_NEED??'ordinary';
const request=rows[index].request;
api.r.origin=structuredClone(request.origin);api.r.destination=structuredClone(request.destination);api.r.need=need;api.t1.add('taxi');
const click=dataset=>listeners.get('#navigation-app:click')({target:{closest:()=>({dataset})}});
click({action:'plan'});
const started=Date.now();let state;
for(;;){
 await new Promise(resolve=>setTimeout(resolve,500));
 const available=api.C.filter(c=>c.available),taxiDone=window.__navigationPerformance?.stages.some(s=>s.id==='taxi');
 const pure=available.some(c=>!c.result.taxiQuote);
 if(!api.d1||(pure&&taxiDone)||Date.now()-started>=60000){state=!api.d1?'complete':pure&&taxiDone?'usable-public-and-taxi-comparison':'diagnostic-window-ended';break;}
}
const rowsOut=api.C.filter(c=>c.available).map(choice=>{
 const result=choice.result,points=result.journey?.steps?.flatMap(step=>step.guidance?.geometry?.type==='LineString'?step.guidance.geometry.coordinates:[])??[];
 const endpoints=points.length?Math.abs(points[0][0]-request.origin.coordinates[0])<1e-7&&Math.abs(points[0][1]-request.origin.coordinates[1])<1e-7&&Math.abs(points.at(-1)[0]-request.destination.coordinates[0])<1e-7&&Math.abs(points.at(-1)[1]-request.destination.coordinates[1])<1e-7:false;
 const ids=new Set(result.journey.steps.flatMap(step=>step.guidance?.edge_ids??[])),graph=result.journey.graph;
 const closed=new Set((graph?.closures??[]).flatMap(c=>c.physical_ids??[]));
 const forbidden=(graph?.edges??[]).filter(edge=>ids.has(edge.id)&&(edge.disabled||closed.has(edge.physical_id)||(need==='accessible'&&(edge.wheelchair_barrier===1||['stairs','stairlift','escalator','travelator'].includes(edge.kind))))).map(edge=>edge.id);
 return {id:choice.id,kind:result.taxiCandidateKind??'public',minutes:choice.minutes,cost:choice.cost,walkMinutes:choice.walkMinutes,waitMinutes:result.waitMinutes,transfers:choice.transfers,modes:choice.modeChain,endpointsPreserved:endpoints,forbidden,needsVehicleConfirmation:!!result.needsVehicleConfirmation,needsConfirmation:!!result.needsConfirmation,requestedPreference:result.requestedPreference,effectivePreference:result.effectivePreference};
});
const report={runtime:version,id:index+1,need,state,wallMs:Date.now()-started,memory:{...process.memoryUsage(),maxRSSKiB:process.resourceUsage().maxRSS},request,performance:window.__navigationPerformance,candidates:rowsOut,selected:rowsOut[0]?.id,publicAvailable:rowsOut.some(c=>c.kind==='public'),taxiAvailable:rowsOut.some(c=>c.kind!=='public'),invariants:{endpoints:rowsOut.every(c=>c.endpointsPreserved),knownEdges:rowsOut.every(c=>!c.forbidden.length),strictTaxiExcluded:need!=='accessible'||rowsOut.every(c=>c.kind==='public'),luggageTaxiConfirmed:need!=='luggage'||rowsOut.filter(c=>c.kind!=='public').every(c=>c.needsVehicleConfirmation)}};
const {writeFileSync}=await import('node:fs');writeFileSync(process.env.HK_REPORT_PATH,JSON.stringify(report,null,2)+'\n');console.log('MATRIX',JSON.stringify(report));
click({action:'cancel-plan'});for(const worker of workers)worker.terminate();process.exit(0);
