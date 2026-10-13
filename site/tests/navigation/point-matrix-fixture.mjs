/** Reproducible source-point selection. Generation never executes a route search. */
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
export const ROOT=fileURLToPath(new URL('../../',import.meta.url));
export const FIXTURE=resolve(ROOT,'tests/navigation/fixtures/point-matrix-v1.json');
export const PREFERENCES=['ordinary','luggage','escalator','lift','accessible'];
export const digest=data=>createHash('sha256').update(data).digest('hex');
export function runtimeIdentity(base){
 const paths=['assets','area','transit','taxi'].flatMap(dir=>readdirSync(resolve(base,dir)).filter(n=>/\.(js|json|gz)$/.test(n)).map(n=>dir+'/'+n)).sort();
 const assets=Object.fromEntries(paths.map(p=>[p,digest(readFileSync(resolve(base,p)))]));
 return {version:readJSON(resolve(base,'build-meta.json')).version,assets,signature:digest(JSON.stringify(assets))};
}
export function readJSON(path){const bytes=readFileSync(path);return JSON.parse(path.endsWith('.gz')?gunzipSync(bytes):bytes);}
const take=(value,label)=>{if(!value)throw Error('Missing source point: '+label);return value;};
const compactPortal=p=>Object.fromEntries(['id','name','coordinates','node_id','region_id','station_id','level','level_name','source_feature_id','source_url','evidence','access_time_id'].filter(k=>p[k]!==undefined).map(k=>[k,p[k]]));
const point=p=>({...p,lon:p.coordinates[0],lat:p.coordinates[1]});
export function buildFixture(base=resolve(ROOT,'dist')){
 const paths=['area/station-graph.json.gz','area/admiralty-block-graph.json.gz','transit/services.json'];
 const [station,block,services]=paths.map(p=>readJSON(resolve(base,p)));
 const sources=Object.fromEntries(paths.map(p=>[p,digest(readFileSync(resolve(base,p)))]));
 const place=take(block.places.find(p=>p.id==='pacific-place'),'pacific-place');
 const nodeMap=new Map(block.nodes.map(n=>[n.id,n]));
 const floors=[...place.floors].sort((a,b)=>['LG1','L1','L2','L3','L4'].indexOf(a.name)-['LG1','L1','L2','L3','L4'].indexOf(b.name)).map(f=>({id:f.id,name:f.name,portals:f.entrance_ids.map(id=>{const p=take(block.portals.find(p=>p.id===id),id),n=take(nodeMap.get(p.node_id),p.node_id);return {...compactPortal(p),coordinates:n.coordinates};})}));
 const portal=id=>point(compactPortal(take(station.portals.find(p=>p.id===id),id)));
 const stop=id=>{const p=take(services.stops.find(p=>p.id===id),id);return point({...p,source_url:'https://static.data.gov.hk/td/pt-headway-sc/stops.txt'});};
 const floor=name=>{const f=take(floors.find(f=>f.name===name),name);return point({id:`${place.id}:floor:${f.id}`,namedPlaceId:place.id,name:`${place.name} · ${f.name}`,floorId:f.id,floorName:f.name,coordinates:place.coordinates,access_time_id:place.access_time_id,access_schedule:place.access_schedule});};
 const landPath=resolve(ROOT,'tests/navigation/fixtures/land-coverage-72.json'),land=readJSON(landPath);
 const row=(id,stage,label,tags,origin,destination,selection)=>({id,stage,label,tags,selection,request:{origin,destination,departureDate:'2026-10-12',departureS:39600}});
 const rows=[
  row('exits-cross','A','金鐘 E2 → 紅磡 B2 升降機入口',['metro-exit','cross-harbour','lift-source'],portal('ADM:portal:E2'),portal('HUH:portal:B2-lift'),'Named source portals; no route-success filtering.'),
  row('stops-cross','A','尖沙咀碼頭巴士站 → 金鐘港鐵站西行電車站',['bus-stop','tram-stop','cross-harbour'],stop('td:4025'),stop('td:99133'),'Existing service stop IDs; selected by source identity, not inferred coordinates.'),
  row('mall-floors','A','太古廣場 LG1 → L4',['named-floor','same-shore','vertical'],floor('LG1'),floor('L4'),'UI named-floor endpoints; centroid stays selected, explicit resolution must match that source floor.'),
  row('kowloon-local','B','九龍 C1 U3 → 九龍站巴士總站',['metro-exit','bus-stop','same-shore','elevated-source'],portal('KOW:portal:C1'),stop('td:4246'),'Existing elevated C1 portal and exact timetable stop; no ground-level substitution.'),
  ...[[1,'land-island','same-shore'],[12,'land-cross','cross-harbour']].map(([i,id,shore])=>row(id,'B',`固定種子陸地 OD ${i}`,['fixed-seed-land',shore],structuredClone(land.rows[i-1].request.origin),structuredClone(land.rows[i-1].request.destination),`Unchanged row ${i}, seed ${land.seed}, from existing land fixture; no success filtering.`))
 ];
 return {schema:1,selectionSeed:land.seed,departureTimezone:'Asia/Hong_Kong',preferences:PREFERENCES,taxi:[false,true],observationWindowMs:60000,externalWatchdogMs:90000,sources,landFixture:{path:'tests/navigation/fixtures/land-coverage-72.json',sha256:digest(readFileSync(landPath)),rowIndices:[1,12]},floors,rows,limitations:['Six stratified OD rows are diagnostic coverage, not statistical or Hong Kong-wide completeness.','Named floors permit only disclosed resolution to an existing portal on that floor. Exact map/portal points retain their own XYZ and node identity.','Source graph connectivity is not live facility verification.']};
}
export function cells(fixture,stage='all'){return fixture.rows.filter(r=>stage==='all'||r.stage===stage).flatMap(row=>fixture.preferences.flatMap(need=>fixture.taxi.map(taxi=>({id:`${row.id}-${need}-taxi-${taxi?'on':'off'}`,rowId:row.id,stage:row.stage,need,taxi}))));}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const fixture=buildFixture();if(process.argv.includes('--write'))writeFileSync(FIXTURE,JSON.stringify(fixture,null,2)+'\n');console.log(JSON.stringify({fixture:FIXTURE,rows:fixture.rows.map(r=>({id:r.id,label:r.label,tags:r.tags})),cells:cells(fixture).length,floors:fixture.floors.map(f=>({id:f.id,name:f.name,sourcePortals:f.portals.length})),wrote:process.argv.includes('--write')},null,2));}
