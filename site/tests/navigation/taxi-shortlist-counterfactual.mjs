/** Single-OD, opt-in counterfactual; no production files or routing data are changed.
 * Lightweight only: node tests/navigation/taxi-shortlist-counterfactual.mjs --check
 * Resource-owner approval is required before --run. See the matching review.
 */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,basename,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';
import {Worker as NodeWorker} from 'node:worker_threads';
import {ROOT,digest,readJSON,runtimeIdentity} from './point-matrix-fixture.mjs';
import {auditCandidate,auditUnavailable,auditTransitRideBoundaries,sourceIndex,identity,classifyObservation,completionTiming} from './point-matrix-audit.mjs';

const SELF=fileURLToPath(import.meta.url),BASE=resolve(ROOT,'dist');
const TARGET='td:99133',TARGET_CHOICE='taxi-last-tram-'+TARGET;
const CONFIG=Object.freeze({od:7,need:'ordinary',departureDate:'2026-10-12',departureS:39600,timezone:'Asia/Hong_Kong',landSeed:20261011,taxiSeed:42,windowMs:60000,watchdogMs:90000,costWeights:[.25,.75,2]});
const EXPECTED_ENDPOINTS=[[114.19780266014673,22.27037983652672],[114.16388501171271,22.2735175495032]];
const readAsset=name=>readFileSync(resolve(BASE,'assets',name),'utf8');
const dataURL=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const json=value=>JSON.stringify(value,null,2)+'\n';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function replaceOnce(source,before,after,label){
 const count=source.split(before).length-1;
 assert.equal(count,1,`Instrumentation anchor drift: ${label} (${count})`);
 return source.replace(before,after);
}
function absoluteImports(source,file){
 const url=pathToFileURL(file);
 return source.replace(/from\s*["'](\.\.?\/[^"']+)["']/g,(_,p)=>'from '+JSON.stringify(new URL(p,url).href))
  .replace(/import\("(\.\.?\/[^"']+)"\)/g,(_,p)=>'import('+JSON.stringify(new URL(p,url).href)+')')
  .replaceAll('import.meta.url',JSON.stringify(url.href));
}
function transformedSources(){
 let taxi=readAsset('taxi-candidates.js');
 // Retain the exact default selectors. The hook can only append the existing
 // eligible source stop after the last-side defaults; it cannot change first.
 taxi=replaceOnce(taxi," const candidates={last:taxiInterchangeCandidates({station,services,request,side:'last'}),first:taxiInterchangeCandidates({station,services,request,side:'first'})};",
  " const candidates={last:taxiInterchangeCandidates({station,services,request,side:'last'}),first:taxiInterchangeCandidates({station,services,request,side:'first'})};\n globalThis.__taxiCounterfactual.shortlist(candidates,{station,services,request},taxiInterchangeCandidates);",'default shortlist');
 taxi=replaceOnce(taxi,"  const road=findRoad(interchange),link=road&&makeLink(interchange,road);if(!link)continue;",
  "  globalThis.__taxiCounterfactual.begin(side,interchange);\n  const road=findRoad(interchange),link=road&&makeLink(interchange,road);globalThis.__taxiCounterfactual.link(side,interchange,road,link);if(!link)continue;",'curb guard');
 taxi=replaceOnce(taxi,"   if(!quote)continue;",
  "   globalThis.__taxiCounterfactual.quote(side,interchange,quote,directQuote);\n   if(!quote)continue;",'feeder quote before unchanged 95% guard');
 taxi=replaceOnce(taxi," const directQuote=ask(originRoad,destinationRoad,request.departureS+directPickup.durationS);",
  " const directQuote=ask(originRoad,destinationRoad,request.departureS+directPickup.durationS);globalThis.__taxiCounterfactual.direct(directQuote);",'direct quote');
 taxi=replaceOnce(taxi,'export async function planTaxiCandidates(','async function __counterfactualPlanTaxiCandidates(','plan wrapper');
 taxi+='\nexport async function planTaxiCandidates(args){return globalThis.__taxiCounterfactual.plan(__counterfactualPlanTaxiCandidates,args);}\n';
 taxi=absoluteImports(taxi,resolve(BASE,'assets/taxi-candidates.js'));
 let main=readAsset('main-integrated.js');
 const importMatch=main.match(/import \{planTaxiCandidates\} from "\.\/taxi-candidates\.js[^\"]*";/g)??[];
 assert.equal(importMatch.length,1,'Expected one production taxi candidate import');
 main=replaceOnce(main,importMatch[0],'import {planTaxiCandidates} from '+JSON.stringify(dataURL(taxi))+';','taxi module only');
 main=replaceOnce(main,'    const choice=u2(id,result);choice.title=',
  '    const choice=u2(id,result);globalThis.__taxiCounterfactual.published(choice);choice.title=','pre-dedup published taxi choices');
 // Keep this predicate exactly once and log its actual result, before main's
 // publicRoute intentionally returns null for incomplete/incompatible routes.
 main=replaceOnce(main,'    if(result.journey?.complete&&compatibleWithOverlay(result,Q,z)){',
  '    const __counterfactualCompatible=result.journey?.complete&&compatibleWithOverlay(result,Q,z);\n    globalThis.__taxiCounterfactual.publicRaw(query,result,__counterfactualCompatible);\n    if(__counterfactualCompatible){','public prefix/suffix exact rejection');
 main=absoluteImports(main,resolve(BASE,'assets/main-integrated.js'));
 main+='\nexport {r,C,d1,L1,Q,z,I1,t1,publicDataPromise,blockDataState,taxiSeed};\n';
 return {taxi,main};
}
function syntaxCheck(sources){
 for(const [name,source] of Object.entries(sources)){
  const result=spawnSync(process.execPath,['--input-type=module','--check'],{input:source,encoding:'utf8',maxBuffer:1024*1024});
  assert.equal(result.status,0,`${name} syntax: ${result.stderr}`);
 }
}
function fixtureRequest(){
 const path=resolve(ROOT,'tests/navigation/fixtures/land-coverage-72.json'),fixture=readJSON(path);
 assert.equal(fixture.seed,CONFIG.landSeed,'Land fixture seed drift');
 const request={...structuredClone(fixture.rows[CONFIG.od-1].request),departureDate:CONFIG.departureDate,departureS:CONFIG.departureS,need:CONFIG.need};
 assert.deepEqual([request.origin.coordinates,request.destination.coordinates],EXPECTED_ENDPOINTS,'Original OD7 coordinates drift');
 return {request,landFixtureSha256:digest(readFileSync(path))};
}
const compactPoint=p=>p&&Object.fromEntries(['id','name','mode','coordinates','distanceM','selectionScore'].filter(k=>p[k]!==undefined).map(k=>[k,p[k]]));
const resultSummary=r=>r?{complete:!!r.journey?.complete,status:r.status,failureStatus:r.failureStatus,incompleteReason:r.incompleteReason,message:r.message,totalMinutes:r.totalMinutes,arrivalS:r.arrivalS,walkMinutes:r.walkMinutes,waitMinutes:r.waitMinutes,transfers:r.transfers,endpointAccess:r.endpointAccess,warnings:r.warnings,publicRide:(r.segments??[]).some(s=>['rail','metro','bus','tram'].includes(s.kind)),segments:(r.segments??[]).map(s=>({kind:s.kind,minutes:s.minutes,distanceM:s.distanceM})),timedLegs:(r.timedLegs??[]).map(l=>({kind:l.kind,patternId:l.patternId,fromId:l.fromId,toId:l.toId,departureS:l.departureS,arrivalS:l.arrivalS,durationS:l.durationS,geometrySha256:l.geometry?digest(JSON.stringify(l.geometry)):null}))}:null;
const quoteSummary=q=>q?{carId:q.carId,passengerReadyS:q.passengerReadyS,carArrivalS:q.carArrivalS,pickupS:q.pickupS,dropoffS:q.dropoffS,passengerWaitS:q.passengerWaitS,vehicleWaitS:q.vehicleWaitS,passengerDistanceM:q.passengerRoute?.lengthM,passengerDurationS:q.passengerRoute?.durationS,harbourTunnel:q.harbourTunnel}:null;

async function runArm(arm,out,expectedRuntime,expectedSignature){
 assert.ok(['baseline','extra-last-99133'].includes(arm));
 const runtime=runtimeIdentity(BASE);
 assert.equal(runtime.version,expectedRuntime,'Runtime changed before arm');
 assert.equal(runtime.signature,expectedSignature,'Source hashes changed before arm');
 const {request,landFixtureSha256}=fixtureRequest(),sources=transformedSources();
 const events=[],published=[],publicResults=[],workers=[],workerErrors=[],terminations=[],fetches=[],samples=[];
 const started=performance.now();let routeStart=null,api,sampler,activeTrial=null,shortlists=null,directQuote=null,planStatus=null;
 const event=(kind,details={})=>events.push({bootMs:performance.now()-started,routeMs:routeStart===null?null:performance.now()-routeStart,kind,...details});
 const trials=new Map();
 const trial=(side,id)=>trials.get(side+':'+id);
 globalThis.__taxiCounterfactual={
  shortlist(candidates,input,select){
   assert.equal(shortlists,null,'Unexpected S1 replan; arm is inconclusive');
   const defaults=structuredClone(candidates);
   const eligible=select({...input,side:'last',limits:{metro:100,bus:100,tram:100}});
   const extra=eligible.find(p=>p.id===TARGET&&p.mode==='tram');
   assert.ok(extra,'Target no longer passes unchanged geography/direction/spacing filters');
   assert.deepEqual(extra.coordinates,[114.16454,22.27827],'Target source coordinates changed');
   assert.ok(!defaults.last.some(p=>p.id===TARGET),'Target already in baseline; experiment obsolete');
   if(arm==='extra-last-99133')candidates.last.push(extra);
   assert.deepEqual(candidates.first,defaults.first,'First shortlist changed');
   assert.deepEqual(candidates.last.slice(0,defaults.last.length),defaults.last,'Default last shortlist changed');
   assert.equal(candidates.last.length-defaults.last.length,arm==='baseline'?0:1);
   shortlists={defaults:Object.fromEntries(Object.entries(defaults).map(([side,xs])=>[side,xs.map(compactPoint)])),actual:Object.fromEntries(Object.entries(candidates).map(([side,xs])=>[side,xs.map(compactPoint)])),eligibleExtra:compactPoint(extra),targetOmissionReason:'eligible-under-unchanged-filters-but-excluded-by-default-tram-cap'};
   for(const side of ['last','first'])for(const p of candidates[side])trials.set(side+':'+p.id,{side,point:compactPoint(p),choiceId:'taxi-'+side+'-'+p.mode+'-'+p.id,status:'not-started',feeder95:{status:'not-evaluated'}});
   event('shortlists',shortlists);
  },
  begin(side,p){activeTrial=trial(side,p.id);activeTrial.status='started';event('candidate-start',{side,id:p.id});},
  link(side,p,road,link){const t=trial(side,p.id);t.curb={roadId:road?.id,roadCoordinate:road?.coordinate,linkDistanceM:link?.distanceM,linkDurationS:link?.durationS,guardPassed:!!link,qualification:'Production modeled curb connector; no physical accessibility/elevation certification'};if(!link)t.status=road?'rejected-curb-guard':'outside-road-coverage';},
  direct(q){directQuote=quoteSummary(q);event('direct-quote',{quote:directQuote});},
  quote(side,p,q,direct){const t=trial(side,p.id);t.taxiQuote=quoteSummary(q);t.feeder95=q?{status:direct?(q.passengerRoute.lengthM<direct.passengerRoute.lengthM*.95?'passed':'rejected'):'not-evaluated-no-direct-quote',passengerDistanceM:q.passengerRoute.lengthM,directDistanceM:direct?.passengerRoute.lengthM,thresholdM:direct?.passengerRoute.lengthM*.95,ratio:direct?q.passengerRoute.lengthM/direct.passengerRoute.lengthM:null}:{status:'not-evaluated-no-quote'};if(!q)t.status='no-taxi-quote';event('feeder-quote',{side,id:p.id,quote:t.taxiQuote,feeder95:t.feeder95});},
  publicRaw(query,result,compatible){const record={query:{origin:identity(query.origin),destination:identity(query.destination),departureS:query.departureS,departureDate:query.departureDate,need:query.need,allowedTransitModes:query.allowedTransitModes},result:resultSummary(result),overlayCompatible:!!compatible};if(activeTrial)activeTrial.publicRaw=record;event('public-raw',record);},
  published(choice){published.push(choice);const t=[...trials.values()].find(t=>t.choiceId===choice.id);if(t){t.published=true;t.publishedComplete=!!choice.result?.journey?.complete;}event('published',{id:choice.id,complete:!!choice.result?.journey?.complete,minutes:choice.minutes,cost:choice.cost});},
  async plan(fn,args){
   try{planStatus=await fn({...args,ask:(...params)=>{
    const quote=args.ask(...params);if(activeTrial){activeTrial.ask={pickup:params[0],destination:params[1],passengerReadyS:params[2],quote:quoteSummary(quote)};if(!quote)activeTrial.status='no-taxi-quote';}
    event('ask',{side:activeTrial?.side,id:activeTrial?.point.id,passengerReadyS:params[2],quote:quoteSummary(quote)});return quote;
   },publicRoute:async(...params)=>{
    const t=activeTrial;t.status='public-query-pending';t.publicQuery={origin:identity(params[0]),destination:identity(params[1]),departureS:params[2],mode:params[3]};
    const result=await args.publicRoute(...params);t.publicResult=resultSummary(result);if(result)publicResults.push({choiceId:t.choiceId,result});
    t.status=!result?.journey?.complete?'public-prefix-or-suffix-incomplete':!t.publicResult.publicRide?'no-public-ride':'public-query-complete';
    if(!result?.journey?.complete)t.rejection={stage:t.side==='last'?'public-prefix':'public-suffix',reason:t.publicRaw?.result?.failureStatus??t.publicRaw?.result?.incompleteReason??(t.publicRaw?.result?.complete&&!t.publicRaw.overlayCompatible?'incompatible-with-overlay':'production-publicRoute-returned-null'),raw:t.publicRaw?.result??null};
    event('public-return',{side:t.side,id:t.point.id,status:t.status,result:t.publicResult});return result;
   },onDiagnostic:entry=>{const t=trial(entry.side,entry.id);if(t){t.diagnostic=entry;t.status=entry.status==='ready'?(t.publishedComplete?'published-complete':'published-incomplete'):entry.status;}event('production-diagnostic',entry);args.onDiagnostic?.(entry);}});event('taxi-plan-end',{status:planStatus});return planStatus;}
   catch(error){event('taxi-plan-error',{message:error.message});throw error;}
  }
 };
 const els=new Map(),listeners=new Map();
 function el(id){if(els.has(id))return els.get(id);const e={id,focus(){},innerHTML:'',textContent:'',style:{},dataset:{},clientWidth:1000,clientHeight:800,childElementCount:0,hidden:false,relList:{supports:()=>true},classList:{add(){},remove(){},toggle(){return false;}},querySelector:s=>el(s),querySelectorAll:()=>[],setAttribute(){},getAttribute(){return null;},toggleAttribute(){},getBoundingClientRect:()=>({height:200,width:1000,top:0,left:0}),addEventListener:(type,fn)=>listeners.set(id+':'+type,fn),insertAdjacentHTML(_,s){this.innerHTML+=s;},matches:()=>false};els.set(id,e);return e;}
 globalThis.requestAnimationFrame=callback=>setTimeout(callback,0);
 globalThis.document={createElement:()=>el('created'),querySelector:el,querySelectorAll:()=>[]};
 globalThis.window={innerWidth:1000,addEventListener(){}};globalThis.history={replaceState(){},pushState(){}};globalThis.location={hash:'#home'};Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});
 globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};window.localStorage=globalThis.localStorage;
 globalThis.fetch=async url=>{const path=new URL(url,'http://localhost').pathname;try{const bytes=readFileSync(BASE+path);fetches.push({path,bytes:bytes.length,sha256:digest(bytes)});return new Response(bytes,{status:200});}catch{fetches.push({path,status:404});return new Response('',{status:404});}};
 globalThis.Worker=class{
  constructor(url){const path=BASE+new URL(url).pathname.replace(BASE,''),id=workers.length+1;this.id=id;this.kind=basename(path);this.pending=new Set();workers.push(this);event('worker-create',{id,kind:this.kind});
   this.w=new NodeWorker(`const {parentPort}=require('node:worker_threads');globalThis.self=globalThis;globalThis.postMessage=x=>parentPort.postMessage(x);parentPort.on('message',x=>globalThis.onmessage({data:x}));require(${JSON.stringify(path)});`,{eval:true,resourceLimits:{maxOldGenerationSizeMb:384}});
   this.w.on('message',data=>{this.pending.delete(data.id);this.onmessage?.({data});});this.w.on('error',e=>{workerErrors.push({worker:id,code:e.code,message:e.message});this.onerror?.(e);});this.w.on('exit',code=>{this.exited=true;this.exitCode=code;});
  }
  postMessage(data){this.pending.add(data.id);this.w.postMessage(data);}
  terminate(){if(this.termination)return this.termination;this.terminateRequested=true;this.termination=this.w.terminate();terminations.push(this.termination);event('worker-terminate',{id:this.id,kind:this.kind});return this.termination;}
 };
 const click=dataset=>listeners.get('#navigation-app:click')({target:{closest:()=>({dataset})}});
 try{
  api=await import(dataURL(sources.main));await api.publicDataPromise;
  const blockStart=performance.now();while(api.blockDataState==='loading'&&performance.now()-blockStart<15000)await sleep(20);
  assert.ok(api.Q&&api.L1&&api.blockDataState==='ready','All source data must be ready before plan');assert.equal(api.taxiSeed,CONFIG.taxiSeed,'Production taxi seed drift');
  const change=(selector,value)=>listeners.get('#navigation-app:change')({target:{dataset:{},value,matches:s=>s===selector}});
  change('[data-app="departure-date"]',CONFIG.departureDate);change('[data-app="departure"]','11:00');
  api.r.origin=structuredClone(request.origin);api.r.destination=structuredClone(request.destination);api.r.need=CONFIG.need;api.t1.clear();api.t1.add('taxi');
  const originalIdentity=JSON.stringify([identity(request.origin),identity(request.destination)]);
  routeStart=performance.now();sampler=setInterval(()=>samples.push({routeMs:performance.now()-routeStart,rss:process.memoryUsage().rss,heapUsed:process.memoryUsage().heapUsed}),1000);click({action:'plan'});
  let state;for(;;){if(!api.d1){state='complete';break;}if(performance.now()-routeStart>=CONFIG.windowMs){state='observation-window-ended';break;}await sleep(50);}
  const wallMs=performance.now()-routeStart,performanceReport=structuredClone(window.__navigationPerformance),planningStarted=Number.isFinite(performanceReport?.startedMonotonic)&&performanceReport.startedMonotonic>=routeStart;
  clearInterval(sampler);const observationMemory={...process.memoryUsage(),maxRSSKiB:process.resourceUsage().maxRSS,samples};
  const timing=completionTiming(state,wallMs,performanceReport,{planningStarted}),finalChoices=[...api.C],captured=[...published],observedPublicResults=[...publicResults];
  const frozenTrials=structuredClone([...trials.values()]),frozenEvents=structuredClone(events),frozenStatus=structuredClone(planStatus);
  const finalIds=new Set(finalChoices.map(c=>c.id)),allChoices=[...new Map([...captured,...finalChoices].map(c=>[c.id,c])).values()];
  const requestIdentityPreserved=originalIdentity===JSON.stringify([identity(api.r.origin),identity(api.r.destination)]),pendingAtObservation=!!api.d1;
  const pendingBeforeCancel=workers.filter(w=>!w.exited&&w.pending.size).map(w=>({id:w.id,kind:w.kind,pending:[...w.pending]}));
  const fingerprint=()=>JSON.stringify(api.C.map(c=>[c.id,c.available,c.minutes,c.cost]));
  click({action:'cancel-plan'});const afterCancel=fingerprint();await sleep(500);
  const cancel={exercisedWhilePending:pendingAtObservation,planningStopped:!api.d1,pendingBeforeCancel,pendingAfterCancel:workers.filter(w=>!w.exited&&!w.terminateRequested&&w.pending.size).map(w=>w.id),noStaleCandidatePublication:fingerprint()===afterCancel};cancel.pass=cancel.planningStopped&&cancel.pendingAfterCancel.length===0&&cancel.noStaleCandidatePublication;
  clearInterval(sampler);
  const index=sourceIndex([api.Q,api.L1,api.z]),auditContext={request,need:CONFIG.need,taxi:true,fixture:{floors:[]},index,services:api.I1};
  const candidates=allChoices.filter(c=>c.available).map(c=>({...auditCandidate(c,auditContext),retainedByProductionDedup:finalIds.has(c.id),taxiQuote:quoteSummary(c.result.taxiQuote),transferAnchor:c.result.transferAnchor,timing:resultSummary(c.result)}));
  const unavailable=allChoices.filter(c=>!c.available).map(auditUnavailable);
  const publicPrefixSuffixAudits=observedPublicResults.map(({choiceId,result})=>({choiceId,transitRideBoundaries:auditTransitRideBoundaries(result,api.I1),qualification:'Audit of the actual returned public prefix/suffix; composition does not preserve its timedLegs. Source-stop/shape continuity is not physical boarding-access certification.'}));
  const {rankJourneys,deduplicateJourneys}=await import(pathToFileURL(resolve(BASE,'assets/integrated-navigation.js')));
  const {journeyScore}=await import(pathToFileURL(resolve(BASE,'assets/journey-score.js')));
  const scores=choices=>CONFIG.costWeights.map(cost=>({costWeight:cost,priority:'time',need:CONFIG.need,choices:rankJourneys(choices.filter(c=>c.available),'time',CONFIG.need,{cost}).map(c=>({id:c.id,auditPass:candidates.find(a=>a.id===c.id)?.pass??false,...journeyScore(c,'time',CONFIG.need,{cost})}))}));
  const patternIds=new Set([...api.I1.patterns.filter(p=>p.stops.some(s=>s.stopId===TARGET)).map(p=>p.id),...candidates.flatMap(c=>c.timing.timedLegs.map(l=>l.patternId).filter(Boolean)),...frozenTrials.flatMap(t=>(t.publicRaw?.result?.timedLegs??[]).map(l=>l.patternId).filter(Boolean))]);
  const serviceEvidence={servicesSha256:runtime.assets['transit/services.json'],patterns:api.I1.patterns.filter(p=>patternIds.has(p.id)).map(p=>({id:p.id,mode:p.mode,sourceUrl:p.provenance?.sourceUrl,geometrySourceUrl:p.provenance?.geometrySourceUrl,scheduleKind:p.provenance?.scheduleKind,geometryMode:p.geometryMode,patternSha256:digest(JSON.stringify(p)),sourceShapeSha256:p.shape?digest(JSON.stringify(p.shape)):null,stopsSha256:digest(JSON.stringify(p.stops)),targetStop:p.stops.find(s=>s.stopId===TARGET)}))};
  const after=runtimeIdentity(BASE),runtimeStable=after.version===runtime.version&&after.signature===runtime.signature;
  const report={schema:1,arm,config:CONFIG,runtime,runtimeStable,landFixtureSha256,request,requestIdentityPreserved,instrumentation:{scriptSha256:digest(readFileSync(SELF)),mainSha256:digest(sources.main),taxiSha256:digest(sources.taxi),productionModified:false,dataCopied:false},state:timing.state,comparisonStatus:timing.comparisonStatus,failedStages:timing.failedStages,planningStarted,wallMs,fullCandidateWallMs:timing.fullCandidateWallMs,bootMs:routeStart-started,performance:performanceReport,shortlists,directQuote,taxiPlanStatus:frozenStatus,trials:frozenTrials,candidates,unavailable,publicPrefixSuffixAudits,rankings:{allObservedComplete:scores(allChoices),withProductionDedup:scores(deduplicateJourneys(allChoices)),finalProductionChoices:scores(finalChoices),qualification:'Offline rerank of observed completed candidates only. Weight changes do not rerun routing or the shortlist heuristic. Pending/failed arms cannot establish an exhaustive winner.'},serviceEvidence,fetches,cancel,workerErrors,memory:observationMemory,workers:workers.map(w=>({id:w.id,kind:w.kind,terminateRequested:!!w.terminateRequested,exited:!!w.exited,pending:[...w.pending]})),limitations:['Production S1 and unmodified Workers with Node DOM stand-ins; not browser visual acceptance.','Taxi/curb geometry, dispatch and fares remain production modeled estimates, not real-world access or official live tariffs.','Append-only target runs after default last-side choices, before first-side choices under unchanged production order; observation-window timing may differ.','No route/constraint/time-budget relaxation. 60 seconds is an observer cutoff, not a search algorithm limit; external watchdog is resource safety only.','A complete target candidate is not automatically better; a pending, absent, rejected or error result is never success.']};
  report.classification=runtimeStable?classifyObservation({state:timing.state,candidates,workerErrors,requestChanged:!requestIdentityPreserved,cancel,comparisonStatus:timing.comparisonStatus,failedStages:timing.failedStages}):'runtime-changed-inconclusive';
  if(publicPrefixSuffixAudits.some(a=>a.transitRideBoundaries.some(b=>!b.pass)))report.classification='invariant-failure';
  const t=frozenTrials.find(t=>t.choiceId===TARGET_CHOICE),targetCandidate=candidates.find(c=>c.id===TARGET_CHOICE),targetUnavailable=unavailable.find(c=>c.id===TARGET_CHOICE);
  report.target={id:TARGET_CHOICE,status:arm==='baseline'?'not-in-default-shortlist':t?.status??'taxi-shortlist-not-reached',trial:t??null,candidate:targetCandidate??null,unavailable:targetUnavailable??null,completeAndAuditPassing:!!targetCandidate?.pass,qualifiedAsImprovement:false};
  writeFileSync(out,json(report));writeFileSync(out.replace(/\.json$/,'.events.ndjson'),frozenEvents.map(e=>JSON.stringify(e)).join('\n')+'\n');
  return report.classification==='completed-with-candidates'?0:report.classification==='pending-observation-window'?2:1;
 }finally{clearInterval(sampler);if(api?.d1)click({action:'cancel-plan'});for(const w of workers)w.terminate();await Promise.allSettled(terminations);delete globalThis.__taxiCounterfactual;}
}

async function runPair(){
 const expectedRuntime=process.env.HK_COUNTERFACTUAL_RUNTIME,out=process.env.HK_COUNTERFACTUAL_OUT;
 assert.ok(expectedRuntime&&out,'--run requires explicit HK_COUNTERFACTUAL_RUNTIME and HK_COUNTERFACTUAL_OUT');
 const output=resolve(out),scope=resolve(ROOT,'validation/performance');
 assert.ok(relative(scope,output)&&!relative(scope,output).startsWith('..')&&!relative(scope,output).startsWith('/'),'Output must be a new directory inside validation/performance');
 assert.ok(!existsSync(output),'Refusing to overwrite any existing experiment');
 const runtime=runtimeIdentity(BASE);assert.equal(runtime.version,expectedRuntime,'Requested runtime is not current');
 syntaxCheck(transformedSources());fixtureRequest();mkdirSync(output,{recursive:true});
 const runs=[];
 for(const arm of ['baseline','extra-last-99133']){
  const reportPath=resolve(output,arm+'.json');
  const execution=await new Promise((resolveExecution,reject)=>{
   const child=spawn(process.execPath,['--max-old-space-size=768',SELF,'--arm',arm,reportPath,runtime.version,runtime.signature],{stdio:['ignore','pipe','pipe']});
   let stdout='',stderr='',watchdog=false;child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
   const timer=setTimeout(()=>{watchdog=true;child.kill('SIGKILL');},CONFIG.watchdogMs);
   child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',(code,signal)=>{clearTimeout(timer);resolveExecution({code,signal,watchdog,stdout,stderr});});
  });
  writeFileSync(resolve(output,arm+'.process.json'),json(execution));
  runs.push({arm,reportPath,execution,report:existsSync(reportPath)?readJSON(reportPath):null});
  console.log(json({arm,code:execution.code,watchdog:execution.watchdog,state:runs.at(-1).report?.state,target:runs.at(-1).report?.target.status}));
  if(execution.watchdog||execution.code===1)break; // Do not compound an OOM/error.
 }
 const [baseline,extra]=runs.map(r=>r.report),sameInputs=!!baseline&&!!extra&&JSON.stringify(baseline.request)===JSON.stringify(extra.request)&&baseline.runtime.signature===extra.runtime.signature&&baseline.runtimeStable&&extra.runtimeStable&&baseline.landFixtureSha256===extra.landFixtureSha256;
 const bothComplete=sameInputs&&runs.every(r=>r.execution.code===0&&r.report?.classification==='completed-with-candidates');
 const target=extra?.candidates.find(c=>c.id===TARGET_CHOICE),metricKeys=['minutes','cost','walkMinutes','waitMinutes','transfers'];
 const common=baseline&&extra?baseline.candidates.map(b=>{const e=extra.candidates.find(c=>c.id===b.id);return {id:b.id,observedInBoth:!!e,metricsIdentical:!!e&&metricKeys.every(k=>b[k]===e[k]),baseline:Object.fromEntries(metricKeys.map(k=>[k,b[k]])),extra:e&&Object.fromEntries(metricKeys.map(k=>[k,e[k]]))};}):[];
 const comparison={schema:1,config:CONFIG,runtimeVersion:runtime.version,sameInputs,bothComplete,conclusion:!sameInputs?'inconclusive-missing-or-changed-inputs':!bothComplete?'inconclusive-full-comparison-pending-or-failed':!target?'target-did-not-produce-complete-candidate':!target.pass?'target-invariant-failure':'completed-candidate-ready-for-tradeoff-review',target:extra?.target??null,commonCandidateMetrics:common,priceComparisons:CONFIG.costWeights.map(costWeight=>({costWeight,baseline:baseline?.rankings.finalProductionChoices.find(r=>r.costWeight===costWeight),extra:extra?.rankings.finalProductionChoices.find(r=>r.costWeight===costWeight)})),runs:runs.map(({arm,reportPath,execution,report})=>({arm,reportPath,code:execution.code,watchdog:execution.watchdog,classification:report?.classification,state:report?.state})),qualification:'Only completed audited journeys can be compared. No omitted/pending route is assigned an infinite score or declared dominated. A completed target does not by itself establish benefit.'};
 writeFileSync(resolve(output,'comparison.json'),json(comparison));console.log(json({out:output,conclusion:comparison.conclusion,bothComplete,targetStatus:extra?.target.status}));
 return bothComplete&&target?.pass?0:runs.some(r=>r.execution.code===1||r.execution.watchdog)?1:2;
}

if(process.argv[2]==='--arm'){
 try{process.exitCode=await runArm(process.argv[3],process.argv[4],process.argv[5],process.argv[6]);}catch(error){console.error(error.stack);process.exitCode=1;}
 process.exit(process.exitCode??0);
}else if(process.argv.length===2||process.argv[2]==='--check'){
 const sources=transformedSources();syntaxCheck(sources);fixtureRequest();
 console.log(json({mode:'static-check-only',runtime:readJSON(resolve(BASE,'build-meta.json')).version,config:CONFIG,transformedModulesParsed:Object.keys(sources),routeExecuted:false,workersCreated:0,productionFilesModified:0,dataCopied:false}));
}else if(process.argv[2]==='--run'){
 process.exitCode=await runPair();
}else throw Error('Use --check (no route), or explicitly approved --run with pinned runtime/output.');
