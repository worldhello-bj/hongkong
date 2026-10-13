import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {augmentKowloonArea} from '../../scripts/augment-kowloon-area.mjs';
const read=f=>JSON.parse(gunzipSync(fs.readFileSync(new URL('../../dist/area/'+f+'.json.gz',import.meta.url))));
const raw=read('area-graph');
const base=raw.kowloon_exact_boundary_join ? {...raw,nodes:raw.nodes.filter(n=>n.source_region_id!=='KOW'),edges:raw.edges.filter(e=>e.source_region_id!=='KOW'),portals:raw.portals.filter(p=>p.station_id!=='KOW'),kowloon_exact_boundary_join:undefined} : raw;
const station=read('station-graph'),graph=augmentKowloonArea(base,station);
globalThis.document={createElement:()=>({relList:{supports:()=>true}})};
const {p:prepare,d:route}=await import('../../dist/assets/mobile-navigation-DfEsS_7b.js');
const ep=id=>{const p=graph.portals.find(p=>p.id===id);return {lon:p.coordinates[0],lat:p.coordinates[1],node_id:p.node_id}};
const req=(reverse=false)=>({origin:ep(reverse?'KOW:boundary:1ad104043ec065':'KOW:portal:E1'),destination:ep(reverse?'KOW:portal:E1':'KOW:boundary:1ad104043ec065'),preference:'accessible',mode:'walk',departureS:28800,departureDate:'2026-10-11'});
test('Kowloon exactXYZ joins preserve original area topology and reject approximate joins',()=>{
 assert.equal(graph.kowloon_exact_boundary_join.joins.length,7);
 assert.deepEqual(graph.nodes.slice(0,base.nodes.length),base.nodes);
 assert.deepEqual(graph.edges.slice(0,base.edges.length),base.edges);
 assert.ok(graph.edges.filter(e=>e.source_region_id==='KOW').every(e=>e.location===2));
 assert.equal(augmentKowloonArea(graph,station),graph);
 const altered=structuredClone(station);altered.nodes.find(n=>n.id==='KOW:N:1ad104043ec065').coordinates[2]+=.001;
 assert.throws(()=>augmentKowloonArea(base,altered),/evidence changed/);
});
test('E1 to actual outdoor boundary is strictly accessible in both directions',()=>{
 const p=prepare(graph);
 for(const rev of [false,true]){const r=route(p,req(rev));assert.equal(r.status,'CONDITIONAL',r.message);assert.ok(r.legs.every(l=>l.geometry_mode==='official'));assert.ok(!r.legs.some(l=>['stairs','access_connector'].includes(l.kind)));}
});
test('disabled and wheelchair barrier boundary closures stay rejected',()=>{
 for(const field of ['disabled','wheelchair_barrier']){
  const g=structuredClone(graph);for(const e of g.edges)if(graph.kowloon_exact_boundary_join.joins.some(j=>j.indoor_features.includes(e.source_feature_id))){if(field==='disabled')e.disabled=true;else {e.wheelchair_barrier=1;e.accessible_eligible=false;}}
  assert.notEqual(route(prepare(g),req()).status,'CONDITIONAL');
 }
});
test('C1 stairs remain excluded from strict accessibility despite new outdoor links',()=>{
 const r=route(prepare(graph),{...req(),origin:ep('KOW:portal:C1')});assert.notEqual(r.status,'CONDITIONAL');
});
test('one-way outdoor boundaries and closed opening hours are preserved',()=>{
 const boundaries=new Set(graph.kowloon_exact_boundary_join.joins.map(j=>j.area_node_id));
 const oneWay={...graph,edges:graph.edges.filter(e=>!(e.source_region_id==='KOW'&&boundaries.has(e.to_id)))};
 const p=prepare(oneWay);assert.notEqual(route(p,req()).status,'CONDITIONAL');assert.equal(route(p,req(true)).status,'CONDITIONAL');
 const closed=structuredClone(graph);
 for(const e of closed.edges)if(e.source_region_id==='KOW'&&(boundaries.has(e.to_id)||boundaries.has(e.from_id))){e.access_time_id=987654;e.access_schedule={kind:'daily',source_rule_id:987654,timezone:'Asia/Hong_Kong',windows:[]};}
 assert.notEqual(route(prepare(closed),req()).status,'CONDITIONAL');
});
