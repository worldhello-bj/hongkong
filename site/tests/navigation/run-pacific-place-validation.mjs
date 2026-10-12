import {readFileSync,writeFileSync,mkdirSync}from'node:fs';import{gunzipSync}from'node:zlib';
import{buildPacificPlaceModel,addPacificPlaceSourceAnchor,PACIFIC_PLACE_F}from'../../src/navigation/pacific-place-model.js';
const root=new URL('../../',import.meta.url);
globalThis.document={createElement:()=>({relList:{supports:()=>true}})};
const engine=await import('../../dist/assets/mobile-navigation-DfEsS_7b.js');
const graph=JSON.parse(gunzipSync(readFileSync(new URL('dist/area/admiralty-block-graph.json.gz',root))));
const ready=engine.p(addPacificPlaceSourceAnchor(graph)),place=graph.places.find(p=>p.id==='pacific-place'),tamar=graph.places.find(p=>p.id==='tamar-park');
const endpoint=(p,ids=p.entrance_ids)=>({...p,lon:p.coordinates[0],lat:p.coordinates[1],node_ids:ids.map(id=>graph.portals.find(p=>p.id===id).node_id)});
const tests=[];
for(const hour of [8,11])for(const need of ['ordinary','luggage','accessible']){
 const floors=hour===8?[null]:[null,...place.floors];
 for(const floor of floors){const request={origin:endpoint(place,floor?.entrance_ids),destination:endpoint(tamar),preference:need==='ordinary'?'fast':need,mode:'walk',departureS:hour*3600,departureDate:'2026-10-12'};
 const start=performance.now(),route=engine.d(ready,request),journey=route.status==='CONDITIONAL'?engine.a(ready,route,'太古广场→添马公园'):null;
 const ids=new Set(route.legs?.flatMap(l=>l.edge_ids)??[]),used=graph.edges.filter(e=>ids.has(e.id));
 const forbidden=need==='accessible'?used.filter(e=>e.wheelchair_barrier===1||!e.accessible_eligible||['stairs','escalator','stairlift','travelator'].includes(e.kind)).map(e=>e.id):[];
 tests.push({hour,need,floor:floor?.name??'入口自动',status:route.status,complete:journey?.complete??false,message:route.message,minutes:route.total_minutes,origin:route.snapped_origin?.coordinates,kinds:[...new Set(route.legs?.map(l=>l.kind)??[])],forbidden,wallMs:Math.round(performance.now()-start)});
 }}
for(const need of ['ordinary','luggage','accessible']){
 const portal=ready.portals.find(p=>p.id===PACIFIC_PLACE_F.id),origin={...portal,lon:portal.coordinates[0],lat:portal.coordinates[1]};
 const route=engine.d(ready,{origin,destination:endpoint(tamar),preference:need==='ordinary'?'fast':need,mode:'walk',departureS:28800,departureDate:'2026-10-12'});
 const journey=route.status==='CONDITIONAL'?engine.a(ready,route,'F外侧→添马公园'):null;
 tests.push({hour:8,need,floor:'F外侧显式替代',status:route.status,complete:journey?.complete??false,message:route.message,minutes:route.total_minutes,origin:route.snapped_origin?.coordinates,kinds:[...new Set(route.legs?.map(l=>l.kind)??[])],forbidden:[]});
}
const report={runtime:JSON.parse(readFileSync(new URL('dist/build-meta.json',root))).version,checked_at:new Date().toISOString(),scope:'Block-graph source route and assembled journey. Not browser UI or whole-Hong-Kong comparison.',summary:buildPacificPlaceModel(graph).summary,tests};
mkdirSync(new URL('validation/pacific-place/',root),{recursive:true});writeFileSync(new URL('validation/pacific-place/source-route-matrix.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(tests.some(t=>t.forbidden.length)||tests.some(t=>t.hour===8&&t.floor!=='F外侧显式替代'&&t.status!=='NO_ROUTE')||tests.some(t=>t.hour===11&&t.need!=='accessible'&&!t.complete))process.exitCode=1;
