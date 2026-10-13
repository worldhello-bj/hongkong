import {readFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const root=new URL('../../',import.meta.url).pathname;
globalThis.document={createElement:()=>({relList:{supports:()=>true}})};
const version=JSON.parse(readFileSync(root+'dist/build-meta.json')).version;
const built=path=>pathToFileURL(root+'dist/'+path).href+'?v='+version;
const source=readFileSync(root+'src/navigation/main.recovered.js','utf8');
const head=source.slice(0,source.indexOf('// Removed obsolete straight-line demo ride generator.')).replaceAll(/from\s*"\.\/([^"\n]+)"/g,(_,file)=>'from '+JSON.stringify(built('assets/'+file)));
const {f2,E2,F1,g2}=await import('data:text/javascript;base64,'+Buffer.from(head+'\nexport {f2,E2,F1,g2};').toString('base64'));
const {p:prepare,d:route}=await import(built('assets/mobile-navigation-DfEsS_7b.js'));
const read=p=>{const b=readFileSync(p);return JSON.parse(p.endsWith('.gz')?gunzipSync(b):b)};
const graph=read(root+'dist/area/station-graph.json.gz'),station=prepare(graph),area=prepare(read(root+'dist/area/area-graph.json.gz')),block=read(root+'dist/area/admiralty-block-graph.json.gz');
const router=E2(area,read(root+'dist/transit/services.json'),read(root+'dist/transit/walk-links.json.gz'),station);
const {annotatePreferenceResult}=await import('../../src/navigation/preference-routing.js');
const portal=id=>{const p=graph.portals.find(p=>p.id===id);return {...p,lon:p.coordinates[0],lat:p.coordinates[1]}};
// Evidence-only engine oracle: not a selectable product preference. Keep
// negative wheelchair/source constraints covered without reintroducing a UI mode.
const probeEvidence=(request,sourceStation=station)=>{
 const merged=F1(sourceStation,g2(area,block)),region=request.origin.node_id.split(':')[0];
 const nodes=merged.nodes.filter(n=>n.region_id===region),ids=new Set(nodes.map(n=>n.id));
 const local=prepare({...merged,regions:merged.regions.filter(r=>r.id===region),nodes,edges:merged.edges.filter(e=>e.region_id===region&&ids.has(e.from_id)&&ids.has(e.to_id)),portals:merged.portals.filter(p=>p.region_id===region&&ids.has(p.node_id))});
 return route(local,{origin:request.origin,destination:request.destination,preference:'accessible',mode:'walk',departureS:request.departureS,departureDate:request.departureDate});
};

for(const [a,b] of [['HUH:portal:B2-lift','HUH:platform-area:EAL'],['HUH:portal:B2-lift','HUH:platform-area:TML'],['KOW:portal:E1','KOW:platform-area:TCL']])for(const reverse of [false,true])for(const need of ['ordinary','luggage','escalator','lift']){
 const origin=portal(reverse?b:a),destination=portal(reverse?a:b);
 const r=await f2({origin,destination,mode:'walk',need,departureS:39600,departureDate:'2026-10-11',allowedTransitModes:['metro','bus','tram']},station,area,router,undefined,block);
 assert.equal(r.journey?.complete,true,`${origin.id}->${destination.id} ${need}: ${r.message}`);
 assert.deepEqual(r.routedEndpoints,{origin:origin.coordinates,destination:destination.coordinates});if(need==='luggage')assert.ok(r.segments.some(s=>s.kind==='lift'));if(need==='luggage'&&r.segments.some(s=>['stairs','escalator'].includes(s.kind)))assert.equal(annotatePreferenceResult(r,{need}).luggageCarryRequired,true);
 console.log('PASS',origin.id,'->',destination.id,need,r.totalMinutes,'minutes');
}

// Preserve the previous source-backed positive capability checks separately.
for(const [a,b] of [['HUH:portal:B2-lift','HUH:platform-area:EAL'],['HUH:portal:B2-lift','HUH:platform-area:TML'],['KOW:portal:E1','KOW:platform-area:TCL']])for(const reverse of [false,true]){
 const r=probeEvidence({origin:portal(reverse?b:a),destination:portal(reverse?a:b),departureS:39600,departureDate:'2026-10-11'});
 assert.equal(r.status,'CONDITIONAL');assert.ok(r.legs.some(l=>l.kind==='lift'));assert.ok(!r.legs.some(l=>['stairs','escalator'].includes(l.kind)));
}
// A closed lift or a source barrier must not become allowed by the policy repair.
for (const failure of ['disabled', 'barrier']) {
 const changed=structuredClone(graph);
 for(const e of changed.edges)if(e.region_id==='HUH'&&e.kind==='lift'){
  if(failure==='disabled')e.disabled=true;
  else e.wheelchair_barrier=1;
 }
 const closed=prepare(changed);
 const r=probeEvidence({origin:portal('HUH:portal:B2-lift'),destination:portal('HUH:platform-area:EAL'),departureS:39600,departureDate:'2026-10-11'},closed);
 assert.notEqual(r.status,'CONDITIONAL',`${failure} lifts must remain rejected by evidence probe`);
 console.log('PASS inaccessible lift safety guard:',failure);
}
for(const failure of ['ineligible','closed-hours','direction']){
 const changed=structuredClone(graph),start=portal('HUH:portal:B2-lift').node_id;
 if(failure==='direction')changed.edges=changed.edges.filter(e=>e.from_id!==start);
 else for(const e of changed.edges)if(e.region_id==='HUH'&&e.kind==='lift'){
  if(failure==='ineligible')e.accessible_eligible=false;
  else {e.access_time_id=876543;e.access_schedule={kind:'daily',source_rule_id:876543,timezone:'Asia/Hong_Kong',windows:[]};}
 }
 const closed=prepare(changed);
 const req={origin:portal('HUH:portal:B2-lift'),destination:portal('HUH:platform-area:EAL'),mode:'walk',need:'accessible',departureS:39600,departureDate:'2026-10-11',allowedTransitModes:['metro','bus','tram']};
 const r=probeEvidence(req,closed);assert.notEqual(r.status,'CONDITIONAL',`${failure} evidence guard must remain enforced`);
 if(failure==='direction'){
  const back=probeEvidence({...req,origin:req.destination,destination:req.origin},closed);assert.equal(back.status,'CONDITIONAL','Remaining permitted reverse direction must work');
 }
 console.log('PASS lift safety guard:',failure);
}

const stairRequest={origin:portal('HUH:portal:D6'),destination:portal('HUH:platform-area:EAL'),mode:'walk',departureS:39600,departureDate:'2026-10-11',allowedTransitModes:['metro','bus','tram']};
assert.notEqual(probeEvidence(stairRequest).status,'CONDITIONAL','Stair-only entry does not pass source capability oracle');
for(const need of ['ordinary','accessible','luggage']){
 const r=await f2({...stairRequest,need},station,area,router,undefined,block);
 assert.equal(r.journey?.complete,true,'Ordinary access remains possible, including explicitly migrated legacy input');
 if(need==='luggage')assert.equal(annotatePreferenceResult(r,{need}).luggageCarryRequired,true,'luggage carrying alternative is explicitly labelled');
 console.log('PASS ordinary/migration/carrying stair policy',need);
}
