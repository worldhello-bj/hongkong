/** One full production S1 comparison. No graph/algorithm patching or output repairs.
 * Run only when the resource owner approves: HK_POINT_ROW=... HK_NEED=... HK_TAXI=0|1
 * HK_REPORT_PATH=... node --max-old-space-size=768 tests/navigation/four-preference-harness.mjs
 */
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve,dirname,basename} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Worker as NodeWorker} from 'node:worker_threads';
import {ROOT,FIXTURE,readJSON,digest,PREFERENCES,runtimeIdentity,ROW_IDS} from './four-preference-fixture.mjs';
import {auditFourPreferenceCandidate} from './four-preference-audit.mjs';
import {auditCandidate,auditUnavailable,sourceIndex,identity,classifyObservation,completionTiming} from './point-matrix-audit.mjs';
import {loadPointSourceEligibility} from './point-source-eligibility.mjs';

const base=resolve(process.env.HK_POINT_DIST??resolve(ROOT,'dist')),fixture=readJSON(FIXTURE),row=fixture.rows.find(r=>r.id===process.env.HK_POINT_ROW);
const need=process.env.HK_NEED,taxi=process.env.HK_TAXI==='1',out=process.env.HK_REPORT_PATH;
if(!row||!ROW_IDS.includes(row.id)||!PREFERENCES.includes(need)||!['0','1'].includes(process.env.HK_TAXI)||!out)throw Error('Explicit HK_POINT_ROW, HK_NEED, HK_TAXI=0|1 and HK_REPORT_PATH required. No matrix runs implicitly.');
const runtime=runtimeIdentity(base);
if(process.env.HK_POINT_RUNTIME&&process.env.HK_POINT_RUNTIME!==runtime.version)throw Error('Runtime changed before probe.');
for(const [path,hash] of Object.entries(fixture.sources))if(digest(readFileSync(resolve(base,path)))!==hash)throw Error('Source fixture drift: '+path+'; regenerate and review selection.');
const windowMs=fixture.observationWindowMs,bootStart=performance.now(),workers=[],workerErrors=[],terminations=[],fetches=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const els=new Map(),listeners=new Map();
function el(id){if(els.has(id))return els.get(id);const e={id,focus(){},innerHTML:'',textContent:'',style:{},dataset:{},clientWidth:1000,clientHeight:800,childElementCount:0,hidden:false,relList:{supports:()=>true},classList:{add(){},remove(){},toggle(){return false;}},querySelector:s=>el(s),querySelectorAll:()=>[],setAttribute(){},getAttribute(){return null;},toggleAttribute(){},getBoundingClientRect:()=>({height:200,width:1000,top:0,left:0}),addEventListener:(type,fn)=>listeners.set(id+':'+type,fn),insertAdjacentHTML(_,s){this.innerHTML+=s;},matches:()=>false};els.set(id,e);return e;}
globalThis.requestAnimationFrame=callback=>setTimeout(callback,0);
globalThis.document={createElement:()=>el('created'),querySelector:el,querySelectorAll:()=>[]};
globalThis.window={innerWidth:1000,addEventListener(){}};globalThis.history={replaceState(){},pushState(){}};globalThis.location={hash:'#home'};Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};window.localStorage=globalThis.localStorage;
globalThis.fetch=async url=>{const path=new URL(url,'http://localhost').pathname;try{const bytes=readFileSync(base+path);fetches.push({path,bytes:bytes.length,sha256:digest(bytes)});return new Response(bytes,{status:200});}catch{fetches.push({path,status:404});return new Response('',{status:404});}};
globalThis.Worker=class{
 constructor(url){const path=base+new URL(url).pathname.replace(base,''),id=workers.length+1;this.id=id;this.kind=basename(path);this.pending=new Set();this.posts=0;this.results=0;workers.push(this);
  this.w=new NodeWorker(`const {parentPort}=require('node:worker_threads');globalThis.self=globalThis;globalThis.postMessage=x=>parentPort.postMessage(x);parentPort.on('message',x=>globalThis.onmessage({data:x}));require(${JSON.stringify(path)});`,{eval:true,resourceLimits:{maxOldGenerationSizeMb:384}});
  this.w.on('message',data=>{this.results++;this.pending.delete(data.id);this.onmessage?.({data});});
  this.w.on('error',e=>{workerErrors.push({worker:id,kind:this.kind,code:e.code,message:e.message});this.onerror?.(e);});
  this.w.on('exit',code=>{this.exited=true;this.exitCode=code;});
 }
 postMessage(data){this.posts++;this.pending.add(data.id);this.w.postMessage(data);}
 terminate(){if(this.termination)return this.termination;this.terminateRequested=true;this.termination=this.w.terminate();terminations.push(this.termination);return this.termination;}
};
let source=readFileSync(resolve(base,'assets/main-integrated.js'),'utf8');
source=source.replace(/from\s*["'](\.\.?\/[^"']+)["']/g,(_,p)=>'from '+JSON.stringify(new URL(p,pathToFileURL(resolve(base,'assets/main-integrated.js'))).href)).replace(/import\("(\.\.?\/[^"']+)"\)/g,(_,p)=>'import('+JSON.stringify(new URL(p,pathToFileURL(resolve(base,'assets/main-integrated.js'))).href)+')').replaceAll('import.meta.url',JSON.stringify(pathToFileURL(resolve(base,'assets/main-integrated.js')).href));
source+='\nexport {r,C,d1,L1,Q,z,I1,t1,publicDataPromise,blockDataState};';
let api,sampler;
try{
 api=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 await api.publicDataPromise;
 const blockStart=performance.now();while(api.blockDataState==='loading'&&performance.now()-blockStart<15000)await sleep(20);
 if(!api.Q||!api.L1||api.blockDataState!=='ready')throw Error('Source data did not finish loading: '+JSON.stringify(window.__navigationLoad));
 const sourceEligibility=need==='accessible'?await loadPointSourceEligibility(base):undefined;
 const change=(selector,value)=>listeners.get('#navigation-app:change')({target:{dataset:{},value,matches:s=>s===selector}});
 change('[data-app="departure-date"]',row.request.departureDate);
 change('[data-app="departure"]',`${String(Math.floor(row.request.departureS/3600)).padStart(2,'0')}:${String(Math.floor(row.request.departureS/60)%60).padStart(2,'0')}`);
 api.r.origin=structuredClone(row.request.origin);api.r.destination=structuredClone(row.request.destination);api.r.need=need;api.t1.clear();if(taxi)api.t1.add('taxi');
 const request=structuredClone(row.request),inputIdentity=JSON.stringify([identity(request.origin),identity(request.destination)]),click=dataset=>listeners.get('#navigation-app:click')({target:{closest:()=>({dataset})}});
 const samples=[],bootMs=performance.now()-bootStart,routeStart=performance.now();
 sampler=setInterval(()=>samples.push({routeMs:performance.now()-routeStart,rss:process.memoryUsage().rss,heapUsed:process.memoryUsage().heapUsed}),1000);
 click({action:'plan'});let state,firstObservedMs=null;
 for(;;){if(firstObservedMs===null&&api.C.some(c=>c.available))firstObservedMs=performance.now()-routeStart;if(!api.d1){state='complete';break;}if(performance.now()-routeStart>=windowMs){state='observation-window-ended';break;}await sleep(50);}
 const wallMs=performance.now()-routeStart,perf=structuredClone(window.__navigationPerformance),planningStarted=Number.isFinite(perf?.startedMonotonic)&&perf.startedMonotonic>=routeStart,timing=completionTiming(state,wallMs,perf,{planningStarted}),planningAtObservation=api.d1,actualIdentity=JSON.stringify([identity(api.r.origin),identity(api.r.destination)]);
 // Freeze references before Cancel so the probe observes the real pre-cancel result.
 const uiStatus=[...els.entries()].filter(([id,e])=>/status/.test(id)&&e.textContent).map(([id,e])=>({id,text:e.textContent.slice(0,1500)}));
 const choices=[...api.C],pendingBeforeCancel=workers.filter(w=>!w.exited&&w.pending.size).map(w=>({id:w.id,kind:w.kind,pending:[...w.pending]}));
 const fingerprint=()=>JSON.stringify(api.C.map(c=>[c.id,c.available,c.minutes,c.cost]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
 const cancelStart=performance.now();click({action:'cancel-plan'});const afterCancel=fingerprint();await sleep(500);
 const pendingAfterCancel=workers.filter(w=>!w.exited&&!w.terminateRequested&&w.pending.size).map(w=>w.id);
 const cancel={exercisedWhilePending:planningAtObservation,observationMs:performance.now()-cancelStart,planningStopped:!api.d1,pendingBeforeCancel,pendingAfterCancel,noStaleCandidatePublication:fingerprint()===afterCancel};cancel.pass=cancel.planningStopped&&cancel.pendingAfterCancel.length===0&&cancel.noStaleCandidatePublication;
 // Verification runs after timing and after production cancellation to avoid stealing route CPU.
 const index=sourceIndex([api.Q,api.L1,api.z]);
 const clockEngine=await import(pathToFileURL(resolve(base,'assets/mobile-navigation-DfEsS_7b.js')));
 const candidates=choices.filter(c=>c.available).map(c=>auditFourPreferenceCandidate(c,{request,need,taxi,fixture,index,services:api.I1,sourceEligibility,canTraverse:clockEngine.t}));
 const unavailable=choices.filter(c=>!c.available).map(auditUnavailable);
 const exactSourceKnown=['origin','destination'].some(side=>request[side].node_id&&index.nodes.has(request[side].node_id));
 const sourceCoverageReview=exactSourceKnown&&candidates.length===0?unavailable.filter(c=>c.failureStatus==='OUT_OF_REGION').map(c=>({id:c.id,message:c.message,reason:'Known exact source identity rejected by a routing coverage gate; inspect graph/identity scope before treating as a source limitation.'})):[];
 const after=runtimeIdentity(base),runtimeStable=after.signature===runtime.signature&&after.version===runtime.version;
 const auditFiles=['four-preference-harness.mjs','four-preference-audit.mjs','four-preference-fixture.mjs','point-matrix-harness.mjs','point-matrix-audit.mjs','point-source-eligibility.mjs','point-matrix-fixture.mjs'];
 const auditProvenance={version:'four-preference-additive-v1',files:Object.fromEntries(auditFiles.map(p=>[p,digest(readFileSync(resolve(ROOT,'tests/navigation',p)))])),sourceEligibility:sourceEligibility?.provenance};
 const report={schema:1,auditProvenance,planningStarted,uiStatus,rowId:row.id,label:row.label,tags:row.tags,need,taxi,runtime,fixtureSha256:digest(readFileSync(FIXTURE)),date:new Date().toISOString(),request,state:timing.state,comparisonStatus:timing.comparisonStatus,failedStages:timing.failedStages,windowMs,bootMs,wallMs,firstObservedMs,firstResultMs:perf?.firstResultMs??null,fullCandidateWallMs:timing.fullCandidateWallMs,stoppedWallMs:timing.stoppedWallMs,performance:perf,navigationLoad:window.__navigationLoad,candidates,unavailable,sourceCoverageReview,requestIdentityPreserved:inputIdentity===actualIdentity,runtimeStable,cancel,workerErrors,workers:workers.map(w=>({id:w.id,kind:w.kind,posts:w.posts,results:w.results,pending:[...w.pending],terminateRequested:!!w.terminateRequested,exited:!!w.exited,exitCode:w.exitCode})),memory:{...process.memoryUsage(),maxRSSKiB:process.resourceUsage().maxRSS,samples},fetches,limitations:['Production built S1, Worker bundles and pricing code in Node with a DOM stand-in; not actual-browser visual or device-performance QA.','Data fully ready before plan, fresh process/cold route cache, taxi loaded on demand. Boot cost is separate.','A 60-second pending observation is never NO_ROUTE. Full comparison time is null unless S1 actually finishes.','Modeled/schematic geometry is identified separately even when geometrically continuous; source-backed does not mean live verified.','All costs are the production illustrative model; official tariff correctness is outside this harness.']};
 report.classification=runtimeStable?classifyObservation({state:timing.state,candidates,workerErrors,requestChanged:!report.requestIdentityPreserved,cancel,comparisonStatus:timing.comparisonStatus,failedStages:timing.failedStages}):'runtime-changed-inconclusive';
 mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({out,rowId:row.id,need,taxi,runtime:runtime.version,state:report.state,comparisonStatus:report.comparisonStatus,classification:report.classification,wallMs,firstResultMs:report.firstResultMs,fullCandidateWallMs:report.fullCandidateWallMs,candidates:candidates.length}));
 if(['invariant-failure','worker-failure','resource-failure-oom','runtime-changed-inconclusive','incomplete-routing-error','planning-not-started'].includes(report.classification))process.exitCode=1;
}finally{clearInterval(sampler);for(const w of workers)w.terminate();await Promise.allSettled(terminations);}
process.exit(process.exitCode??0);
