import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const home=path.join(path.dirname(fileURLToPath(import.meta.url)),'data/exc-b3-boundary');
export const EVIDENCE=Object.freeze({
 features:[1001097474,1000805010], boundaryStation:'EXC:N:92f27e8b841d55', boundaryArea:'ADM:N:92f27e8b841d55',
 endpoint:'EXC:N:faaafc3c73386c', indoorJunction:'EXC:N:63f043089a052f', outdoorEdge:'ADM:P:290046359',
 indoorSource:'https://portal.csdi.gov.hk/server/rest/services/common/landsd_rcd_1742809197336_78665/MapServer/0',
 outdoorSource:'https://portal.csdi.gov.hk/server/rest/services/common/landsd_rcd_1637222018065_52265/MapServer/0',
 terms:'https://portal.csdi.gov.hk/csdi-webpage/doc/TNC',
});
const hash=b=>createHash('sha256').update(b).digest('hex');
const xyz=c=>[Number(c[0].toFixed(8)),Number(c[1].toFixed(8)),Number(c[2].toFixed(3))];
/** A bounded data-only import proposal. It does not implement source-free connection geometry. */
export function augmentExcB3(area,station,indoorOfficial,outdoorOfficial){
 const marker=area.exc_b3_exact_boundary_join;
 const nodes=new Map(station.nodes.map(n=>[n.id,n]));
 const base=area.nodes.find(n=>n.id===EVIDENCE.boundaryArea),source=nodes.get(EVIDENCE.boundaryStation);
 assert.ok(base&&source);assert.equal(base.region_id,'ADM');assert.deepEqual(base.coordinates,source.coordinates);
 const outdoor=area.edges.find(e=>e.id===EVIDENCE.outdoorEdge);
 const rawOutside=outdoorOfficial.features.find(f=>f.properties.PedestrianRouteID===290046359);
 assert.ok(outdoor&&rawOutside);assert.deepEqual(outdoor.coordinates,rawOutside.geometry.coordinates.map(xyz));
 const op=rawOutside.properties;
 assert.equal(op.Location,1);assert.equal(op.Enabled,1);assert.equal(op.Direction,0);assert.equal(op.FeatureType,2);assert.equal(op.AccessTimeID,null);
 assert.equal(outdoor.source_id,'CSDI-PEDESTRIAN');assert.equal(outdoor.geometry_mode,'official');assert.equal(outdoor.kind,'footbridge');
 for(const [field,value] of Object.entries({direction:op.Direction,location:op.Location,disabled:false,wheelchair_barrier:op.WheelchairBarrier,access_time_id:null}))assert.equal(outdoor[field],value);
 assert.ok(!outdoor.access_schedule);
 const reverseOutdoor=area.edges.find(e=>e.id===EVIDENCE.outdoorEdge+':r');
 assert.ok(reverseOutdoor);assert.deepEqual(reverseOutdoor.coordinates,[...outdoor.coordinates].reverse());
 assert.equal(reverseOutdoor.from_id,outdoor.to_id);assert.equal(reverseOutdoor.to_id,outdoor.from_id);
 for(const field of ['source_id','physical_id','geometry_mode','kind','direction','location','disabled','wheelchair_barrier','access_time_id','access_schedule'])assert.deepEqual(reverseOutdoor[field],outdoor[field]);
 assert.ok(!(area.closures??[]).some(c=>(c.physical_ids??[]).includes(outdoor.physical_id)));

 assert.ok([outdoor.from_id,outdoor.to_id].includes(base.id));
 const selected=station.edges.filter(e=>EVIDENCE.features.includes(e.source_feature_id));
 assert.equal(selected.length,4);
 for(const feature_id of EVIDENCE.features){
  const raw=indoorOfficial.features.find(f=>f.properties.PedestrianRouteID===feature_id);
  assert.ok(raw);const p=raw.properties;
  assert.equal(p.Location,2);assert.equal(p.Enabled,1);assert.equal(p.Direction,0);assert.equal(p.AccessTimeID,null);assert.equal(p.FeatureType,1);assert.equal(p.FloorID,1009970001);assert.equal(p.Gradient,feature_id===1000805010?0.383883703269168:0);assert.equal(p.WheelchairBarrier,2);
  const forward=selected.find(e=>e.source_feature_id===feature_id&&!e.id.endsWith(':r'));
  const reverse=selected.find(e=>e.source_feature_id===feature_id&&e.id.endsWith(':r'));
  assert.ok(forward&&reverse);assert.deepEqual(forward.coordinates,raw.geometry.coordinates.map(xyz));
  assert.deepEqual(reverse.coordinates,[...forward.coordinates].reverse());assert.equal(forward.from_id,reverse.to_id);assert.equal(forward.to_id,reverse.from_id);
  for(const e of [forward,reverse]){
   assert.equal(e.source_id,'CSDI-INDOOR');assert.equal(e.geometry_mode,'official');assert.equal(e.kind,'walk');
   assert.equal(e.direction,p.Direction);assert.equal(e.location,p.Location);assert.equal(e.disabled,false);
   assert.equal(e.wheelchair_barrier,p.WheelchairBarrier);assert.equal(e.access_time_id,p.AccessTimeID);assert.equal(e.floor_id,p.FloorID);
   assert.deepEqual(nodes.get(e.from_id)?.coordinates,e.coordinates[0]);assert.deepEqual(nodes.get(e.to_id)?.coordinates,e.coordinates.at(-1));
   assert.ok(!(e.access_schedule));assert.ok(!(station.closures??[]).some(c=>(c.physical_ids??[]).includes(e.physical_id)));
   assert.ok(!(area.closures??[]).some(c=>(c.physical_ids??[]).includes(e.physical_id)));
  }
 }
 const aliases=new Map([[source.id,base.id]]),ids=new Set(selected.flatMap(e=>[e.from_id,e.to_id]));
 const addedNodes=station.nodes.filter(n=>ids.has(n.id)&&!aliases.has(n.id)).map(n=>({...n,region_id:'ADM',source_region_id:'EXC'}));
 assert.equal(addedNodes.length,2);
 const addedEdges=selected.map(e=>({...e,region_id:'ADM',source_region_id:'EXC',from_id:aliases.get(e.from_id)??e.from_id,to_id:aliases.get(e.to_id)??e.to_id}));

 const portal=station.portals.find(p=>p.id==='EXC:portal:B3');assert.equal(portal.node_id,EVIDENCE.endpoint);assert.deepEqual(portal.coordinates,nodes.get(EVIDENCE.endpoint).coordinates);assert.equal(portal.station_id,'EXC');assert.equal(portal.level,'P');assert.equal(portal.source_feature_id,'mtr_amenity_point.1570');
 const evidence={schema:1,official_snapshot_sha256:OFFICIAL_SNAPSHOT_SHA256,method:'EXACT_OFFICIAL_XYZ_ENDPOINT_IDENTITY',feature_ids:EVIDENCE.features,rounding:'Existing graph: 1e-8 degrees / 1 mm Z; no additional tolerance',boundary:{station_node_id:source.id,area_node_id:base.id,coordinates:source.coordinates},source_station_version:station.version,source_area_version:marker?.source_area_version??area.version,added_nodes:2,added_directed_edges:4,paid_edges_added:0,rail_edges_added:0,indoor_source:EVIDENCE.indoorSource,outdoor_source:EVIDENCE.outdoorSource,terms_url:EVIDENCE.terms,notice:'A source-backed graph connection, not real-time opening or accessibility certification.'};
 const addedPortal={...portal,region_id:'ADM',source_region_id:'EXC'};
 if(marker){
  assert.deepEqual(marker,evidence,'Previously imported EXC evidence drifted');
  for(const [collection,expected] of [[area.nodes,addedNodes],[area.edges,addedEdges],[area.portals,[addedPortal]]])for(const record of expected){
   const matches=collection.filter(old=>old.id===record.id);assert.equal(matches.length,1);assert.deepEqual(matches[0],record,'Previously imported EXC record drifted');
  }
  return area;
 }
 for(const [collection,expected] of [[area.nodes,addedNodes],[area.edges,addedEdges],[area.portals,[addedPortal]]])for(const record of expected)assert.ok(!collection.some(old=>old.id===record.id),'Partial or conflicting EXC import');
 const result={...area,nodes:[...area.nodes,...addedNodes],edges:[...area.edges,...addedEdges],portals:[...area.portals,addedPortal],exc_b3_exact_boundary_join:evidence};
 result.version=hash(JSON.stringify([area.version,evidence])).slice(0,16);return result;
}
export const OFFICIAL_SNAPSHOT_SHA256=Object.freeze({
 'exact-indoor-features.json':'931453db636030832e8ca2a9edc2a70fb70944d747f947643de2b8922c9f6faa',
 'exact-outdoor-b3.json':'d710096552c6936d362f817f0656fa7eb6c78254099764bb1fb85764a2beb91b',
});
export function readOfficialEvidence(){
 return Object.keys(OFFICIAL_SNAPSHOT_SHA256).map(name=>{const bytes=fs.readFileSync(path.join(home,name));assert.equal(hash(bytes),OFFICIAL_SNAPSHOT_SHA256[name],'Official EXC snapshot drift: '+name);return JSON.parse(bytes);});
}
/** Rebind only an unchanged existing cache after proving a single-attachment,
 * non-snappable leaf addition. This cannot shorten any path between old nodes.
 * New portal/endpoint walks remain the production resolver's responsibility. */
export function rebaseExcWalkLinks(before,after,links){
 const marker=after.exc_b3_exact_boundary_join;assert.ok(marker);assert.equal(before.version,marker.source_area_version);
 for(const key of ['nodes','edges','portals'])assert.deepEqual(after[key].slice(0,before[key].length),before[key]);
 for(const key of new Set([...Object.keys(before),...Object.keys(after)]))if(!['version','nodes','edges','portals','exc_b3_exact_boundary_join'].includes(key))assert.deepEqual(after[key],before[key],'Unrelated graph metadata drift: '+key);
 const oldIds=new Set(before.nodes.map(n=>n.id)),added=after.edges.slice(before.edges.length),newNodes=after.nodes.slice(before.nodes.length);
 assert.equal(added.length,4);assert.equal(newNodes.length,2);assert.equal(after.portals.length-before.portals.length,1);
 const newIds=new Set(newNodes.map(n=>n.id));assert.equal(newIds.size,2);assert.ok(newNodes.every(n=>!oldIds.has(n.id)));
 assert.ok(added.every(e=>[e.from_id,e.to_id].every(id=>newIds.has(id)||id===EVIDENCE.boundaryArea)));
 assert.ok(added.every(e=>e.snap_eligible===false&&e.location===2&&e.geometry_mode==='official'&&e.kind==='walk'&&Number.isFinite(e.duration_s)&&e.duration_s>=0));
 const attachments=[...new Set(added.flatMap(e=>[e.from_id,e.to_id]).filter(id=>oldIds.has(id)))];assert.deepEqual(attachments,[EVIDENCE.boundaryArea]);
 const reachable=new Set(attachments),pending=[...attachments];for(const id of pending)for(const e of added){const other=e.from_id===id?e.to_id:e.to_id===id?e.from_id:null;if(other&&!reachable.has(other)){reachable.add(other);pending.push(other);}}
 assert.ok([...newIds].every(id=>reachable.has(id)),'Disconnected added node is not a proved leaf attachment');
 assert.ok(links.connections.every(c=>c.fromId!==after.portals.at(-1).id&&c.toId!==after.portals.at(-1).id));
 const proof={method:'UNCHANGED_CACHE_SINGLE_ATTACHMENT_NON_SNAPPABLE_LEAF',source_graph_version:before.version,graph_version:after.version,added_feature_ids:EVIDENCE.features,only_old_attachment_node_id:EVIDENCE.boundaryArea,unchanged_connections_sha256:hash(JSON.stringify(links.connections)),unchanged_connection_count:links.connections.length,notice:'Existing connection records are byte-equivalent JSON. No new B3 cache is invented; new endpoint walks use normal resolution.'};
 if(links.graph_version===after.version){assert.deepEqual(links.exc_b3_exact_boundary_rebase,proof);return links;}
 assert.equal(links.graph_version,before.version,'Unrelated walk cache version cannot be rebased');
 return {...links,graph_version:after.version,exc_b3_exact_boundary_rebase:proof};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=path.resolve(process.argv[2]??path.join(home,'../../..'));
 const areaFile=path.join(root,'dist/area/area-graph.json.gz'),stationFile=path.join(root,'dist/area/station-graph.json.gz');
 const read=file=>JSON.parse(gunzipSync(fs.readFileSync(file))),area=read(areaFile);
 const result=augmentExcB3(area,read(stationFile),...readOfficialEvidence());
 const before=area.exc_b3_exact_boundary_join?{...area,version:area.exc_b3_exact_boundary_join.source_area_version,nodes:area.nodes.filter(n=>n.source_region_id!=='EXC'),edges:area.edges.filter(e=>e.source_region_id!=='EXC'),portals:area.portals.filter(p=>p.source_region_id!=='EXC'),exc_b3_exact_boundary_join:undefined}:area;
 const linksFile=path.join(root,'dist/transit/walk-links.json.gz'),links=read(linksFile),nextLinks=rebaseExcWalkLinks(before,result,links);
 if(result!==area)fs.writeFileSync(areaFile,gzipSync(JSON.stringify(result)));
 if(nextLinks!==links)fs.writeFileSync(linksFile,gzipSync(JSON.stringify(nextLinks)));
 console.log(JSON.stringify({changed:result!==area,version:result.version,evidence:result.exc_b3_exact_boundary_join},null,2));
}
