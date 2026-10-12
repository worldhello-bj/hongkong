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

test('exact XYZ source endpoints are preserved but cannot be certified by an XY curb scenario',()=>{
 const exact={...request,origin:{...request.origin,node_id:'source-origin',coordinates:[...request.origin.coordinates,6]},destination:{...request.destination,node_id:'source-destination',coordinates:[...request.destination.coordinates,13.8]}};
 const pick=modeledRoadLink(exact.origin,{id:'a',coordinate:roads.nodes.a}),drop=modeledRoadLink(exact.destination,{id:'b',coordinate:roads.nodes.b});
 const result=composeTaxiJourney({request:exact,quote,pickupLink:pick,dropoffLink:drop,scene,graph:{}});
 assert.deepEqual(result.lines[0].coordinates[0],exact.origin.coordinates);assert.deepEqual(result.lines.at(-1).coordinates.at(-1),exact.destination.coordinates);
 assert.equal(result.journey.complete,false);assert.equal(result.incompleteReason,'UNVERIFIED_ENDPOINT_ACCESS');assert.equal(result.endpointAccess.filter(p=>p.status==='unverified-node-or-floor').length,2);assert.ok(result.taxiQuote);assert.match(result.message,/保留原地点/);
});
test('a real public prefix preserves exact source-origin access; unverified named destination floor is still incomplete',()=>{
 const exact={...request,origin:{...request.origin,node_id:'source-origin',coordinates:[...request.origin.coordinates,6]}};
 const prefix={...emptyPublicJourney({},28800),journey:{complete:true,phases:['source walk'],steps:[{kind:'walk',phase:0,guidance:{edge_ids:['source-edge'],geometry_mode:'official',geometry:{type:'LineString',coordinates:[exact.origin.coordinates,pickupLink.node.coordinates]}}}],graph:{}}};
 const last=composeTaxiJourney({request:exact,prefix,quote,pickupLink,dropoffLink,scene,graph:{}});assert.equal(last.journey.complete,true);assert.equal(last.endpointAccess[0].status,'source-route');
 const floor={...exact,destination:{...exact.destination,namedPlaceId:'mall',floorId:'L4',floorName:'L4'}};
 const incomplete=composeTaxiJourney({request:floor,prefix,quote,pickupLink,dropoffLink,scene,graph:{}});assert.equal(incomplete.journey.complete,false);assert.equal(incomplete.endpointAccess[1].status,'unverified-node-or-floor');
});

test('explicit source-node group may resolve to one allowed node but never an unrelated node',()=>{
 const endpoint={...request.origin,node_ids:['allowed'],coordinates:[114.16,22.28,5]},chosen=[114.1601,22.2801,5],groupRequest={...request,origin:endpoint};
 const prefix={...emptyPublicJourney({},28800),journey:{complete:true,phases:['source walk'],steps:[{kind:'walk',phase:0,guidance:{edge_ids:['real'],geometry:{type:'LineString',coordinates:[chosen,pickupLink.node.coordinates]}}}],graph:{nodes:[{id:'allowed',coordinates:chosen}]}}};
 assert.equal(composeTaxiJourney({request:groupRequest,prefix,quote,pickupLink,dropoffLink,scene,graph:{}}).journey.complete,true);
 prefix.journey.graph.nodes[0].id='wrong';assert.equal(composeTaxiJourney({request:groupRequest,prefix,quote,pickupLink,dropoffLink,scene,graph:{}}).journey.complete,false);
});
