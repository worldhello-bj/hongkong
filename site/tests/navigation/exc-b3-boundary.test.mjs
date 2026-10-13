import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {augmentExcB3,EVIDENCE,readOfficialEvidence,rebaseExcWalkLinks} from '../../scripts/augment-exc-b3.mjs';
import {canonicalStationEndpoint,stationOutdoorCandidates} from '../../src/navigation/station-identity.js';
import {exactSourceRegion} from '../../src/navigation/endpoint-region.js';
const read=file=>JSON.parse(gunzipSync(readFileSync(new URL('../../dist/area/'+file+'-graph.json.gz',import.meta.url))));
const loaded=read('area'),station=read('station'),[indoor,outdoor]=readOfficialEvidence();
const base=loaded.exc_b3_exact_boundary_join?{...loaded,version:loaded.exc_b3_exact_boundary_join.source_area_version,nodes:loaded.nodes.filter(n=>n.source_region_id!=='EXC'),edges:loaded.edges.filter(e=>e.source_region_id!=='EXC'),portals:loaded.portals.filter(p=>p.source_region_id!=='EXC'),exc_b3_exact_boundary_join:undefined}:loaded;
const graph=augmentExcB3(base,station,indoor,outdoor),imported=graph.edges.filter(e=>e.source_region_id==='EXC');
const change=(collection,id,fn)=>collection.map(x=>x.id===id?fn(structuredClone(x)):x);
function physicalPath(g,start,goal){const adj=new Map();for(const e of g.edges){if(e.disabled||e.location===3||['rail','transfer','station_access','access_connector'].includes(e.kind))continue;const es=adj.get(e.from_id)??[];es.push(e);adj.set(e.from_id,es);}const q=[start],prev=new Map([[start,null]]);for(const n of q){if(n===goal)break;for(const e of adj.get(n)??[])if(!prev.has(e.to_id)){prev.set(e.to_id,e);q.push(e.to_id);}}if(!prev.has(goal))return null;const result=[];for(let n=goal;n!==start;){const e=prev.get(n);result.push(e);n=e.from_id;}return result.reverse();}

test('EXC importer adds exactly two source nodes, four directed edges and the original B3 portal',()=>{
 assert.equal(graph.nodes.length-base.nodes.length,2);assert.equal(graph.edges.length-base.edges.length,4);assert.equal(graph.portals.length-base.portals.length,1);
 assert.deepEqual(graph.nodes.slice(0,base.nodes.length),base.nodes);assert.deepEqual(graph.edges.slice(0,base.edges.length),base.edges);assert.deepEqual(graph.portals.slice(0,base.portals.length),base.portals);
 assert.ok(imported.every(e=>e.location===2&&e.kind==='walk'&&e.geometry_mode==='official'&&!e.disabled));
 for(const e of imported){const original=station.edges.find(x=>x.id===e.id);assert.deepEqual(e,{...original,region_id:'ADM',source_region_id:'EXC',from_id:original.from_id===EVIDENCE.boundaryStation?EVIDENCE.boundaryArea:original.from_id,to_id:original.to_id===EVIDENCE.boundaryStation?EVIDENCE.boundaryArea:original.to_id});}
 assert.deepEqual(graph.portals.at(-1),{...station.portals.find(p=>p.id==='EXC:portal:B3'),region_id:'ADM',source_region_id:'EXC'});
 assert.equal(augmentExcB3(graph,station,indoor,outdoor),graph);
});
test('import retains the surveyed 1.6 m change, including intermediate XYZ',()=>{
 const e=imported.find(e=>e.id==='EXC:I:1000805010');assert.equal(e.coordinates.length,3);assert.ok(Math.abs(e.coordinates[0][2]-e.coordinates.at(-1)[2]-1.6)<1e-12);
 assert.deepEqual(e.coordinates,station.edges.find(x=>x.id===e.id).coordinates);
});
test('physical directed paths close B3 to C1 and back, with original B3 endpoint',()=>{
 const forward=physicalPath(graph,EVIDENCE.endpoint,'ADM:N:31b17842679990'),reverse=physicalPath(graph,'ADM:N:31b17842679990',EVIDENCE.endpoint);
 assert.ok(forward&&reverse);assert.deepEqual(forward.slice(0,3).map(e=>e.id),['EXC:I:1001097474:r','EXC:I:1000805010','ADM:P:290046359:r']);assert.deepEqual(reverse.slice(-3).map(e=>e.id),['ADM:P:290046359','EXC:I:1000805010:r','EXC:I:1001097474']);
 assert.ok([...forward,...reverse].every(e=>e.geometry_mode==='official'&&e.location!==3));
});
test('overlapping station regions cannot steal the exact imported area identity',()=>{
 const p=graph.portals.at(-1),overlap={...graph,regions:[...station.regions,...graph.regions]};
 assert.equal(exactSourceRegion(overlap,p).region.id,'ADM');assert.equal(exactSourceRegion(overlap,{...p,coordinates:[...p.coordinates.slice(0,2),0]}).region,undefined);
});
test('changed official indoor geometry, source restrictions or floor fail closed',()=>{
 const mutations=[f=>f.geometry.coordinates.at(-1)[2]+=.001,f=>f.properties.Direction=1,f=>f.properties.Location=3,f=>f.properties.Enabled=2,f=>f.properties.AccessTimeID=123,f=>f.properties.FloorID=1009970000,f=>f.properties.WheelchairBarrier=1,f=>f.properties.Gradient=0];
 for(const fn of mutations){const raw=structuredClone(indoor);fn(raw.features.find(f=>f.properties.PedestrianRouteID===1000805010));assert.throws(()=>augmentExcB3(base,station,raw,outdoor));}
});
test('outdoor source direction, opening, paid status, enabled or XYZ drift fails closed',()=>{
 const mutations=[f=>f.geometry.coordinates.at(-1)[2]+=.001,f=>f.properties.Direction=1,f=>f.properties.Location=3,f=>f.properties.Enabled=2,f=>f.properties.AccessTimeID=123];
 for(const fn of mutations){const raw=structuredClone(outdoor);fn(raw.features[0]);assert.throws(()=>augmentExcB3(base,station,indoor,raw));}
});
test('station closures, area closures, disabled edges and source schedules are never discarded',()=>{
 const physical_id='EXC:I:1000805010';
 for(const target of ['station','area']){const closure={physical_ids:[physical_id]};assert.throws(()=>augmentExcB3(target==='area'?{...base,closures:[...(base.closures??[]),closure]}:base,target==='station'?{...station,closures:[...(station.closures??[]),closure]}:station,indoor,outdoor));}
 for(const fn of [e=>({...e,disabled:true}),e=>({...e,access_time_id:123,access_schedule:{kind:'daily',windows:[]}})])assert.throws(()=>augmentExcB3(base,{...station,edges:change(station.edges,physical_id,fn)},indoor,outdoor));
});
test('marker does not bypass validation; partial imports and altered imported records fail closed',()=>{
 assert.throws(()=>augmentExcB3({...base,nodes:[...base.nodes,graph.nodes.at(-1)]},station,indoor,outdoor));
 assert.throws(()=>augmentExcB3({...graph,edges:change(graph.edges,'EXC:I:1000805010',e=>({...e,disabled:true}))},station,indoor,outdoor));
 assert.throws(()=>augmentExcB3({...graph,portals:change(graph.portals,'EXC:portal:B3',p=>({...p,node_id:EVIDENCE.boundaryArea}))},station,indoor,outdoor));
 assert.throws(()=>augmentExcB3({...graph,exc_b3_exact_boundary_join:{...graph.exc_b3_exact_boundary_join,added_directed_edges:6}},station,indoor,outdoor));
});
test('AUS F island and all unrelated source records stay unchanged',()=>{
 assert.equal(physicalPath(graph,'AUS:N:7144fc7f1bf80b','AUS:N:4ab0a937f564e0'),null);
 for(const collection of ['nodes','edges','portals'])assert.deepEqual(graph[collection].filter(r=>r.id.startsWith('AUS:')),base[collection].filter(r=>r.id.startsWith('AUS:')));
 assert.deepEqual(graph.closures,base.closures);assert.deepEqual(graph.regions,base.regions);
});

globalThis.document={createElement:()=>({relList:{supports:()=>true}})};
const {p:prepare,d:route}=await import('../../dist/assets/mobile-navigation-DfEsS_7b.js');
const outdoorEnd='ADM:N:31b17842679990',local=graph;
const point=id=>{const n=local.nodes.find(n=>n.id===id);return {node_id:id,coordinates:n.coordinates,lon:n.coordinates[0],lat:n.coordinates[1]}};
const request=(reverse=false)=>({origin:point(reverse?outdoorEnd:EVIDENCE.endpoint),destination:point(reverse?EVIDENCE.endpoint:outdoorEnd),preference:'fast',mode:'walk',departureDate:'2026-10-13',departureS:28800});
test('production routing obeys exact B3 geometry in both directions',()=>{for(const reverse of [false,true]){const r=route(prepare(local),request(reverse));assert.equal(r.status,'CONDITIONAL',r.message);assert.deepEqual(r.snapped_origin.coordinates,request(reverse).origin.coordinates);assert.deepEqual(r.snapped_destination.coordinates,request(reverse).destination.coordinates);assert.ok(r.legs.every(l=>l.geometry_mode==='official'));}});
test('production traversal retains one-way, disabled and closed-hour restrictions',()=>{
 const oneWay={...local,edges:local.edges.filter(e=>e.id!=='EXC:I:1001097474:r')};assert.notEqual(route(prepare(oneWay),request()).status,'CONDITIONAL');assert.equal(route(prepare(oneWay),request(true)).status,'CONDITIONAL');
 for(const mutation of [e=>({...e,disabled:true}),e=>({...e,access_time_id:123,access_schedule:{kind:'daily',source_rule_id:123,timezone:'Asia/Hong_Kong',windows:[]}})]){const g={...local,edges:local.edges.map(e=>e.physical_id==='EXC:I:1000805010'?mutation(e):e)};for(const reverse of [false,true])assert.notEqual(route(prepare(g),request(reverse)).status,'CONDITIONAL');}
});

test('walk-cache rebase proves unchanged old graph and connections, rejects unrelated versions or a shortcut',()=>{
 const links=JSON.parse(gunzipSync(readFileSync(new URL('../../dist/transit/walk-links.json.gz',import.meta.url))));
 const original={...links,graph_version:base.version,exc_b3_exact_boundary_rebase:undefined};
 const out=rebaseExcWalkLinks(base,graph,original);assert.equal(out.graph_version,graph.version);assert.equal(out.connections,original.connections);assert.equal(rebaseExcWalkLinks(base,graph,out),out);
 assert.throws(()=>rebaseExcWalkLinks(base,graph,{...original,graph_version:'unrelated'}));
 assert.throws(()=>rebaseExcWalkLinks(base,{...graph,edges:change(graph.edges,'EXC:I:1000805010',e=>({...e,snap_eligible:true}))},original));
 assert.throws(()=>rebaseExcWalkLinks(base,{...graph,edges:change(graph.edges,'EXC:I:1001097474',e=>({...e,to_id:'ADM:N:31b17842679990'}))},original));
 assert.throws(()=>rebaseExcWalkLinks(base,{...graph,nodes:change(graph.nodes,base.nodes[0].id,n=>({...n,coordinates:[0,0,0]}))},original));
 assert.throws(()=>rebaseExcWalkLinks(base,graph,{...out,connections:[]}));
 assert.throws(()=>rebaseExcWalkLinks(base,{...graph,portals:change(graph.portals,base.portals[0].id,p=>({...p,node_id:EVIDENCE.endpoint}))},original));
 assert.throws(()=>rebaseExcWalkLinks(base,{...graph,closures:[{physical_ids:['unrelated']}]},original));
 assert.throws(()=>rebaseExcWalkLinks(base,{...graph,source:'different source'} ,original));
 assert.throws(()=>rebaseExcWalkLinks(base,{...graph,edges:graph.edges.map(e=>e.source_region_id==='EXC'?{...e,from_id:EVIDENCE.boundaryArea,to_id:EVIDENCE.indoorJunction}:e)},original));
 assert.throws(()=>rebaseExcWalkLinks(base,{...graph,edges:change(graph.edges,'EXC:I:1001097474',e=>({...e,to_id:'nonexistent-node'}))},original));
});

test('B3 portal canonicalization preserves the same amenity and exact station endpoint',()=>{
 const portals=new Map(graph.portals.map(p=>[p.id,p]));assert.equal(canonicalStationEndpoint('EXC:portal:B3',portals,station),EVIDENCE.endpoint);
 const p=station.portals.find(p=>p.id==='EXC:portal:B3');assert.ok(stationOutdoorCandidates(p,portals,station).some(x=>x.id===p.id));
 assert.deepEqual(graph.portals.at(-1).source_coordinates,p.source_coordinates);
});
