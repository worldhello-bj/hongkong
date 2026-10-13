import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import{readFileSync}from'node:fs';
import{hasPublicAlternative}from'../../src/navigation/journey-score.js';
import{runBounded}from'../../src/navigation/integrated-navigation.js';
import{runRoutingPhases}from'../../src/navigation/routing-queue.js';
import{demoEndpointEvidenceMissing}from'../../src/navigation/demo-fallback.js';
import{PASSENGER_NEEDS}from'../../src/navigation/passenger-preferences.js';
import{normalizeNavigationState}from'../../src/navigation/ui-navigation.js';
import{handlesHighSpeedRequest}from'../../src/navigation/highspeed-routing.js';
import{createTrafficClock}from'../../src/navigation/traffic-clock.js';
import {createExactPublicTerminalPrecheck,runExactPublicTerminalPrecheck,TERMINAL_RESOLVER_POLICY_ID} from '../../src/navigation/terminal-isolation.js';
function createS1Context(ctx) { Object.assign(ctx,{createExactPublicTerminalPrecheck,runExactPublicTerminalPrecheck,TERMINAL_POLICY_ID:TERMINAL_RESOLVER_POLICY_ID,terminalPrecheckState:undefined}); return vm.createContext(ctx); }
const source=readFileSync(new URL('../../src/navigation/main.recovered.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('async function S1() {'),source.indexOf('\nfunction ',source.indexOf('async function S1() {')));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
const tick=()=>new Promise(r=>setImmediate(r));
const passengerCases=[...PASSENGER_NEEDS.map(need=>({inputNeed:need,need,migrated:false,label:need})),...['accessible','strict_accessibility','wheelchair'].map(inputNeed=>({inputNeed,need:'ordinary',migrated:true,label:inputNeed+' → ordinary migration'}))];
for(const {inputNeed,need,migrated,label} of passengerCases)test(`actual S1 preserves exact ${label} endpoints through fallback and rejects cancelled refinements`,async()=>{
 const walk=deferred(),detail=deferred(),calls=[];const router={dispose(){}};const fast={dispose(){}};
 const ok={journey:{complete:true,steps:[],graph:{edges:[]}},warnings:[],message:'modeled'};
 const ctx={normalizeNavigationState,demoEndpointEvidenceMissing,handlesHighSpeedRequest,console,performance,AbortController,Date,Number,Set,Map,Promise,
 r:{origin:{id:'a',name:'a',coordinates:[114.16,22.28]},destination:{id:'b',name:'b',node_id:'source-lift',coordinates:[114.17,22.28,13.8]},need:inputNeed},
 publicDataReady:true,h1:0,y1:false,t1:new Set(),w1:'2026-10-11',c1:'08:00',PUBLIC_MODES:['metro','bus','tram'],L1:{edges:[],portals:[{id:'b',node_id:'source-lift',level:'G'}]},Q:{nodes:[],edges:[],closures:[]},z:null,O2:[],I1:{},publicWalkLinks:{},
 G:0,G1:null,d1:false,pendingDetailRefresh:false,$:undefined,C:[],_:undefined,taxiCoverageMessage:'',stationEntranceOptions:[],stationAlternativeLoading:false,routePerformance:{},routeResultCache:new Map(),stationAlternativeData:null,blockDataState:'ready',fastPublicRouter:fast,b2:router,window:{},history:{pushState(){}},writeAppHistory(){},hasPublicAlternative,createRoutingQueue:()=>({run:task=>task(),dispose(){}}),M1:0,T1:()=>({}),
 N(){},x(){},Z(){},B(){},t2:()=>({id:'ADM'}),publicPointRegion:()=>({id:'ADM'}),rankJourneys:a=>a,deduplicateJourneys:a=>a,annotatePreferenceResult:a=>a,annotateStationDetour:(_,a)=>a,compatibleWithOverlay:()=>true,u2:(id,result)=>({id,result,available:!!result.journey?.complete}),disposeIdleWalkWorkers(){},E2:()=>({demo:true,dispose(){}}),annotateDemoFallback:a=>a.journey?.complete?a:null,runBounded,runRoutingPhases,
 f2:async(req,L,Q,router)=>{if(req.mode==='walk'){calls.push('walk');return walk.promise}if(router.demo){assert.equal(req.need,need);assert.equal(req.destination,ctx.r.destination);assert.equal(req.destination.node_id,'source-lift');assert.deepEqual(req.destination.coordinates,[114.17,22.28,13.8]);calls.push('demo');return ok}if(router===fast){calls.push('fast');return{message:'missing access',warnings:[]}}calls.push('detail');return detail.promise},
 };
 const originalEndpoints=structuredClone({origin:ctx.r.origin,destination:ctx.r.destination});
 ctx.u1=()=>{ctx.h1++;ctx.G1?.abort()};ctx.trafficClock=createTrafficClock({date:ctx.w1,timeS:Number(ctx.c1.slice(0,2))*3600+Number(ctx.c1.slice(3))*60});ctx.trafficScenarioKey=()=>ctx.trafficClock.baseDate+':'+ctx.trafficClock.timeS;ctx.syncTraffic=()=>{};createS1Context(ctx);vm.runInContext("const evaluateOriginOpening=()=>null,canTraverseSource=()=>true;\n"+code,ctx);const pending=ctx.S1();
 for(let i=0;i<8;i++)await tick();
 assert.equal(ctx.r.need,need,'requests enter routing only under one of the four current preferences');
 assert.equal(ctx.trafficClock.playing,false);assert.equal(ctx.routeSnapshot.departureS,ctx.trafficClock.timeS);assert.equal(ctx.routeSnapshot.departureDate,ctx.w1);assert.equal(Object.isFrozen(ctx.routeSnapshot),true);
 assert.equal(ctx.r.passengerNeedMigrated,migrated?true:undefined,'retired input is explicitly marked for the UI migration notice');
 assert.deepEqual({origin:ctx.r.origin,destination:ctx.r.destination},originalEndpoints,'migration retains exact source node, floor and coordinates');
 for(const key of ctx.routeResultCache.keys())assert.equal(JSON.parse(key)[1].need,need,'cache uses canonical preference rather than a retired fifth mode');
 assert(!calls.includes('walk'),'heavy walk must not block pending public/taxi comparisons');assert(calls.includes('detail'));assert(calls.includes('demo'));assert(ctx.C.some(c=>c.available));assert(ctx._.available);assert.equal(ctx.$.message,'modeled');assert.equal(ctx.d1,true);
 const before=ctx.C.length;ctx.u1();walk.resolve({...ok,message:'stale walk'});detail.resolve({...ok,message:'stale detail'});await pending;
 assert(!calls.includes('walk'),'cancellation prevents deferred walk from starting');assert.equal(ctx.C.length,before);assert.equal(ctx.$.message,'modeled');assert(calls.indexOf('demo')<calls.indexOf('detail'));
});
test('actual S1 gives taxi the exact base owner and waits for its dependent queries before evicting it',async()=>{
 const taxi=deferred(),calls=[];const fast={dispose(){calls.push('dispose-base')}},detail={dispose(){}};
 const ok={journey:{complete:true,steps:[],graph:{edges:[]}},warnings:[],message:'complete'};
 const ctx={normalizeNavigationState,demoEndpointEvidenceMissing,handlesHighSpeedRequest,console,performance,AbortController,Date,Number,Set,Map,Promise,
 r:{origin:{id:'a',name:'a',coordinates:[114.16,22.28]},destination:{id:'b',name:'b',coordinates:[114.17,22.28]},need:'luggage'},
 publicDataReady:true,h1:0,y1:false,t1:new Set(['taxi']),w1:'2026-10-11',c1:'08:00',PUBLIC_MODES:['metro','bus','tram'],L1:{edges:[],portals:[]},Q:{nodes:[],edges:[],closures:[]},z:null,O2:[],I1:{},publicWalkLinks:{},
 G:0,G1:null,d1:false,pendingDetailRefresh:false,$:undefined,C:[],_:undefined,taxiCoverageMessage:'',stationEntranceOptions:[],stationAlternativeLoading:false,routePerformance:{},routeResultCache:new Map(),stationAlternativeData:null,blockDataState:'ready',fastPublicRouter:fast,b2:detail,window:{},writeAppHistory(){},hasPublicAlternative,createRoutingQueue:()=>({run:task=>task(),dispose(){}}),
 x(){},Z(){},B(){},t2:()=>({id:'ADM'}),publicPointRegion:()=>({id:'ADM'}),rankJourneys:a=>a,deduplicateJourneys:a=>a,annotatePreferenceResult:a=>a,annotateStationDetour:(_,a)=>a,compatibleWithOverlay:()=>true,u2:(id,result)=>({id,result,available:!!result.journey?.complete}),disposeIdleWalkWorkers(){},E2:()=>({demo:true,dispose(){}}),annotateDemoFallback:a=>a.journey?.complete?a:null,runRoutingPhases,
 f2:async(req,L,Q,router)=>{calls.push(req.mode==='walk'?'walk':router.demo?'demo':router===fast?'base':'detail');return router===fast?{warnings:[],message:'missing'}:ok},
 n3:async(request,signal,queue,shared)=>{assert.equal(shared,fast);assert.equal(request.departureS,28800);assert.equal(request.need,'luggage');calls.push('taxi-direct');await taxi.promise;if(signal.aborted)return;await queue.run(()=>{calls.push('taxi-last');return ok},shared);await queue.run(()=>{calls.push('taxi-first');return ok},shared)},
 };
 ctx.u1=()=>{ctx.h1++;ctx.G1?.abort()};ctx.trafficClock=createTrafficClock({date:ctx.w1,timeS:Number(ctx.c1.slice(0,2))*3600+Number(ctx.c1.slice(3))*60});ctx.trafficScenarioKey=()=>ctx.trafficClock.baseDate+':'+ctx.trafficClock.timeS;ctx.syncTraffic=()=>{};createS1Context(ctx);vm.runInContext("const evaluateOriginOpening=()=>null,canTraverseSource=()=>true;\n"+code,ctx);const pending=ctx.S1();
 for(let i=0;i<6;i++)await tick();assert(calls.includes('base'));assert(calls.includes('taxi-direct'));assert(!calls.includes('demo'));assert(!calls.includes('detail'));assert(!calls.includes('dispose-base'),'shared worker cannot be disposed after base public alone');
 taxi.resolve();await pending;
 assert(calls.indexOf('taxi-first')<calls.indexOf('demo'));assert(calls.indexOf('demo')<calls.indexOf('detail'));assert(calls.indexOf('detail')<calls.indexOf('walk'));assert.equal(ctx.d1,false);assert(ctx.C.some(choice=>choice.available));
});

test('actual S1 keeps usable candidates and marks Worker/refinement errors incomplete, never successful or unreachable',async()=>{
 const taxi=deferred(),calls=[];const fast={dispose(){calls.push('dispose-base')}},detail={dispose(){}};
 const ok={journey:{complete:true,steps:[],graph:{edges:[]}},warnings:[],message:'complete'};
 const ctx={normalizeNavigationState,demoEndpointEvidenceMissing,handlesHighSpeedRequest,console,performance,AbortController,Date,Number,Set,Map,Promise,
 r:{origin:{id:'a',name:'a',coordinates:[114.16,22.28]},destination:{id:'b',name:'b',coordinates:[114.17,22.28]},need:'luggage'},
 publicDataReady:true,h1:0,y1:false,t1:new Set(['taxi']),w1:'2026-10-11',c1:'08:00',PUBLIC_MODES:['metro','bus','tram'],L1:{edges:[],portals:[]},Q:{nodes:[],edges:[],closures:[]},z:null,O2:[],I1:{},publicWalkLinks:{},
 G:0,G1:null,d1:false,pendingDetailRefresh:false,$:undefined,C:[],_:undefined,taxiCoverageMessage:'',stationEntranceOptions:[],stationAlternativeLoading:false,routePerformance:{},routeResultCache:new Map(),stationAlternativeData:null,blockDataState:'ready',fastPublicRouter:fast,b2:detail,window:{},writeAppHistory(){},hasPublicAlternative,createRoutingQueue:()=>({run:task=>task(),dispose(){}}),
 x(){},Z(message){ctx.lastMessage=message},B(){},t2:()=>({id:'ADM'}),publicPointRegion:()=>({id:'ADM'}),rankJourneys:a=>a,deduplicateJourneys:a=>a,annotatePreferenceResult:a=>a,annotateStationDetour:(_,a)=>a,compatibleWithOverlay:()=>true,u2:(id,result)=>({id,result,available:!!result.journey?.complete}),disposeIdleWalkWorkers(){},E2:()=>({demo:true,dispose(){}}),annotateDemoFallback:a=>a.journey?.complete?a:null,runRoutingPhases,
 f2:async(req,L,Q,router)=>{calls.push(req.mode==='walk'?'walk':router.demo?'demo':router===fast?'base':'detail');if(router===detail&&req.mode!=='walk')throw Error('Worker memory limit');return router===fast?{warnings:[],message:'missing'}:ok},
 n3:async(request,signal,queue,shared)=>{assert.equal(shared,fast);assert.equal(request.departureS,28800);assert.equal(request.need,'luggage');calls.push('taxi-direct');await taxi.promise;if(signal.aborted)return;await queue.run(()=>{calls.push('taxi-last');return ok},shared);await queue.run(()=>{calls.push('taxi-first');return ok},shared)},
 };
 ctx.u1=()=>{ctx.h1++;ctx.G1?.abort()};ctx.trafficClock=createTrafficClock({date:ctx.w1,timeS:Number(ctx.c1.slice(0,2))*3600+Number(ctx.c1.slice(3))*60});ctx.trafficScenarioKey=()=>ctx.trafficClock.baseDate+':'+ctx.trafficClock.timeS;ctx.syncTraffic=()=>{};createS1Context(ctx);vm.runInContext("const evaluateOriginOpening=()=>null,canTraverseSource=()=>true;\n"+code,ctx);const pending=ctx.S1();
 for(let i=0;i<6;i++)await tick();assert(calls.includes('base'));assert(calls.includes('taxi-direct'));assert(!calls.includes('demo'));assert(!calls.includes('detail'));assert(!calls.includes('dispose-base'),'shared worker cannot be disposed after base public alone');
 taxi.resolve();await pending;
 assert(calls.indexOf('taxi-first')<calls.indexOf('demo'));assert(calls.indexOf('demo')<calls.indexOf('detail'));assert(calls.indexOf('detail')<calls.indexOf('walk'));assert.equal(ctx.d1,false);assert(ctx.C.some(choice=>choice.available));assert.equal(ctx.routePerformance.comparisonStatus,'incomplete-error');assert(ctx.routePerformance.failedStages.includes('transit-detailed'));assert.equal(ctx.C.find(c=>c.id==='transit-detailed').result.failureStatus,'SEARCH_ERROR');assert.match(ctx.lastMessage,/比较未完成/);assert.doesNotMatch(ctx.lastMessage,/方案已更新|不可达/);
});

for(const scenario of ['cache-miss','cache-hit','cancel-at-precheck'])test(`actual S1 named-floor evidence precheck ${scenario} keeps formal routing and cancellation`,async()=>{
 const calls=[],fast={dispose(){calls.push('dispose-base')}},detail={dispose(){calls.push('dispose-detail')}};
 const ok={journey:{complete:true,steps:[],graph:{edges:[]}},warnings:[],message:'formal'},cached={...ok,message:'cached'};
 const origin={id:'floor-lg1',namedPlaceId:'place',floorId:'lg1',floorName:'LG1',coordinates:[114.16,22.28]},destination={id:'floor-l4',namedPlaceId:'place',floorId:'l4',floorName:'L4',coordinates:[114.16,22.28]};
 const original=structuredClone({origin,destination});let prechecks=0;
 const ctx={normalizeNavigationState,handlesHighSpeedRequest,console,performance,AbortController,Date,Number,Set,Map,Promise,
 r:{origin,destination,need:'ordinary'},publicDataReady:true,h1:0,y1:false,t1:new Set(),w1:'2026-10-12',c1:'11:00',PUBLIC_MODES:['metro','bus','tram'],L1:{edges:[],portals:[]},Q:{nodes:[],edges:[],closures:[]},z:{edges:[]},O2:[],I1:{},publicWalkLinks:{},
 G:0,G1:null,d1:false,pendingDetailRefresh:false,$:undefined,C:[],_:undefined,taxiCoverageMessage:'',stationEntranceOptions:[],stationAlternativeLoading:false,routePerformance:{},routeResultCache:new Map(),stationAlternativeData:null,blockDataState:'ready',fastPublicRouter:fast,b2:detail,window:{},writeAppHistory(){},hasPublicAlternative,createRoutingQueue:()=>({run:task=>task(),dispose(){calls.push('dispose-queue')}}),
 x(){},Z(){},B(){},publicPointRegion:()=>({id:'ADM'}),rankJourneys:a=>a,deduplicateJourneys:a=>a,annotatePreferenceResult:a=>a,annotateStationDetour:(_,a)=>a,compatibleWithOverlay:()=>true,u2:(id,result)=>({id,result,available:!!result.journey?.complete}),disposeIdleWalkWorkers(){calls.push('dispose-walk')},E2(){throw Error('prechecked demo must not construct a router')},annotateDemoFallback(){throw Error('prechecked demo must not run accept')},runRoutingPhases,
 demoEndpointEvidenceMissing(request){prechecks++;assert.equal(request.origin,origin);assert.equal(request.destination,destination);if(scenario==='cancel-at-precheck')queueMicrotask(()=>ctx.u1());return demoEndpointEvidenceMissing(request)},
 f2:async(request,L,Q,router)=>{calls.push(request.mode==='walk'?'walk':router===fast?'base':'detail');assert.equal(request.origin,origin);assert.equal(request.destination,destination);return router===fast?{warnings:[],message:'needs-detail'}:ok},
 };
 if(scenario==='cache-hit')ctx.routeResultCache.set(JSON.stringify(['guarded-demo',{origin,destination,mode:'transit',need:'ordinary',departureDate:'2026-10-12',departureS:39600,allowedTransitModes:['metro','bus','tram']}]),cached);
 ctx.u1=()=>{ctx.h1++;ctx.G1?.abort()};ctx.trafficClock=createTrafficClock({date:ctx.w1,timeS:Number(ctx.c1.slice(0,2))*3600+Number(ctx.c1.slice(3))*60});ctx.trafficScenarioKey=()=>ctx.trafficClock.baseDate+':'+ctx.trafficClock.timeS;ctx.syncTraffic=()=>{};createS1Context(ctx);vm.runInContext("const evaluateOriginOpening=()=>null,canTraverseSource=()=>true;\n"+code,ctx);await ctx.S1();
 assert.deepEqual({origin,destination},original,'the original named floor is never replaced');
 assert(calls.includes('dispose-base'));assert(calls.includes('dispose-walk'),'finally cleanup is retained');
 if(scenario==='cancel-at-precheck'){
  assert.equal(prechecks,1);assert(!calls.includes('detail'));assert(!calls.includes('walk'));assert(!ctx.C.some(c=>c.available));
 }else{
  assert(calls.includes('detail'));assert(calls.includes('walk'));assert.equal(ctx.routePerformance.comparisonStatus,'complete');assert(ctx.C.some(c=>c.id==='transit-detailed'&&c.available));
  if(scenario==='cache-hit'){assert.equal(prechecks,0);assert(ctx.C.some(c=>c.id==='transit-demo-review'&&c.result.message==='cached'));assert(!ctx.routePerformance.stages.some(s=>s.status==='precheck-skipped'))}
  else{assert.equal(prechecks,1);assert(!ctx.C.some(c=>c.id==='transit-demo-review'));assert(ctx.routePerformance.stages.some(s=>s.id==='demo-fallback'&&s.status==='precheck-skipped'&&s.reason==='named-floor-source-evidence-required'))}
 }
});
test('planning captures and pauses click-time before data loading, and rejects seek while waiting',async()=>{
 const ready=deferred(),messages=[];
 const ctx={normalizeNavigationState,handlesHighSpeedRequest,performance,AbortController,Date,Number,Set,Map,Promise,
 r:{origin:{id:'a'},destination:{id:'b'},need:'ordinary'},publicDataReady:false,publicDataPromise:ready.promise,h1:0,y1:false,
 trafficClock:createTrafficClock({date:'2026-10-13',timeS:45296.9}),syncTraffic(){},Z:message=>messages.push(message)};
 createS1Context(ctx);vm.runInContext("const evaluateOriginOpening=()=>null,canTraverseSource=()=>true;\n"+code,ctx);const planning=ctx.S1();
 assert.equal(ctx.trafficClock.playing,false);assert.equal(ctx.trafficClock.timeS,45296);ctx.trafficClock.tick(100000);assert.equal(ctx.trafficClock.timeS,45296);
 ctx.trafficClock.seek({date:'2026-10-14',timeS:28800});ctx.publicDataReady=true;ready.resolve();await planning;
 assert.equal(ctx.trafficClock.timeS,28800);assert.equal(ctx.trafficClock.date,'2026-10-14');assert.equal(messages.length,1,'stale request exits before publishing or calculating with the new clock');
});
