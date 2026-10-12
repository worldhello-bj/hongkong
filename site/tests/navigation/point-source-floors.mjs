/** Cheap source-only layer. No S1, taxi, city overlay, or UI claims. --run required. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {ROOT,FIXTURE,readJSON,digest,runtimeIdentity,PREFERENCES} from './point-matrix-fixture.mjs';
import {samePoint,sourceIndex} from './point-matrix-audit.mjs';
import {projectPacificPlaceGraph,auditTimedSourceRoute} from './point-source-projection.mjs';
import {loadPointSourceEligibility,strictSourceFailureReasons} from './point-source-eligibility.mjs';
const base=resolve(process.env.HK_POINT_DIST??resolve(ROOT,'dist')),fixture=readJSON(FIXTURE),runtime=runtimeIdentity(base);
const plan={runtime:runtime.version,layer:'production engine on Pacific Place source-only physical-edge subgraph',floors:fixture.floors.map(f=>({id:f.id,name:f.name,portals:f.portals.length})),openCells:5*5*2,closedCells:5*5*2,totalCells:100,openHour:11,closedHour:8,willRun:process.argv.includes('--run')};
console.log(JSON.stringify(plan,null,2));if(!process.argv.includes('--run'))process.exit(0);
const path='area/admiralty-block-graph.json.gz';if(digest(readFileSync(resolve(base,path)))!==fixture.sources[path])throw Error('Source floor fixture drift.');
globalThis.document={createElement:()=>({relList:{supports:()=>true}})};
const engine=await import(pathToFileURL(resolve(base,'assets/mobile-navigation-DfEsS_7b.js'))),model=await import(pathToFileURL(resolve(base,'assets/pacific-place-model.js')));
const sourceEligibility=await loadPointSourceEligibility(base);
const source=model.addPacificPlaceSourceAnchor(readJSON(resolve(base,path))),mall=model.buildPacificPlaceModel(source),graph=projectPacificPlaceGraph(source,mall.edges.map(e=>e.physical_id)),ready=engine.p(graph),index=sourceIndex([graph]);
plan.graph={physicalEdges:new Set(graph.edges.map(e=>e.physical_id)).size,directedEdges:graph.edges.length,nodes:graph.nodes.length,portals:graph.portals.length};
if(plan.graph.physicalEdges!==110||graph.nodes.length>200||graph.edges.length>300)throw Error('Unexpected source-subgraph size; stop before searches.');
for(const floor of fixture.floors)for(const portal of floor.portals)if(!index.nodes.has(portal.node_id))throw Error('Floor source node omitted by projection: '+portal.node_id);
const anchor=graph.portals.find(p=>p.id===model.PACIFIC_PLACE_F.id);if(!anchor)throw Error('Verified station-side F anchor missing.');
const endpoint=p=>({...p,lon:p.coordinates[0],lat:p.coordinates[1]}),place=graph.places.find(p=>p.id==='pacific-place'),rows=[];
const preferences={ordinary:'fast',luggage:'luggage',escalator:'escalator_first',lift:'lift_first',accessible:'accessible'};
for(const floor of fixture.floors)for(const hour of [11,8])for(const need of PREFERENCES)for(const reverse of [false,true]){
 const nodes=floor.portals.map(p=>p.node_id),floorPoint=endpoint({id:`pacific-place:floor:${floor.id}`,name:`太古廣場 ${floor.name}`,floorId:floor.id,coordinates:place.coordinates,node_ids:nodes,access_time_id:place.access_time_id,access_schedule:place.access_schedule});
 const a=endpoint(anchor),request={origin:reverse?a:floorPoint,destination:reverse?floorPoint:a,preference:preferences[need],mode:'walk',departureS:hour*3600,departureDate:'2026-10-12'},start=performance.now();
 const route=engine.d(ready,request),ids=route.legs?.flatMap(l=>l.edge_ids??[])??[],used=ids.map(id=>index.edges.get(id)).filter(Boolean),journey=route.status==='CONDITIONAL'?engine.a(ready,route,'Source floor connectivity'):null;
 const floorSide=reverse?'destination':'origin',actual=route[`snapped_${floorSide}`]?.coordinates,matches=floor.portals.filter(p=>samePoint(p.coordinates,actual));
 const forbidden=used.filter(e=>e.disabled||index.closed.has(e.physical_id)||(need==='accessible'&&!sourceEligibility.allows(e))).map(e=>e.id);
 const complete=!!journey?.complete,temporal=auditTimedSourceRoute(route,request,index,engine.t);
 rows.push({floorId:floor.id,floorName:floor.name,hour,need,direction:reverse?'F-to-floor':'floor-to-F',status:route.status,complete,temporal,wallMs:performance.now()-start,message:route.message,sourceNodeIds:nodes,actual,matchingPortalIds:matches.map(p=>p.id),kinds:[...new Set(route.legs?.map(l=>l.kind)??[])],forbidden,strictSourceFailures:need==='accessible'?used.flatMap(e=>{const reasons=strictSourceFailureReasons(e,sourceEligibility);return reasons.length?[{id:e.id,reasons}]:[]}):[],classification:forbidden.length?'invariant-failure':complete?(matches.length?'source-route-available':'floor-resolution-failure'):hour===8&&!reverse&&route.status==='NO_ROUTE'?'source-origin-opening-constraint':'source-route-unavailable-needs-diagnosis',checks:{knownForbiddenEdges:forbidden.length===0,floorPreserved:!complete||matches.length>0,timeAccess:temporal.pass}});
}
const stable=runtimeIdentity(base).signature===runtime.signature,out=resolve(ROOT,'validation/point-matrix',`${runtime.version}-${runtime.signature.slice(0,12)}`);mkdirSync(out,{recursive:true});
const report={schema:1,runtime,fixtureSha256:digest(readFileSync(FIXTURE)),plan,sourceEligibility:sourceEligibility.provenance,runtimeStable:stable,memory:{...process.memoryUsage(),maxRSSKiB:process.resourceUsage().maxRSS},rows,limitations:['Only the 110 physical Pacific Place model edges, retaining all existing directed copies, to/from the explicit F boundary. No outside-block escape, full city, taxi, S1 or browser coverage.','Only source-supported floors: LG1/L1/L2/L3/L4. No LG2 or invented lift.','Open-hour NO_ROUTE is not automatically a source defect or algorithm defect; preserve it for diagnosis. Origin departure and destination arrival must respect 10:00–22:00; an explicit paid wait outside is allowed.']};
writeFileSync(resolve(out,'source-floors-clock-aware.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({out,total:rows.length,complete:rows.filter(r=>r.complete).length,failures:rows.filter(r=>Object.values(r.checks).some(x=>!x)).map(r=>({floor:r.floorName,hour:r.hour,need:r.need,direction:r.direction,status:r.status,checks:r.checks,temporal:r.temporal}))}));
if(!stable||rows.some(r=>Object.values(r.checks).some(x=>!x)))process.exitCode=1;
