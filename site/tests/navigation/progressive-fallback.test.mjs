import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import{readFileSync}from'node:fs';
import{hasPublicAlternative}from'../../src/navigation/journey-score.js';
import{runBounded}from'../../src/navigation/integrated-navigation.js';
const source=readFileSync(new URL('../../src/navigation/main.recovered.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('async function S1() {'),source.indexOf('\nfunction ',source.indexOf('async function S1() {')));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
const tick=()=>new Promise(r=>setImmediate(r));
test('actual S1 publishes modeled route, defers heavy walk behind comparisons, and rejects cancelled refinements',async()=>{
 const walk=deferred(),detail=deferred(),calls=[];const router={dispose(){}};const fast={dispose(){}};
 const ok={journey:{complete:true,steps:[],graph:{edges:[]}},warnings:[],message:'modeled'};
 const ctx={console,performance,AbortController,Date,Number,Set,Map,Promise,
 r:{origin:{id:'a',name:'a',coordinates:[114.16,22.28]},destination:{id:'b',name:'b',coordinates:[114.17,22.28]},need:'ordinary'},
 publicDataReady:true,h1:0,y1:false,t1:new Set(),w1:'2026-10-11',c1:'08:00',PUBLIC_MODES:['metro','bus','tram'],L1:{edges:[],portals:[]},Q:{nodes:[],edges:[],closures:[]},z:null,O2:[],I1:{},publicWalkLinks:{},
 G:0,G1:null,d1:false,pendingDetailRefresh:false,$:undefined,C:[],_:undefined,taxiCoverageMessage:'',stationEntranceOptions:[],stationAlternativeLoading:false,routePerformance:{},routeResultCache:new Map(),stationAlternativeData:null,blockDataState:'ready',fastPublicRouter:fast,b2:router,window:{},history:{pushState(){}},writeAppHistory(){},hasPublicAlternative,createRoutingQueue:()=>({run:task=>task(),dispose(){}}),M1:0,T1:()=>({}),
 N(){},x(){},Z(){},B(){},t2:()=>({id:'ADM'}),rankJourneys:a=>a,deduplicateJourneys:a=>a,annotatePreferenceResult:a=>a,annotateStationDetour:(_,a)=>a,compatibleWithOverlay:()=>true,u2:(id,result)=>({id,result,available:!!result.journey?.complete}),disposeIdleWalkWorkers(){},E2:()=>({demo:true,dispose(){}}),annotateDemoFallback:a=>a.journey?.complete?a:null,runBounded,
 f2:async(req,L,Q,router)=>{if(req.mode==='walk'){calls.push('walk');return walk.promise}if(router.demo){calls.push('demo');return ok}if(router===fast){calls.push('fast');return{message:'missing access',warnings:[]}}calls.push('detail');return detail.promise},
 };
 ctx.u1=()=>{ctx.h1++;ctx.G1?.abort()};vm.createContext(ctx);vm.runInContext(code,ctx);const pending=ctx.S1();
 for(let i=0;i<8;i++)await tick();
 assert(!calls.includes('walk'),'heavy walk must not block pending public/taxi comparisons');assert(calls.includes('detail'));assert(calls.includes('demo'));assert(ctx.C.some(c=>c.available));assert(ctx._.available);assert.equal(ctx.$.message,'modeled');assert.equal(ctx.d1,true);
 const before=ctx.C.length;ctx.u1();walk.resolve({...ok,message:'stale walk'});detail.resolve({...ok,message:'stale detail'});await pending;
 assert(!calls.includes('walk'),'cancellation prevents deferred walk from starting');assert.equal(ctx.C.length,before);assert.equal(ctx.$.message,'modeled');assert(calls.indexOf('demo')<calls.indexOf('detail'));
});
