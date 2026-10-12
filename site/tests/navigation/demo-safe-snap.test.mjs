import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
import{compatibleWithOverlay,createModeledConnectorGuard}from'../../src/navigation/integrated-navigation.js';
globalThis.document={createElement:()=>({relList:{supports:()=>true}})};
const version=JSON.parse(readFileSync(new URL('../../dist/build-meta.json',import.meta.url))).version;
const{d:route,p:prepare}=await import(new URL('../../dist/assets/mobile-navigation-DfEsS_7b.js',import.meta.url).href+'?v='+version);
test('actual engine chooses a land-safe snap and preserves original coordinates and access time',()=>{
 const coord=(x,y)=>[114.165+x/102900,22.279-y/111320];const geography=[{kind:'land',d:'M-100,-100L100,-100L100,100L-100,100Z'},{kind:'water',d:'M10,-10L20,-10L20,10L10,10Z'}];
 const points={near:coord(30,0),corner:coord(30,50),safe:coord(0,50)};
 const edges=[['near','corner'],['corner','safe']].flatMap(([a,b],i)=>[[a,b],[b,a]].map(([from,to],j)=>({id:`e${i}:${j}`,physical_id:'e'+i,from_id:from,to_id:to,region_id:'R',kind:'walk',location:1,name:'test',disabled:false,source_id:'TEST',coordinates:[points[from],points[to]],length_m:i?30:50,duration_s:i?25:50/1.2,geometry_mode:'official',snap_eligible:true,accessible_eligible:true,wheelchair_barrier:2})));
 const graph={regions:[{id:'R',center:coord(0,0),radius_m:1000}],nodes:Object.entries(points).map(([id,coordinates])=>({id,coordinates,region_id:'R'})),edges,portals:[{id:'target',node_id:'corner',region_id:'R',coordinates:points.corner}]};
 const origin=coord(0,0),request={origin:{lon:origin[0],lat:origin[1]},destination:{lon:points.corner[0],lat:points.corner[1],node_id:'corner'},preference:'fast',mode:'walk'};
 const old=route(prepare(graph),request),result=route(prepare({...graph,demo_connector_geography:geography}),request),allow=createModeledConnectorGuard({geography});
 assert.equal(result.status,'CONDITIONAL',result.message);assert.equal(allow(origin,old.snapped_origin.coordinates),false);assert.equal(allow(origin,result.snapped_origin.coordinates),true);
 assert.deepEqual(result.origin.coordinates,origin);assert.ok(result.legs[0].minutes>0);assert.ok(result.legs[0].distance_m>=49);
});
test('removed authoritative overlay edges cannot be accepted from a base graph',()=>{
 const base={edges:[{id:'e',physical_id:'physical'}]},overlay={edges:[],authoritative_physical_ids:['physical']};
 const result={journey:{complete:true,steps:[{guidance:{edge_ids:['e:split:1']}}]}};
 assert.equal(compatibleWithOverlay(result,base,overlay),false);
 assert.equal(compatibleWithOverlay(result,base,{edges:[]}),true);
 assert.equal(compatibleWithOverlay(result,base,{edges:[{id:'e',physical_id:'physical',disabled:true}]}),false);
});
