import test from 'node:test';
import assert from 'node:assert/strict';
import {rankJourneys} from '../../src/navigation/integrated-navigation.js';
import {journeyScore,hasPublicAlternative,JOURNEY_WEIGHTS} from '../../src/navigation/journey-score.js';
import {taxiInterchangeCandidates,planTaxiCandidates} from '../../src/navigation/taxi-candidates.js';
import {simulatedTaxiFareCents} from '../../src/navigation/route-quote.js';
const choice=(id,minutes,cost,walkMinutes,transfers,waitMinutes=0)=>({id,available:true,minutes,cost,walkMinutes,transfers,result:{waitMinutes,segments:[]}});
const controls=[choice('public',62,13,12,1,6),choice('direct',25,110,2,0,4),choice('feeder',35,46,4,1,3)];
test('same OD has a genuine weighted middle ground without forcing taxi',()=>{
 assert.equal(rankJourneys(controls,'time')[0].id,'feeder');
 assert.equal(rankJourneys(controls,'cost')[0].id,'public');
 assert.equal(rankJourneys(controls.map(c=>c.id==='direct'?{...c,cost:30}:c),'time')[0].id,'direct');
 assert.equal(rankJourneys([choice('walk',7,0,7,0),...controls],'time')[0].id,'walk');
});
test('price sensitivity is monotonic, stable and independent of dominated outliers',()=>{
 const route=controls[2],baseline=journeyScore(route).total;
 for(const delta of [0,10,20,40])assert.ok(Math.abs(journeyScore({...route,cost:route.cost+delta}).total-(baseline+delta*JOURNEY_WEIGHTS.time.cost))<1e-9);
 const before=rankJourneys(controls).map(c=>c.id);const after=rankJourneys([...controls,choice('outlier',500,500,100,10)]).filter(c=>c.id!=='outlier').map(c=>c.id);assert.deepEqual(after,before);
 assert.equal(rankJourneys(controls.map(c=>c.id==='feeder'?{...c,cost:100}:c))[0].id,'public');
});
test('wait burden adds no clock time and unknown fares never look free',()=>{
 const low=choice('low',40,20,3,1,2),high=choice('high',40,20,3,1,12);
 assert.equal(journeyScore(high).total-journeyScore(low).total,5);assert.equal(high.minutes,40);
 assert.equal(journeyScore({...low,cost:Infinity}).total,Infinity);
 assert.equal(hasPublicAlternative([{...controls[1],result:{taxiQuote:{}}}]),false);
 assert.equal(hasPublicAlternative(controls),true);
});
test('same pricing model includes distance and declared cross-harbour assumption',()=>{
 assert.equal(simulatedTaxiFareCents({distanceM:1000}),2900);assert.equal(simulatedTaxiFareCents({distanceM:3000}),3700);
 assert.equal(simulatedTaxiFareCents({distanceM:3000,harbourTunnel:true}),6200);
});
const p=(id,x,y=22.28)=>({id,name:id,coordinates:[x,y],lon:x,lat:y});
const request={origin:p('origin',114.15),destination:p('destination',114.19),departureS:28800};
const station={portals:[{...p('M:portal:A',114.16),region_id:'M',node_id:'M:a'}]};
const services={stops:[p('b0',114.155),p('b1',114.178),p('t0',114.153),p('t1',114.183)],patterns:[{mode:'bus',stops:[{stopId:'b0'},{stopId:'b1'}]},{mode:'tram',stops:[{stopId:'t0'},{stopId:'t1'}]}]};
test('shortlist includes real bus and tram stops with directional boarding/alighting',()=>{
 const first=taxiInterchangeCandidates({station,services,request,side:'first'}),last=taxiInterchangeCandidates({station,services,request,side:'last'});
 assert.deepEqual(first.map(c=>c.mode).sort(),['bus','metro','tram']);assert.ok(first.some(c=>c.id==='b0'));assert.ok(last.some(c=>c.id==='b1'));assert.ok(last.some(c=>c.id==='t1'));
 assert.equal(first.some(c=>c.id==='b1'),false);assert.equal(last.some(c=>c.id==='b0'),false);
});
test('planner composes first and last mile at actual arrival clocks and keeps direct candidate',async()=>{
 const emitted=[],queries=[];
 const findRoad=point=>({id:point.id,coordinate:point.coordinates});
 const ask=(pickup,destination,ready)=>({carId:'DEMO',passengerReadyS:ready,passengerWaitS:60,dropoffS:ready+360,passengerRoute:{durationS:300,lengthM:pickup.id==='origin'&&destination.id==='destination'?5000:1000,geometry:[pickup.coordinate,destination.coordinate]}});
 const publicRoute=async(origin,destination,departureS,mode)=>{queries.push({origin,destination,departureS,mode});return {arrivalS:departureS+1200,totalMinutes:20,walkMinutes:2,waitMinutes:3,transfers:0,warnings:[],lines:[],segments:[{kind:mode,minutes:17,label:mode,distanceM:2500}],journey:{complete:true,phases:[mode],steps:[],graph:{}}};};
 const result=await planTaxiCandidates({request,station,services,graph:{},findRoad,ask,publicRoute,publish:(id,title,result)=>emitted.push({id,title,result})});
 assert.equal(result.status,'ready');assert.equal(emitted.length,7);assert.ok(emitted.some(c=>c.result.taxiCandidateKind==='direct'));
 for(const candidate of emitted){if(candidate.result.taxiCandidateKind==='last')assert.equal(candidate.result.taxiQuote.passengerReadyS,request.departureS+1200);if(candidate.result.taxiCandidateKind!=='direct')assert.equal(candidate.result.waitMinutes,4);}
 assert.ok(queries.filter(q=>q.origin.id!=='origin').every(q=>q.departureS===request.departureS+360));
 assert.ok(emitted.some(c=>c.title.includes('公交')));assert.ok(emitted.some(c=>c.title.includes('电车')));
});
test('unsafe road links and cancelled computation never emit phantom routes',async()=>{
 let count=0;const common={request,station,services,graph:{},findRoad:p=>({id:p.id,coordinate:p.coordinates}),ask:()=>{throw Error('should not run')},publicRoute:()=>{throw Error('should not run')},publish:()=>count++};
 const result=await planTaxiCandidates({...common,isLinkAllowed:()=>false});assert.equal(result.status,'unsafe-road-connector');assert.equal(count,0);
});

import {limitedRailReference} from '../../src/navigation/rail-reference.js';
test('unmodeled Tsuen Wan line is a contextual reference, never a made-up navigable connection',()=>{
 const request={origin:{coordinates:[114.1648,22.279]},destination:{coordinates:[114.1692,22.3193]}};
 assert.match(limitedRailReference(request),/10 分钟/);assert.match(limitedRailReference(request),/不能代表全网最优/);
 assert.match(limitedRailReference({origin:request.destination,destination:request.origin}),/o=6&d=2/);
 assert.equal(limitedRailReference({origin:request.origin,destination:{coordinates:[114.166,22.305]}}),'');
});


test('luggage carrying is explicitly confirmed before any taxi reservation or navigation',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../../src/navigation/main.recovered.js',import.meta.url),'utf8');
 const start=source.indexOf('if(a==="start"&&$?.luggageCarryRequired');
 const reserve=source.indexOf('if(a==="start"&&$?.taxiQuote&&taxiSimulation');
 assert.ok(start>0&&start<reserve);assert.match(source,/确认搬运行李并查看路线/);
 const guard=new Function('a','$','window',source.slice(start,reserve)+'return true;');
 let asked=0;assert.equal(guard('start',{luggageCarryRequired:true},{confirm:()=>{asked++;return false;}}),undefined);assert.equal(asked,1);
 assert.equal(guard('start',{luggageCarryRequired:true},{confirm:()=>true}),true);
 assert.equal(guard('start',{}, {confirm:()=>{throw Error('unexpected prompt')}}),true);
});
