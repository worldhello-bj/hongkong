/** Profile the actual built S1 entry and Worker algorithms without modifying production.
 * HK_MATRIX_OD=7 HK_NEED=luggage HK_PROFILE_LABEL=baseline node tests/navigation/profile-navigation.mjs
 * Uses the exact original 60-second observation window; never treats a timeout as NO_ROUTE.
 * The DOM stand-in measures JS/string work only, not browser layout, painting or visual quality.
 */
import {readFileSync,writeFileSync,mkdirSync,cpSync,existsSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,basename} from 'node:path';
import {Worker as NodeWorker} from 'node:worker_threads';
import {createHash} from 'node:crypto';
import {monitorEventLoopDelay} from 'node:perf_hooks';
import {instrumentWalkState} from './profile-worker-stats.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const runtime=process.env.HK_PROFILE_RUNTIME??JSON.parse(readFileSync(root+'dist/build-meta.json','utf8')).version;
const id=Number(process.env.HK_MATRIX_OD??7),need=process.env.HK_NEED??'luggage';
const label=process.env.HK_PROFILE_LABEL??'baseline',variant=process.env.HK_PROFILE_VARIANT??'baseline',windowMs=60000;
const out=resolve(root,'validation/performance',`${label}-${runtime}-od${id}-${need}`);
mkdirSync(out,{recursive:true});
const snapshot=resolve(root,'validation/performance',`runtime-${runtime}`);
if(!existsSync(snapshot)){if(JSON.parse(readFileSync(root+'dist/build-meta.json','utf8')).version!==runtime)throw new Error('Requested frozen runtime is unavailable: '+runtime);cpSync(root+'dist',snapshot,{recursive:true});}
const instrumentation=resolve(out,'instrumented');mkdirSync(instrumentation,{recursive:true});
const start=performance.now(),events=[],workers=[],active=new Map(),aggregates={};let serial=0;
const time=()=>Math.round((performance.now()-start)*1000)/1000;
const hash=s=>createHash('sha256').update(s).digest('hex');
const graphs=new WeakMap(),routers=new WeakMap();let graphSerial=0,routerSerial=0;
function graph(g){if(!g?.nodes)return;let gid=graphs.get(g);if(!gid){gid=++graphSerial;graphs.set(g,gid);}return {gid,version:g.version,nodes:g.nodes.length,edges:g.edges?.length,regions:g.regions?.map(r=>r.id)};}
function point(p){return p?{id:p.id,node_id:p.node_id,node_ids:p.node_ids,coordinates:p.coordinates??[p.lon,p.lat]}:p;}
function request(r){return r?.origin?{origin:point(r.origin),destination:point(r.destination),preference:r.preference??r.need,mode:r.mode,allowedModes:r.allowedModes??r.allowedTransitModes,departureS:r.departureS,departureDate:r.departureDate}:undefined;}
function router(r){if(!r)return;let rid=routers.get(r);if(!rid){rid=++routerSerial;routers.set(r,rid);}return rid;}
function record(event){events.push({t:time(),...event});}
function invoke(name,fn,self,args){const sid=++serial,t=performance.now(),req=request(args.find(x=>x?.origin));const data={sid,name,request:req,graphs:args.filter(x=>x?.nodes).map(graph)};active.set(sid,{...data,t:time()});record({event:'span-start',...data});const end=(result,error)=>{const durationMs=performance.now()-t;active.delete(sid);const a=aggregates[name]??={count:0,totalMs:0,maxMs:0};a.count++;a.totalMs+=durationMs;a.maxMs=Math.max(a.maxMs,durationMs);record({event:'span-end',sid,name,durationMs,status:result?.status,complete:result?.journey?.complete,error:error?.message});};try{const result=fn.apply(self,args);if(result?.then)return result.then(v=>{end(v);return v;},e=>{end(null,e);throw e;});end(result);return result;}catch(e){end(null,e);throw e;}}
globalThis.__profile={invoke,record,graph,router,request};
function wrapFunction(source,name,label=name){const re=new RegExp(`((?:async )?function )${name.replaceAll('$','\\$')}\\(`);if(!re.test(source))throw new Error('Missing instrumentation anchor '+name);return source.replace(re,(_,prefix)=>`function ${name}(...args){return globalThis.__profile.invoke(${JSON.stringify(label)},__profile_raw_${name},this,args);}${prefix}__profile_raw_${name}(`);}
const queueFile=resolve(instrumentation,'queue.mjs');
let queueSource=readFileSync(snapshot+'/assets/routing-queue.js','utf8');
queueSource=queueSource.replace('const dispose=()=>{release?.();','const dispose=()=>{globalThis.__profile.record({event:"queue-release",owner:globalThis.__profile.router(owner)});release?.();');
queueSource=queueSource.replace('run(task,key,onRelease){','run(task,key,onRelease){const queuedAt=performance.now(),qkey=globalThis.__profile.router(key);globalThis.__profile.record({event:"queue-enqueue",owner:qkey});');
queueSource=queueSource.replace('if(signal?.aborted)throw aborted();','if(signal?.aborted)throw aborted();globalThis.__profile.record({event:"queue-start",owner:qkey,previousOwner:globalThis.__profile.router(owner),queueWaitMs:performance.now()-queuedAt});');
writeFileSync(queueFile,queueSource);
const workerPrefix=`
const __profileAggregates={},__profileDuplicateKeys=new Map();let __profileSeq=0;
const __profilePoint=p=>p?{node_id:p.node_id,node_ids:p.node_ids,coordinates:p.coordinates??[p.lon,p.lat]}:p;
const __profileRequest=r=>r?.origin?{origin:__profilePoint(r.origin),destination:__profilePoint(r.destination),preference:r.preference,mode:r.mode,allowedModes:r.allowedModes,departureS:r.departureS,departureDate:r.departureDate}:undefined;
const __profileSend=e=>globalThis.postMessage({__profile:e});
globalThis.__profile={invoke(name,fn,self,args){const sid=++__profileSeq,t=performance.now(),req=__profileRequest(args.find(x=>x?.origin)),g=args.find(x=>x?.nodes),entry={sid,name,request:req,graph:g?{version:g.version,nodes:g.nodes.length,edges:g.edges?.length,regions:g.regions?.map(r=>r.id)}:undefined};__profileSend({event:'worker-span-start',...entry});const finish=(value,error)=>{const durationMs=performance.now()-t;const a=__profileAggregates[name]??={count:0,totalMs:0,maxMs:0};a.count++;a.totalMs+=durationMs;a.maxMs=Math.max(a.maxMs,durationMs);__profileSend({event:'worker-span-end',sid,name,durationMs,status:value?.status,error:error?.message,heapUsed:process.memoryUsage().heapUsed});};try{const value=fn.apply(self,args);if(value?.then)return value.then(v=>{finish(v);return v;},e=>{finish(null,e);throw e;});finish(value);return value;}catch(e){finish(null,e);throw e;}},record:__profileSend};
`;
const workerSources=new Map();
function instrumentWorker(path){if(workerSources.has(path))return workerSources.get(path);let source=readFileSync(path,'utf8');const mapping=path.includes('app-transit')?[['Ae','graph-prepare'],['ot','graph-validate'],['jt','transit-build'],['ft','walk-query'],['bt','walk-index'],['Dt','scheduled-search'],['Lt','station-build'],['xt','station-merge']]:path.includes('app-walk')?[['Ze','graph-prepare'],['Ne','graph-validate'],['rt','walk-query'],['st','walk-index']]:[];
 for(const [name,label] of mapping)source=wrapFunction(source,name,label);
 if(process.env.HK_PROFILE_SEARCH_STATS==='1')source=instrumentWalkState(source,path);
 if(variant==='fifo-guard'){
  const pattern=/let [A-Za-z_$][\w$]*=[A-Za-z_$][\w$]*\.id,[A-Za-z_$][\w$]*=!1;for\(;[A-Za-z_$][\w$]*;\)\{.{0,200}?\}if\(([A-Za-z_$][\w$]*)&&!hkFifoWaiting\)continue;/g;
  let count=0;source=source.replace(pattern,(match,flag)=>{count++;return 'if(!hkFifoWaiting){'+match.replace('if('+flag+'&&!hkFifoWaiting)','if('+flag+')')+'}';});
  if(count!==1)throw new Error('Expected one FIFO ancestry guard anchor in '+path+', saw '+count);
  record({event:'experimental-patch',workerAsset:basename(path),variant,count});
 }
 source=source.replace(/from\s*["'](\.\.?\/[^"']+)["']/g,(_,p)=>'from '+JSON.stringify(new URL(p,pathToFileURL(path)).href));
 if(path.includes('app-transit'))source=source.replace('route:await tt.route(o)','route:await globalThis.__profile.invoke("transit-query",tt.route,tt,[o])');
 const target=resolve(instrumentation,basename(path));writeFileSync(target,workerPrefix+source);workerSources.set(path,target);return target;}
const termination=[];
globalThis.Worker=class{
 constructor(url){const path=snapshot+new URL(url).pathname.replace(snapshot,'');this.id=workers.length+1;this.kind=basename(path);this.pending=new Map();this.ended=false;workers.push(this);record({event:'worker-create',worker:this.id,kind:this.kind});const transformed=instrumentWorker(path);this.w=new NodeWorker(`const {parentPort}=require('node:worker_threads');globalThis.self=globalThis;globalThis.postMessage=x=>parentPort.postMessage(x);parentPort.on('message',x=>globalThis.onmessage({data:x}));require(${JSON.stringify(transformed)});`,{eval:true,resourceLimits:{maxOldGenerationSizeMb:384}});
 this.cpu=process.env.HK_PROFILE_CPU==='1'?new Promise(resolve=>{this.w.once('online',()=>resolve(this.w.startCpuProfile().catch(error=>{record({event:'cpu-profile-error',worker:this.id,error:error.message});return null;})));this.w.once('exit',()=>resolve(null));}):Promise.resolve(null);
 this.w.on('message',data=>{if(data.__profile){record({worker:this.id,kind:this.kind,...data.__profile});return;}const sent=this.pending.get(data.id);record({event:'worker-result',worker:this.id,kind:this.kind,id:data.id,roundTripMs:sent?performance.now()-sent.t:undefined,status:data.route?.status});this.pending.delete(data.id);this.onmessage?.({data});});
 this.w.on('error',e=>{record({event:'worker-error',worker:this.id,error:e.message});this.onerror?.(e);});
 this.w.on('exit',code=>{this.ended=true;record({event:'worker-exit',worker:this.id,code});});}
 postMessage(x){const t=performance.now();this.pending.set(x.id,{t,request:request(x.request)});this.w.postMessage(x);record({event:'worker-post',worker:this.id,kind:this.kind,id:x.id,cloneSendMs:performance.now()-t,initializes:!!(x.inputs||x.graph),request:request(x.request),graphs:(x.inputs?[x.inputs.area,x.inputs.station,x.inputs.detailed]:[x.graph]).filter(Boolean).map(graph)});}
 terminate(){if(this.stopping)return;this.stopping=true;record({event:'worker-terminate',worker:this.id,kind:this.kind,pending:[...this.pending.values()].map(x=>x.request)});const p=(async()=>{try{const cpu=await this.cpu;if(cpu){const value=await cpu.stop();writeFileSync(resolve(out,`worker-${this.id}.cpuprofile`),typeof value==='string'?value:JSON.stringify(value));}}catch(e){record({event:'cpu-profile-error',worker:this.id,error:e.message});}return this.w.terminate();})();termination.push(p);return p;}
};
globalThis.requestAnimationFrame=callback=>setTimeout(callback,0);
const els=new Map(),listeners=new Map();
function el(id){if(els.has(id))return els.get(id);const e={id,focus(){},innerHTML:'',textContent:'',style:{},dataset:{},clientWidth:1000,clientHeight:800,childElementCount:0,hidden:false,relList:{supports:()=>true},classList:{add(){},remove(){},toggle(){return false}},querySelector:s=>el(s),querySelectorAll:()=>[],setAttribute(){},getAttribute(){return null},toggleAttribute(){},getBoundingClientRect:()=>({height:200,width:1000,top:0,left:0}),addEventListener:(t,fn)=>listeners.set(id+':'+t,fn),insertAdjacentHTML(_,s){this.innerHTML+=s},matches:()=>false};els.set(id,e);return e;}
globalThis.document={createElement:()=>el('created'),querySelector:el,querySelectorAll:()=>[]};globalThis.window={innerWidth:1000,addEventListener(){}};globalThis.history={replaceState(){},pushState(){}};globalThis.location={hash:'#navigation'};Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});
globalThis.localStorage={getItem:()=>JSON.stringify({version:1,account:{id:'old-user',name:'演示旅客',kind:'local-demo',createdAt:1},preferences:{priority:'fast',stepFree:false,avoidCrowds:false,allowedModes:['taxi']},privacy:{rememberOnDevice:true,serviceCreditOptIn:false},orders:[],providerAvailability:{},bookingKeys:{},paymentKeys:{},creditOrderIds:[]}),setItem(){},removeItem(){}};window.localStorage=globalThis.localStorage;
const fetched=[];
globalThis.fetch=async url=>{const path=new URL(url,'http://localhost').pathname;if(path.endsWith('station-access-alternatives.json'))return new Promise(()=>{});const t=performance.now();try{const bytes=readFileSync(snapshot+path);fetched.push({path,bytes:bytes.length,sha256:hash(bytes),readMs:performance.now()-t});return new Response(bytes,{status:200});}catch{return new Response('',{status:404});}};
let source=readFileSync(snapshot+'/assets/main-integrated.js','utf8');
for(const name of ['S1','f2','r2','D2','g2','j2','x','n1','ensureTaxi','n3','r3','loadBlockData'])source=wrapFunction(source,name);
for(const [binding,label] of [['m as F1','F1-merge'],['p as m2','m2-prepare'],['l as K1','K1-load']]){const name=binding.split(' as ')[1];if(!source.includes(binding))throw new Error('Missing import '+binding);source=source.replace(binding,binding.replace(name,'__profile_raw_'+name));source+='\nfunction '+name+'(...args){return globalThis.__profile.invoke('+JSON.stringify(label)+',__profile_raw_'+name+',this,args);}\n';}
source=source.replace(/from\s*["'](\.\/?routing-queue\.js[^"']*)["']/g,'from '+JSON.stringify(pathToFileURL(queueFile).href));
source=source.replace(/from\s*["'](\.\.?\/[^"']+)["']/g,(_,p)=>'from '+JSON.stringify(new URL(p,pathToFileURL(snapshot+'/assets/main-integrated.js')).href)).replace(/import\("(\.\.?\/[^"']+)"\)/g,(_,p)=>'import('+JSON.stringify(new URL(p,pathToFileURL(snapshot+'/assets/main-integrated.js')).href)+')').replaceAll('import.meta.url',JSON.stringify(pathToFileURL(snapshot+'/assets/main-integrated.js').href));
source+='\nexport {r,S1,C,d1,V,f,D1,n1,publicDataPromise,f2,L1,Q,b2,z,t1};';
if(variant==='defer-walk'||variant==='shared-base'){const old='await runBounded([publicWork,taxiWork,walkWork],2);';if(!source.includes(old))throw new Error('Missing scheduling anchor');source=source.replace(old,'await runBounded([publicWork,taxiWork],2);if(!stale())await walkWork();');}
if(variant==='shared-base'){
 const replacements=[
  ['const taxiRouter=E2(Q,I1,publicWalkLinks,L1);','const taxiRouter=fastPublicRouter??E2(Q,I1,publicWalkLinks,L1),ownsTaxiRouter=!fastPublicRouter;'],
  ['finally{taxiRouter.dispose();}','finally{if(ownsTaxiRouter)taxiRouter.dispose();}'],
  ['    fastPublicRouter?.dispose();\n    // Same-region','    // Same-region'],
  ['    fastPublicRouter?.dispose();b2?.dispose();disposeIdleWalkWorkers();\n    const stageStart','    const stageStart']
 ];
 for(const [before,after] of replacements){if(!source.includes(before))throw new Error('Missing shared-base anchor '+before);source=source.replace(before,after);}
}
const entry=resolve(instrumentation,'main.mjs');writeFileSync(entry,source);
const loop=monitorEventLoopDelay({resolution:20});loop.enable();
const samples=[],sampler=setInterval(()=>samples.push({t:time(),...process.memoryUsage(),maxRSSKiB:process.resourceUsage().maxRSS}),1000);
const api=await import(pathToFileURL(entry));await api.publicDataPromise;
const rows=JSON.parse(readFileSync(root+'tests/navigation/fixtures/land-coverage-72.json','utf8')).rows;
const req=structuredClone(rows[id-1].request);api.r.origin=req.origin;api.r.destination=req.destination;api.r.need=need;api.t1.add('taxi');
const click=dataset=>listeners.get('#navigation-app:click')({target:{closest:()=>({dataset})}});
const routeStart=performance.now();record({event:'plan-click',id,need});click({action:'plan'});
let state;
for(;;){await new Promise(r=>setTimeout(r,250));if(!api.d1||performance.now()-routeStart>=windowMs){state=!api.d1?'complete':'observation-window-ended';break;}}
record({event:'observation-end',state});const pendingMain=[...active.values()];
const candidates=api.C.filter(x=>x.available).map(choice=>{const result=choice.result,points=result.journey?.steps?.flatMap(s=>s.guidance?.geometry?.type==='LineString'?s.guidance.geometry.coordinates:[])??[];const matches=(a,b)=>a&&b&&a.slice(0,2).every((v,i)=>Math.abs(v-b[i])<1e-7);const ids=new Set(result.journey.steps.flatMap(s=>s.guidance?.edge_ids??[])),g=result.journey.graph,closed=new Set((g?.closures??[]).flatMap(c=>c.physical_ids??[]));return {id:choice.id,kind:result.taxiCandidateKind??'public',minutes:choice.minutes,cost:choice.cost,modes:choice.modeChain,endpointsPreserved:matches(points[0],req.origin.coordinates)&&matches(points.at(-1),req.destination.coordinates),forbidden:(g?.edges??[]).filter(e=>ids.has(e.id)&&(e.disabled||closed.has(e.physical_id)||(need==='accessible'&&(e.wheelchair_barrier===1||['stairs','stairlift','escalator','travelator'].includes(e.kind))))).map(e=>e.id),needsVehicleConfirmation:!!result.needsVehicleConfirmation};});
const report={runtime,productionEntrySha256:hash(readFileSync(snapshot+'/assets/main-integrated.js')),instrumentedEntrySha256:hash(source),label,variant,cpuSampling:process.env.HK_PROFILE_CPU==='1',searchStateCounters:process.env.HK_PROFILE_SEARCH_STATS==='1',id,need,state,windowMs,wallMs:performance.now()-routeStart,totalBootAndRouteMs:time(),request:req,routePerformance:window.__navigationPerformance,navigationLoad:window.__navigationLoad,aggregates:structuredClone(aggregates),pendingMain,candidates,fetched,samples,memory:{...process.memoryUsage(),maxRSSKiB:process.resourceUsage().maxRSS},eventLoopDelayMs:{mean:loop.mean/1e6,max:loop.max/1e6,p99:loop.percentile(99)/1e6},workers:workers.map(w=>({id:w.id,kind:w.kind,terminated:w.stopping,pending:[...w.pending.values()].map(x=>x.request)})),limitations:['Node worker_threads executes instrumented production S1 and production Worker bundles.','DOM stand-ins measure JS/string work, not browser layout, paint or visual acceptance.','CPU collection slightly delays physical Worker termination; timing is diagnostic, compare with same probe.','The original matrix stopped accessible runs as soon as public comparison was usable; this probe observes full completion or the unchanged 60-second window.']};
clearInterval(sampler);loop.disable();click({action:'cancel-plan'});for(const w of workers)w.terminate();await Promise.allSettled(termination);
writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');writeFileSync(resolve(out,'events.ndjson'),events.map(e=>JSON.stringify(e)).join('\n')+'\n');
console.log(JSON.stringify({out,runtime,id,need,state,wallMs:report.wallMs,workers:workers.length,pending:pendingMain.map(x=>x.name),stages:report.routePerformance?.stages,memory:report.memory},null,2));process.exit(0);
