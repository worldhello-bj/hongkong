import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
// No proximity joins: reuse the area's own rounded official XYZ endpoint rule.
export function augmentKowloonArea(area, station) {
 if(area.kowloon_exact_boundary_join) return area;
 const key=n=>JSON.stringify(n.coordinates);
 const areaXYZ=new Map(area.nodes.filter(n=>n.coordinates?.length===3).map(n=>[key(n),n]));
 const stationNodes=station.nodes.filter(n=>n.region_id==='KOW');
 const joins=stationNodes.flatMap(n=>{const a=areaXYZ.get(key(n));return a?[{station_node_id:n.id,area_node_id:a.id,coordinates:n.coordinates,region_id:a.region_id}]:[]});
 if(joins.length!==7 || joins.some(j=>j.region_id!=='AUS')) throw new Error('Kowloon exact boundary evidence changed; review required');
 const aliases=new Map(joins.map(j=>[j.station_node_id,j.area_node_id]));
 // Location 3 is the paid station area: do not turn it into an outdoor shortcut.
 const imported=station.edges.filter(e=>e.region_id==='KOW'&&e.source_id==='CSDI-INDOOR'&&e.geometry_mode==='official'&&e.location===2);
 const edges=imported.map(e=>({...e,source_region_id:'KOW',region_id:'AUS',from_id:aliases.get(e.from_id)??e.from_id,to_id:aliases.get(e.to_id)??e.to_id}));
 const ids=new Set(edges.flatMap(e=>[e.from_id,e.to_id]));
 const nodes=stationNodes.filter(n=>!aliases.has(n.id)&&ids.has(n.id)).map(n=>({...n,source_region_id:'KOW',region_id:'AUS'}));
 const portals=station.portals.filter(p=>p.station_id==='KOW'&&p.id.includes(':portal:')&&ids.has(p.node_id)).map(p=>({...p,source_region_id:'KOW',region_id:'AUS'}));
 for(const j of joins) portals.push({id:'KOW:boundary:'+j.station_node_id.split(':').at(-1),station_id:'KOW',region_id:'AUS',node_id:j.area_node_id,coordinates:j.coordinates,name:'九龍站 · 官方站外连接点',evidence:'EXACT_OFFICIAL_XYZ_ENDPOINT_IDENTITY',offset_m:0});
 const joinEvidence=joins.map(j=>({...j,indoor_features:imported.filter(e=>[e.from_id,e.to_id].includes(j.station_node_id)).map(e=>e.source_feature_id).filter((v,i,a)=>a.indexOf(v)===i),outdoor_edges:area.edges.filter(e=>[e.from_id,e.to_id].includes(j.area_node_id)).map(e=>e.physical_id).filter((v,i,a)=>a.indexOf(v)===i)}));
 const evidence={method:'EXACT_OFFICIAL_XYZ_ENDPOINT_IDENTITY',rounding:'Existing graph: 1e-8 degrees / 1 mm Z; no additional tolerance',station_version:station.version,joins:joinEvidence,excluded_paid_area_edges:station.edges.filter(e=>e.region_id==='KOW'&&e.location===3).length,indoor_source:station.source,added_nodes:nodes.length,added_edges:edges.length};
 const version=createHash('sha256').update(JSON.stringify([area.version,evidence])).digest('hex').slice(0,16);
 return {...area,version,nodes:[...area.nodes,...nodes],edges:[...area.edges,...edges],portals:[...area.portals,...portals],kowloon_exact_boundary_join:evidence};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [areaFile,stationFile,outFile]=process.argv.slice(2);
 if(!outFile)throw new Error('Usage: node augment-kowloon-area.mjs input-area.gz station.gz output-area.gz');
 const read=f=>JSON.parse(gunzipSync(fs.readFileSync(f)));
 const result=augmentKowloonArea(read(areaFile),read(stationFile));
 fs.writeFileSync(outFile,gzipSync(JSON.stringify(result)));
 console.log(JSON.stringify({version:result.version,...result.kowloon_exact_boundary_join},null,2));
}
