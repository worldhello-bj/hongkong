import test from'node:test';import assert from'node:assert/strict';globalThis.document={createElement:()=>({relList:{supports:()=>true}})};
const after=await import('../../dist/assets/mobile-navigation-DfEsS_7b.js');
const coord=(x,y,z)=>[114.165+x/102900,22.279-y/111320,z];
function fixture(){const p={low:coord(30,0,0),lowEnd:coord(30,40,0),high:coord(40,0,10),target:coord(30,40,10)};
 const edges=[['low','lowEnd','walk',40,40/1.2],['high','target','walk',Math.hypot(10,40),Math.hypot(10,40)/1.2],['lowEnd','target','lift',10,20]].flatMap(([a,b,kind,length,duration],i)=>[[a,b],[b,a]].map(([from,to],j)=>({id:`edge${i}:${j}`,physical_id:'edge'+i,from_id:from,to_id:to,region_id:'R',kind,name:kind,length_m:length,duration_s:duration,coordinates:[p[from],p[to]],geometry_mode:'official',snap_eligible:kind==='walk',accessible_eligible:true,wheelchair_barrier:2,location:1,disabled:false,source_id:'TEST',...(kind==='lift'?{lift_ride_id:'known-lift',lift_wait_s:10}:{})})));
 const graph={regions:[{id:'R',center:coord(0,0,10),radius_m:1000}],nodes:Object.entries(p).map(([id,coordinates])=>({id,coordinates,region_id:'R'})),edges,portals:[{id:'target',node_id:'target',region_id:'R',coordinates:p.target}],demo_connector_geography:[{kind:'land',d:'M-100,-100L100,-100L100,100L-100,100Z'},{kind:'water',d:'M-90,-90L-80,-90L-80,-80L-90,-80Z'}]};
 const origin=coord(0,0,10),request={origin:{lon:origin[0],lat:origin[1],level:'G',demoSourceCoordinates:origin},destination:{lon:p.target[0],lat:p.target[1],node_id:'target'},mode:'walk',preference:'fast'};return{graph,request};}
test('farther same-height snap replaces nearer wrong-height snap without moving original G-labelled source',()=>{
 const{graph,request}=fixture(),b=after.d(after.p(graph),request);assert.equal(b.status,'CONDITIONAL',b.message);
 assert.equal(b.snapped_origin.coordinates[2],10);assert.deepEqual(request.origin.demoSourceCoordinates,coord(0,0,10));assert.deepEqual(b.origin.coordinates,coord(0,0,10).slice(0,2));
 assert.ok(b.legs[0].distance_m>30);assert.ok(b.legs[0].minutes>0);assert.ok(Math.abs(b.legs[0].minutes-b.legs[0].distance_m/72)<1e-5);assert.equal(b.legs[0].geometry_mode,'schematic');assert.equal(b.legs[0].access_evidence,'UNVERIFIED');
 for(const leg of b.legs.filter(l=>l.kind!=='access_connector'))assert.ok(leg.edge_ids.every(id=>graph.edges.some(e=>e.id===id)), 'subsequent path must use real graph edges');
});
test('absence of same-height approach does not turn G into elevation zero or invent a lift',()=>{
 const{graph,request}=fixture();graph.edges=graph.edges.filter(e=>e.physical_id!=='edge1');const r=after.d(after.p(graph),request);assert.equal(r.status,'NO_ROUTE');
});

import {addShortDemoConnectors} from '../../src/navigation/integrated-navigation.js';
test('modeled connector guidance preserves known source XYZ without changing arrival time',()=>{
 const origin=[114.18129084,22.30216345,13.8],target=[114.1824458,22.30245769,13.654];
 const journey={complete:false,steps:[{blocked:true,guidance:{leg_index:0}}]},route={legs:[{kind:'access_connector',distance_m:123.241,minutes:1.711681}],total_minutes:1.711681};
 const request={need:'ordinary',origin:{coordinates:origin.slice(0,2),demoSourceCoordinates:origin},destination:{coordinates:target}};
 assert.equal(addShortDemoConnectors(journey,route,request,{isConnectorAllowed:()=>true}),true);
 assert.deepEqual(journey.steps[0].guidance.geometry.coordinates,[origin,target]);assert.equal(route.total_minutes,1.711681);
});
