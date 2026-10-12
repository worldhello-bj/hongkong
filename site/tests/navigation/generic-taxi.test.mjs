import test from 'node:test';
import assert from 'node:assert/strict';
import {nearestRoadPoint,modeledRoadLink,nearestInterchanges,composeTaxiJourney,emptyPublicJourney} from '../../src/navigation/taxi-bridge.js';
const roads={nodes:{a:[114.16,22.28],b:[114.17,22.31]}};
const point=(id,name,c)=>({id,name,coordinates:c,lon:c[0],lat:c[1]});
test('generic map-picked endpoints allow modeled gaps over40m and keep original selection',()=>{
 const input=point('map:123','地图所选地点',[114.1608,22.28]),snapshot=structuredClone(input);
 const snap=nearestRoadPoint(roads,input);assert.equal(snap.id,'a');assert.ok(snap.distanceM>40);
 const link=modeledRoadLink(input,snap);assert.deepEqual(input,snapshot);assert.deepEqual(link.geometry[0],input.coordinates);assert.ok(link.durationS>0);
 assert.equal(nearestRoadPoint(roads,[115,23]),null);
});
test('interchange shortlist bounded, prefers modeled exits, excludes platform targets',()=>{
 const station={portals:[{id:'ADM:portal:E1',region_id:'ADM',coordinates:[114.16,22.28],node_id:'n1',name:'E1'},{id:'ADM:portal:E2',region_id:'ADM',coordinates:[114.161,22.28],node_id:'n2',name:'E2'},{id:'AUS:portal:B2',region_id:'AUS',coordinates:[114.165,22.305],node_id:'n3',name:'B2'},{id:'AUS:platform-area:P',region_id:'AUS',coordinates:[114.165,22.305],node_id:'n4',name:'P'}]};
 const candidates=nearestInterchanges(station,point('o','起点',[114.16,22.28]),1);assert.equal(candidates.length,1);assert.equal(candidates[0].id,'ADM:portal:E2');
});
const request={origin:point('o','中环',[114.1608,22.28]),destination:point('d','旺角',[114.1706,22.31]),departureS:28800};
const pickupLink=modeledRoadLink(request.origin,{id:'a',coordinate:roads.nodes.a}),dropoffLink=modeledRoadLink(request.destination,{id:'b',coordinate:roads.nodes.b});
const quote={carId:'DEMO-1',passengerWaitS:60,dropoffS:29400,passengerRoute:{durationS:400,lengthM:7000,geometry:[roads.nodes.a,[114.163,22.29],roads.nodes.b]}};
const scene={pickup:{coordinate:roads.nodes.a},destination:{coordinate:roads.nodes.b,name:'旺角'},disclaimer:'演示数据'};
test('direct taxi includes both endpoint walking connectors, full time and destination name',()=>{
 const result=composeTaxiJourney({request,quote,pickupLink,dropoffLink,scene,graph:{}});
 assert.deepEqual(result.segments.map(s=>s.kind),['walk','wait','taxi','walk']);
 assert.equal(result.journey.destination,'旺角');assert.match(result.segments.at(-1).label,/旺角/);
 assert.ok(result.totalMinutes>=11);assert.equal(result.transfers,0);
 assert.deepEqual(result.lines.at(-1).coordinates.at(-1),request.destination.coordinates);
});
test('taxi can be first or last leg, with public journey phase indices preserved',()=>{
 const publicLeg={...emptyPublicJourney({},29430),totalMinutes:20,walkMinutes:2,segments:[{kind:'metro',label:'地铁',minutes:20}],lines:[],journey:{graph:{},phases:['地铁'],steps:[{kind:'rail',phase:0,guidance:{minutes:20}}],complete:true}};
 const first=composeTaxiJourney({request,prefix:emptyPublicJourney({},28800),suffix:publicLeg,quote,pickupLink,dropoffLink,scene,graph:{}});
 assert.equal(first.journey.steps.at(-1).phase,first.journey.phases.length-1);assert.equal(first.transfers,1);assert.ok(first.totalMinutes>30);
 const last=composeTaxiJourney({request,prefix:publicLeg,quote,pickupLink,dropoffLink,scene,graph:{}});
 assert.equal(last.segments[0].kind,'metro');assert.equal(last.segments.at(-2).kind,'taxi');assert.equal(last.transfers,1);
});
test('routing branches stay bounded while completed work releases next branch',async()=>{
 const {runBounded}=await import('../../src/navigation/integrated-navigation.js');let active=0,max=0;
 const tasks=Array.from({length:5},(_,i)=>async()=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,5));active--;return i});
 const results=await runBounded(tasks,2);assert.equal(max,2);assert.equal(active,0);assert.deepEqual(results.map(r=>r.value),[0,1,2,3,4]);
});
