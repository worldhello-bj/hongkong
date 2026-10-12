import test from'node:test';import assert from'node:assert/strict';import vm from'node:vm';import{readFileSync}from'node:fs';
const source=readFileSync(new URL('../../src/navigation/main.recovered.js',import.meta.url),'utf8');
const start=source.indexOf('async function n3('),end=source.indexOf('\nfunction ',start),code=source.slice(start,end);
for(const complete of [false,true])test(`actual taxi publisher counts usable first result only: complete=${complete}`,async()=>{
 const controller=new AbortController(),point={id:'a',name:'a',coordinates:[114.16,22.28]},ctx={console,AbortController,Number,JSON,Set,Map,performance:{now:()=>125},
 taxiCoverageMessage:'',t1:new Set(['taxi']),taxiPassengerPolicy:()=>({eligible:true}),ensureTaxi:async()=>({}),taxiModule:{ROAD_GRAPH:{},nearestRoadNode:()=>({coordinate:[114.16,22.28]})},y1:false,C:[],r:{},_:undefined,$:undefined,taxiOffers:[],
 annotateTaxiPassengerResult:x=>x,annotatePreferenceResult:x=>x,u2:(id,result)=>({id,result,available:!!result.journey?.complete}),rankJourneys:x=>x,deduplicateJourneys:x=>x,G:'time',routePerformance:{startedMonotonic:100,firstResultMs:null},x(){},B(){},Z(message){ctx.message=message},
 Q:{},I1:{},publicWalkLinks:{},L1:{},O2:[],z:null,createModeledConnectorGuard:()=>()=>true,
 planTaxiCandidates:async({publish})=>{publish('taxi-direct','taxi',{taxiQuote:{},journey:{complete}});return{status:'ready'}}};
 vm.createContext(ctx);vm.runInContext(code,ctx);await ctx.n3({origin:point,destination:{...point,id:'b'},departureS:0},controller.signal,{},{});
 assert.equal(ctx.routePerformance.firstResultMs,complete?25:null);assert.match(ctx.message,complete?/已找到可用方案/:/未完成接续/);
});

test('unverified endpoint access cannot reserve or start through a programmatic click',()=>{
 const start=source.indexOf('if(a==="start"&&$?.taxiQuote&&!$?.journey?.complete)'),end=source.indexOf('if(a==="start"&&$?.luggageCarryRequired',start);
 assert.ok(start>0&&end>start);const guard=new Function('a','$','Z',source.slice(start,end)+'return true;');let message='';assert.equal(guard('start',{taxiQuote:{},journey:{complete:false}},m=>message=m),undefined);assert.match(message,/未完成/);assert.equal(guard('start',{taxiQuote:{},journey:{complete:true}},()=>{}),true);
 assert.match(source,/if\(t\.dataset\.taxiReserve\)\{if\(!\$\?\.journey\?\.complete\)/);
});
