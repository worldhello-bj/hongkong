/** Fixed-seed, stratified real-source selection. No success filtering or route repair. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {buildFixture,readJSON,runtimeIdentity} from '../tests/navigation/point-matrix-fixture.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(process.argv.find(x=>x.startsWith('--out='))?.slice(6)??'validation/seeded-routes');
const seed=20261013;let state=seed;const random=()=>{state=(1664525*state+1013904223)>>>0;return state/4294967296;};
const pick=xs=>xs[Math.floor(random()*xs.length)];
const base=resolve(process.env.HK_POINT_DIST??resolve(root,'dist')),runtime=runtimeIdentity(base);
const fixture=buildFixture(base),station=readJSON(resolve(base,'area/station-graph.json.gz')),services=readJSON(resolve(base,'transit/services.json'));
const point=p=>({...p,lon:p.coordinates[0],lat:p.coordinates[1]});
const portals=station.portals.filter(p=>p.node_id&&p.coordinates?.length===3&&['ADM','HUH','AUS','KOW','EXC'].includes(p.region_id??p.station_id??p.id.split(':')[0])).sort((a,b)=>a.id.localeCompare(b.id));
const stops=[...services.stops].sort((a,b)=>a.id.localeCompare(b.id));
const land=readJSON(resolve(root,'tests/navigation/fixtures/land-coverage-72.json'));
const sourceFloor=fixture.rows.find(r=>r.id==='mall-floors').request.origin;
const floorPoint=f=>({...sourceFloor,id:'pacific-place:floor:'+f.id,name:'太古廣場 · '+f.name,floorId:f.id,floorName:f.name});
const selectedLandRowIndices=[],rows=[],needs=['ordinary','luggage','escalator','lift'],times=[28800,28980,39600,82800];
for(const stratum of ['station-portals','surface-stops','land-nodes','source-floors'])for(let i=0;i<4;i++){
 let origin,destination,selection,sourceLandRowIndex;
 if(stratum==='station-portals'){origin=point(pick(portals));do{destination=point(pick(portals));}while(destination.id===origin.id);selection='Exact source station portal identities; no successful-route filtering.';}
 if(stratum==='surface-stops'){origin=point(pick(stops));do{destination=point(pick(stops));}while(destination.id===origin.id);selection='Existing timetable stop identities; route coverage is not assumed.';}
 if(stratum==='land-nodes'){const row=pick(land.rows);sourceLandRowIndex=land.rows.indexOf(row)+1;selectedLandRowIndices.push(sourceLandRowIndex);({origin,destination}=structuredClone(row.request));selection='Seeded selection from existing land-coverage fixture; no sea points or success filtering.';}
 if(stratum==='source-floors'){const a=pick(fixture.floors);let b;do{b=pick(fixture.floors);}while(a.id===b.id);origin=floorPoint(a);destination=floorPoint(b);selection='Existing source-supported named floors; exact floor resolution audited.';}
 rows.push({id:`${stratum}-${i+1}`,label:origin.name+' → '+destination.name,tags:[stratum,'fixed-seed'],selection,...(sourceLandRowIndex?{sourceLandRowIndex}:{}),need:needs[i],taxi:i%2===1,request:{origin,destination,departureDate:'2026-10-13',departureS:times[i]}});
}
fixture.rows=rows;fixture.preferences=needs;fixture.observationWindowMs=60000;fixture.seed=seed;fixture.selectionSeed=seed;
fixture.landFixture={...fixture.landFixture,seed:land.seed,rowIndices:selectedLandRowIndices,rowIndexBase:1};
fixture.limitations=[`${rows.length} stratified diagnostic cells are not a statistical or Hong Kong-wide success-rate estimate. Preference, departure time and taxi policy co-vary.`,...fixture.limitations.slice(1)];fixture.selectionAlgorithm='LCG(1664525,1013904223,2^32); sorted source arrays, no route search during selection';
mkdirSync(out,{recursive:true});const fixturePath=resolve(out,'fixture.json');writeFileSync(fixturePath,JSON.stringify(fixture,null,2)+'\n');
console.log(JSON.stringify({seed,rows:rows.length,out,run:process.argv.includes('--run')}));
if(process.argv.includes('--run')){
 const observations=[];
 for(const row of rows){
  const reportPath=resolve(out,row.id+'.json'),started=Date.now();
  const run=spawnSync(process.execPath,['--max-old-space-size=768',resolve(root,'tests/navigation/seeded-route-harness.mjs')],{cwd:root,env:{...process.env,HK_POINT_DIST:base,HK_POINT_RUNTIME:runtime.version,HK_SEEDED_FIXTURE:fixturePath,HK_POINT_ROW:row.id,HK_NEED:row.need,HK_TAXI:row.taxi?'1':'0',HK_REPORT_PATH:reportPath},timeout:90000,maxBuffer:1024*1024,encoding:'utf8'});
  let report;try{report=readJSON(reportPath);}catch{}
  const summary={id:row.id,need:row.need,taxi:row.taxi,departureS:row.request.departureS,stratum:row.tags[0],exitCode:run.status,elapsedMs:Date.now()-started,classification:report?.classification??(run.error?.code==='ETIMEDOUT'?'external-timeout':'probe-error'),comparisonStatus:report?.comparisonStatus,available:report?.candidates?.length??0,passed:report?.candidates?.filter(c=>c.pass).length??0,firstResultMs:report?.firstResultMs,fullCandidateWallMs:report?.fullCandidateWallMs,checks:report?.candidates?.map(c=>({id:c.id,pass:c.pass,failed:Object.entries(c.checks??{}).filter(([k,v])=>v===false).map(([k])=>k)})),messages:report?.unavailable?.map(c=>c.message),errors:report?.workerErrors??[]};
  observations.push(summary);writeFileSync(resolve(out,'summary.json'),JSON.stringify({seed,runtime:runtime.version,runtimeSignature:runtime.signature,total:rows.length,executed:observations.length,observations,limits:['Stratified diagnostic cohort, not Hong Kong-wide success-rate estimate.','One fresh process per cell. 60s comparison observation and 90s external watchdog; pending is never NO_ROUTE.','Real entry and Worker with DOM stand-in, not browser/device performance.']},null,2)+'\n');
  console.log(JSON.stringify(summary));
  if(run.status!==0||summary.available!==summary.passed||!["completed-with-candidates","completed-without-candidate-needs-diagnosis","pending-observation-window"].includes(summary.classification))process.exitCode=1;
 }
}
