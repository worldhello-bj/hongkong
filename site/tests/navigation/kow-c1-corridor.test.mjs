import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{addKowloonModeledCorridor,corridorGeometryAllowed}from'../../src/navigation/kow-c1-corridor.js';import{KOW_C1_CORRIDOR as D}from'../../src/navigation/kow-c1-corridor-data.js';import{createDemoAccessibilityGraph,annotateDemoFallback}from'../../src/navigation/demo-fallback.js';import{addShortDemoConnectors}from'../../src/navigation/integrated-navigation.js';
globalThis.document={createElement:()=>({relList:{supports:()=>true}})};const engine=await import('../../dist/assets/mobile-navigation-DfEsS_7b.js');
const fixture=()=>JSON.parse(readFileSync(new URL('./fixtures/kow-c1-corridor-small.json',import.meta.url)));
test('75m modeled bend preserves source XYZ and does not touch known stairs/escalators',()=>{
 assert(corridorGeometryAllowed(D.coordinates,fixture()));const graph=fixture(),json=JSON.stringify(graph),demo=addKowloonModeledCorridor(createDemoAccessibilityGraph(graph),graph);
 assert.equal(JSON.stringify(graph),json);assert.equal(demo.edges.length,graph.edges.length+2);const edge=demo.edges.at(-2);assert.equal(edge.accessible_eligible,false);assert.equal(edge.geometry_mode,'schematic');assert.match(edge.name,/模型接驳待确认/);assert.equal(edge.length_m,D.lengthM);assert.equal(edge.duration_s,D.lengthM/1.2);assert(edge.coordinates.every(p=>p[2]===13.5));assert.deepEqual(edge.coordinates,D.coordinates);
 assert.equal(corridorGeometryAllowed([[114.16197172,22.30465491,13.5],[114.16176439,22.30482661,13.5]],graph),false,'nearest chord crosses known escalator');
});
test('wrong elevation, missing source anchors, and a new crossing closure cannot create a modeled connection',()=>{
 const graph=fixture();assert.equal(corridorGeometryAllowed(D.coordinates.map((p,i)=>i===1?[p[0],p[1],0]:p),graph),false);
 const missing={...graph,nodes:graph.nodes.filter(n=>n.id!==D.toId)};assert.equal(addKowloonModeledCorridor(missing),missing);
 const p=D.coordinates[1];const edge={id:'closed',physical_id:'closed',coordinates:[[p[0]-.00001,p[1]-.0001,13.5],[p[0]+.00001,p[1]+.0001,13.5]],disabled:true};const closed={...graph,edges:[...graph.edges,edge]};assert.equal(addKowloonModeledCorridor(createDemoAccessibilityGraph(closed),closed).modeled_corridors,undefined);
});
test('actual small source path retains original C1, follows full modeled bends then real lift; strict graph remains blocked',()=>{
 const graph=fixture(),demo=addKowloonModeledCorridor(createDemoAccessibilityGraph(graph),graph),origin=graph.nodes.find(n=>n.id==='KOW:N:80bd652ff86c03'),destination=graph.nodes.find(n=>n.id==='KOW:N:a257d4094aed13');
 const request={origin:{node_id:origin.id,coordinates:origin.coordinates,lon:origin.coordinates[0],lat:origin.coordinates[1]},destination:{node_id:destination.id,coordinates:destination.coordinates,lon:destination.coordinates[0],lat:destination.coordinates[1]},mode:'walk',preference:'fast'};
 const raw=engine.d(engine.p(demo),request);assert.equal(raw.status,'CONDITIONAL',raw.message);assert.deepEqual(raw.snapped_origin.coordinates,origin.coordinates);assert(raw.legs.some(l=>l.kind==='lift'));
 const journey=engine.a(demo,raw,'C1 lift');assert(addShortDemoConnectors(journey,raw,{...request,need:'ordinary'},{isConnectorAllowed:()=>true}));
 const step=journey.steps.find(s=>s.guidance?.edge_ids?.includes('DEMO:KOW:C1:U3:CORRIDOR'));assert.deepEqual(step.guidance.geometry.coordinates,D.coordinates);assert(Math.abs(step.guidance.minutes-D.lengthM/72)<1e-5);assert.match(step.guidance.instruction,/75 米/);
 const result=annotateDemoFallback({journey,segments:[],warnings:[]},{need:'accessible'});assert(result);assert.equal(result.accessibilityVerified,false);assert.equal(result.needsFacilityConfirmation,true);
 const strict=engine.d(engine.p(graph),{...request,preference:'accessible'});assert.equal(strict.status,'NO_ROUTE');
});

test('overhead source stairs do not block same-level corridor but same-height crossing does',()=>{
 const a=D.coordinates[2],b=D.coordinates[3],p=[(a[0]+b[0])/2,(a[1]+b[1])/2];
 const base={physical_id:'overhead',wheelchair_barrier:1,kind:'stairs',coordinates:[[p[0]-.0001,p[1],21],[p[0]+.0001,p[1],23.5]]};
 assert(corridorGeometryAllowed(D.coordinates,{edges:[base]}));
 assert.equal(corridorGeometryAllowed(D.coordinates,{edges:[{...base,coordinates:base.coordinates.map(c=>c.slice(0,2))}]}),false,'missing barrier Z cannot mean no collision');
 assert.equal(corridorGeometryAllowed(D.coordinates,{edges:[{...base,coordinates:base.coordinates.map(c=>[c[0],c[1],13.5])}]}),false);
});
