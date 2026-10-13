import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';
import {PACIFIC_PLACE_F,pacificPlaceFPortal,addPacificPlaceSourceAnchor,buildPacificPlaceModel,pacificPlaceModelSvg,createPacificPlaceModel,PACIFIC_PLACE_F_PLACE_ID} from '../../src/navigation/pacific-place-model.js';
const graph=JSON.parse(gunzipSync(readFileSync(new URL('../../dist/area/admiralty-block-graph.json.gz',import.meta.url))));
const model=buildPacificPlaceModel(graph);
test('five mall source levels, 5 existing lifts, and F approach render without fabricated LG2',()=>{
 assert.deepEqual(model.floors.map(f=>f.name),['LG1','L1','L2','L3','L4']);
 assert.equal(model.summary.lifts,5);assert.equal(model.summary.wheelchairEvidenceLifts,0);
 assert(model.summary.escalators>=10);assert.equal(model.floors[0].coverage,'partial');
 assert.equal(model.floors[0].edge_ids.length,3);assert.deepEqual(model.f_connection.coordinates,PACIFIC_PLACE_F.coordinates);
 const byId=new Map(graph.edges.map(e=>[e.id,e]));
 for(const edge of model.edges){const source=byId.get(edge.id);assert(source);assert.deepEqual(edge.coordinates,source.coordinates);assert.equal(edge.accessible_eligible,source.accessible_eligible);assert.equal(edge.duration_s,source.duration_s)}
 const svg=pacificPlaceModelSvg(model);assert.match(svg,/F 通道 \/ LG1/);assert.match(svg,/示意包络/);assert.doesNotMatch(svg,/NaN|Infinity|undefined/);
});
test('F source-anchor addition is immutable, idempotent and does not alter one route edge',()=>{
 const initial={...graph,portals:graph.portals.filter(p=>p.id!==PACIFIC_PLACE_F.id)},before=JSON.stringify(initial);
 const repaired=addPacificPlaceSourceAnchor(initial);assert.equal(JSON.stringify(initial),before);
 assert.equal(repaired.edges,initial.edges);assert.equal(repaired.nodes,initial.nodes);assert.equal(repaired.places.find(p=>p.id==='tamar-park'),initial.places.find(p=>p.id==='tamar-park'));assert.equal(repaired.places.find(p=>p.id==='pacific-place').alternative_place_ids[0],PACIFIC_PLACE_F_PLACE_ID);
 assert.equal(repaired.portals.length,initial.portals.length+1);assert.equal(addPacificPlaceSourceAnchor(repaired),repaired);
 const portal=repaired.portals.at(-1);assert.equal(portal.offset_m,0);assert.equal(portal.access_schedule,null);
 assert(!initial.places[0].entrance_ids.includes(portal.id),'F external passage point is not silently a mall-arrival interior');
});
test('missing evidence, mismatched elevation and source closure prevent new F anchor',()=>{
 for(const damaged of [
  {...graph,nodes:graph.nodes.filter(n=>n.id!==PACIFIC_PLACE_F.node_id)},
  {...graph,nodes:graph.nodes.map(n=>n.id===PACIFIC_PLACE_F.node_id?{...n,coordinates:[...n.coordinates.slice(0,2),0]}:n)},
  {...graph,edges:graph.edges.filter(e=>e.physical_id!==PACIFIC_PLACE_F.physical_ids[0])},
  {...graph,closures:[...graph.closures,{physical_ids:[PACIFIC_PLACE_F.physical_ids[0]]}]}
 ])assert.equal(pacificPlaceFPortal(damaged),null);
});
test('closed Three Pacific Place tunnel is excluded from displayed navigable subset',()=>{
 const closed=new Set(graph.closures.flatMap(c=>c.physical_ids));assert(closed.size>0);
 assert(model.edges.every(e=>!closed.has(e.physical_id)));assert(!closed.has('ADM:P:250019621'));
});
test('per-floor model keeps finite source elevations and LG1 F context',()=>{
 for(const floor of model.floors){const svg=pacificPlaceModelSvg(model,{floor:floor.name,angle:1.3,exploded:false});assert.doesNotMatch(svg,/NaN|Infinity|undefined/);assert(svg.length>1000)}
});

test('floor choice names the requested endpoint, only acts on explicit selection, and disposes cleanly',()=>{
 const listeners=new Map(),host={innerHTML:'',addEventListener:(type,fn)=>listeners.set(type,fn)};let selected;
 const view=createPacificPlaceModel(host,model,{targetLabel:'起点',onSelectFloor:floor=>{selected=floor}});
 assert.equal(selected,undefined);listeners.get('change')({target:{matches:()=>true,value:'LG1'}});assert.match(host.innerHTML,/选择太古广场 LG1 为起点/);assert.equal(selected,undefined);
 listeners.get('click')({target:{closest:()=>({dataset:{ppAction:'select-floor'}})}});assert.equal(selected.name,'LG1');view.dispose();assert.equal(host.innerHTML,'');
});
