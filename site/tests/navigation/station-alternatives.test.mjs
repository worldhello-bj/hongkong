import {readFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const root=new URL('../../',import.meta.url).pathname;
globalThis.document={createElement:()=>({relList:{supports:()=>true}})};
const version=JSON.parse(readFileSync(root+'dist/build-meta.json')).version;
const built=path=>pathToFileURL(root+'dist/'+path).href+'?v='+version;
const source=readFileSync(root+'src/navigation/main.recovered.js','utf8');
const head=source.slice(0,source.indexOf('// Removed obsolete straight-line demo ride generator.')).replaceAll(/from\s*"\.\/([^"\n]+)"/g,(_,file)=>'from '+JSON.stringify(built('assets/'+file)));
const {f2,E2,F1,g2,x2}=await import('data:text/javascript;base64,'+Buffer.from(head+'\nexport {f2,E2,F1,g2,x2};').toString('base64'));
const {p:prepare,d:route}=await import(built('assets/mobile-navigation-DfEsS_7b.js'));
const read=p=>{const b=readFileSync(p);return JSON.parse(p.endsWith('.gz')?gunzipSync(b):b)};
const graph=read(root+'dist/area/station-graph.json.gz'),station=prepare(graph),area=prepare(read(root+'dist/area/area-graph.json.gz')),block=read(root+'dist/area/admiralty-block-graph.json.gz');
const router=E2(area,read(root+'dist/transit/services.json'),read(root+'dist/transit/walk-links.json.gz'),station);
const portal=id=>{const p=graph.portals.find(p=>p.id===id);return {...p,lon:p.coordinates[0],lat:p.coordinates[1]}};

const {stationEntranceCandidates,evaluateStationEntrances,stationEntrancePanel,applyStationEntranceChoice,isVerifiedExactConnector,annotateStationDetour}=await import(built('assets/station-alternatives.js'));
const {annotatePreferenceResult}=await import('../../src/navigation/preference-routing.js');
const {reconcileLiftOverlay,CORRECTED_LIFT_IDS}=await import('../../scripts/repair-station-overlay.mjs');
const manifest=read(root+'dist/preview/station-access-alternatives.json');
const request=(a,b,need='lift',departureS=39600)=>({origin:portal(a),destination:portal(b),mode:'walk',need,departureS,departureDate:'2026-10-11',allowedTransitModes:['metro','bus','tram']});
const plan=req=>f2(req,station,area,router,undefined,block);
// Independent source-capability oracle; this internal engine flag is not a UI/API choice.
const evidencePlan=(req,overlay=block)=>{
 const merged=F1(station,g2(area,overlay)),region=req.origin.node_id.split(':')[0];
 const nodes=merged.nodes.filter(n=>n.region_id===region),ids=new Set(nodes.map(n=>n.id));
 const local=prepare({...merged,regions:merged.regions.filter(r=>r.id===region),nodes,edges:merged.edges.filter(e=>e.region_id===region&&ids.has(e.from_id)&&ids.has(e.to_id)),portals:merged.portals.filter(p=>p.region_id===region&&ids.has(p.node_id))});
 const r=route(local,{origin:req.origin,destination:req.destination,preference:'accessible',mode:'walk',departureS:req.departureS,departureDate:req.departureDate});
 if(r.status!=='CONDITIONAL')return {message:r.message};
 return {journey:x2(local,r,'source evidence probe'),routedEndpoints:{origin:r.snapped_origin.coordinates,destination:r.snapped_destination.coordinates},segments:r.legs.map(l=>({kind:l.kind})),totalMinutes:Math.ceil(r.total_minutes),message:r.message};
};

for(const need of ['ordinary','luggage','escalator','lift','evidence-only'])for(const reverse of [false,true]){
 const req=request(reverse?'ADM:platform-area:EAL':'ADM:portal:C2',reverse?'ADM:portal:C2':'ADM:platform-area:EAL',need==='evidence-only'?'lift':need),result=need==='evidence-only'?evidencePlan(req):await plan(req);
 assert.equal(result.journey?.complete,true,result.message);assert.ok(isVerifiedExactConnector(result,req.origin,req.destination));
 const annotated=annotateStationDetour(req,result,graph,manifest);if(need==='evidence-only'){assert.ok(annotated.stationDetour);assert.match(annotated.message,/保留原/);assert.ok(annotated.stationDetour.minutes>0&&annotated.stationDetour.minutes<6);assert.ok(annotated.totalMinutes>=12);}else if(need==='luggage'){const carries=result.segments.some(s=>['stairs','escalator'].includes(s.kind));if(carries)assert.equal(annotatePreferenceResult(result,req).luggageCarryRequired,true,'soft luggage preference must disclose carrying');}
 console.log('PASS original-endpoint detour',need,reverse,annotated.totalMinutes,annotated.stationDetour?.via);
}
const req=request('HUH:portal:B2','HUH:platform-area:EAL'),snapshot=JSON.stringify(req),options=[],detours=[];
await evaluateStationEntrances({request:req,graph,manifest,plan,onOption:o=>options.push(o),onDetour:r=>detours.push(r)});
assert.equal(JSON.stringify(req),snapshot);assert.equal(detours.length,0);assert.equal(options[0].place.id,'HUH:portal:B2-lift');assert.equal(options[0].routeReady,true);
const html=stationEntrancePanel(options);assert.match(html,/街面接驳尚未核验/);assert.match(html,/不含原入口之间的未核验接驳/);assert.match(html,/data-station-entrance-choice=/);
const selected=applyStationEntranceChoice(req,options[0]);assert.equal(selected.origin.id,'HUH:portal:B2-lift');assert.equal(selected.destination,req.destination);assert.equal(req.origin.id,'HUH:portal:B2');
assert.equal(applyStationEntranceChoice({...req,origin:portal('HUH:portal:D6')},options[0]),null);
assert.equal(stationEntranceCandidates(req,graph,{...manifest,station_graph_version:'old'}).length,0);
assert.equal((await evaluateStationEntrances({request:req,graph,manifest,plan,isStale:()=>true})).length,0);
assert.equal(applyStationEntranceChoice(selected,options[0]),null,'Repeated old button cannot replace a newer endpoint');
let interrupted=false,published=0,calls=0;
await evaluateStationEntrances({request:req,graph,manifest,isStale:()=>interrupted,plan:async()=>{calls++;interrupted=true;return {message:'cancelled'};},onOption:()=>published++});
assert.equal(calls,1);assert.equal(published,0);
console.log('PASS explicit alternative selection, origin preservation, stale data and cancellation guards');
const late=request('ADM:portal:C2','ADM:platform-area:EAL','lift',23*3600);assert.notEqual(evidencePlan(late).journey?.complete,true);
console.log('PASS detour opening-hours exclusion');
// Restore only the previous false flags in a test copy. Real restrictions must win.
const uncorrected=()=>{const copy=structuredClone(block);for(const e of copy.edges)if(CORRECTED_LIFT_IDS.has(e.physical_id)){delete e.eligibility_correction;e.accessible_eligible=false;}return copy;};
assert.equal(reconcileLiftOverlay(uncorrected(),graph),14);
for(const field of ['disabled','wheelchair_barrier']){
 const copy=uncorrected(),edge=copy.edges.find(e=>e.id==='ADM:I:1000859480');edge[field]=field==='disabled'?true:1;
 reconcileLiftOverlay(copy,graph);assert.equal(edge.accessible_eligible,false);
 const live=structuredClone(block);for(const e of live.edges)if(e.physical_id==='ADM:I:1000859480')e[field]=field==='disabled'?true:1;
 const result=evidencePlan(request('ADM:portal:C2','ADM:platform-area:EAL'),live);assert.notEqual(result.journey?.complete,true);
 console.log('PASS overlay safety precedence',field);
}
const closed=uncorrected();closed.closures=[{physical_ids:['ADM:I:1000859480']}];reconcileLiftOverlay(closed,graph);assert.equal(closed.edges.find(e=>e.id==='ADM:I:1000859480').accessible_eligible,false);
console.log('PASS explicit closure is not overwritten');
const main=readFileSync(root+'src/navigation/main.recovered.js','utf8');assert.ok(main.includes('stationEntrancePanel(stationEntranceOptions,stationAlternativeLoading)'));assert.ok(main.includes('applyStationEntranceChoice(r,option)'));assert.ok(main.includes('stationAlternativeData=data'));assert.ok(!main.includes('stationAlternativeData=e[4]'),'optional metadata must not block core readiness');
