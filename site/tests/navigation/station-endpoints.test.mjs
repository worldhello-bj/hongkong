import {readFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const root=new URL('../../',import.meta.url).pathname;
globalThis.document={createElement:()=>({relList:{supports:()=>true}})};
const version=JSON.parse(readFileSync(root+'dist/build-meta.json')).version;
const built=path=>pathToFileURL(root+'dist/'+path).href+'?v='+version;
const source=readFileSync(root+'src/navigation/main.recovered.js','utf8');
const head=source.slice(0,source.indexOf('// Removed obsolete straight-line demo ride generator.')).replaceAll(/from\s*"\.\/([^"\n]+)"/g,(_,file)=>'from '+JSON.stringify(built('assets/'+file)));
const {f2,E2}=await import('data:text/javascript;base64,'+Buffer.from(head+'\nexport {f2,E2};').toString('base64'));
const {p:prepare}=await import(built('assets/mobile-navigation-DfEsS_7b.js'));
const read=p=>{const b=readFileSync(p);return JSON.parse(p.endsWith('.gz')?gunzipSync(b):b)};
const graph=read(root+'dist/area/station-graph.json.gz'),station=prepare(graph),area=prepare(read(root+'dist/area/area-graph.json.gz')),block=read(root+'dist/area/admiralty-block-graph.json.gz');
const router=E2(area,read(root+'dist/transit/services.json'),read(root+'dist/transit/walk-links.json.gz'),station);
const {annotatePreferenceResult}=await import('../../src/navigation/preference-routing.js');
const portal=id=>{const p=graph.portals.find(p=>p.id===id);return {...p,lon:p.coordinates[0],lat:p.coordinates[1]}};
for(const [a,b] of [['HUH:portal:B2-lift','HUH:platform-area:EAL'],['HUH:portal:B2-lift','HUH:platform-area:TML'],['KOW:portal:E1','KOW:platform-area:TCL']])for(const reverse of [false,true])for(const need of ['luggage','accessible']){
 const origin=portal(reverse?b:a),destination=portal(reverse?a:b);
 const r=await f2({origin,destination,mode:'walk',need,departureS:39600,departureDate:'2026-10-11',allowedTransitModes:['metro','bus','tram']},station,area,router,undefined,block);
 assert.equal(r.journey?.complete,true,`${origin.id}->${destination.id} ${need}: ${r.message}`);
 assert.ok(r.segments.some(s=>s.kind==='lift'));if(need==='accessible')assert.ok(!r.segments.some(s=>s.kind==='stairs'||s.kind==='escalator'));else if(r.segments.some(s=>['stairs','escalator'].includes(s.kind)))assert.equal(annotatePreferenceResult(r,{need}).luggageCarryRequired,true);
 console.log('PASS',origin.id,'->',destination.id,need,r.totalMinutes,'minutes');
}

// A closed lift or a source barrier must not become allowed by the policy repair.
for (const failure of ['disabled', 'barrier']) {
 const changed=structuredClone(graph);
 for(const e of changed.edges)if(e.region_id==='HUH'&&e.kind==='lift'){
  if(failure==='disabled')e.disabled=true;
  else e.wheelchair_barrier=1;
 }
 const closed=prepare(changed),closedRouter=E2(area,read(root+'dist/transit/services.json'),read(root+'dist/transit/walk-links.json.gz'),closed);
 const r=await f2({origin:portal('HUH:portal:B2-lift'),destination:portal('HUH:platform-area:EAL'),mode:'walk',need:'accessible',departureS:39600,departureDate:'2026-10-11',allowedTransitModes:['metro','bus','tram']},closed,area,closedRouter,undefined,block);
 assert.notEqual(r.journey?.complete,true,`${failure} lifts must remain rejected`);
 console.log('PASS inaccessible lift safety guard:',failure);
}
for(const failure of ['ineligible','closed-hours','direction']){
 const changed=structuredClone(graph),start=portal('HUH:portal:B2-lift').node_id;
 if(failure==='direction')changed.edges=changed.edges.filter(e=>e.from_id!==start);
 else for(const e of changed.edges)if(e.region_id==='HUH'&&e.kind==='lift'){
  if(failure==='ineligible')e.accessible_eligible=false;
  else {e.access_time_id=876543;e.access_schedule={kind:'daily',source_rule_id:876543,timezone:'Asia/Hong_Kong',windows:[]};}
 }
 const closed=prepare(changed),closedRouter=E2(area,read(root+'dist/transit/services.json'),read(root+'dist/transit/walk-links.json.gz'),closed);
 const req={origin:portal('HUH:portal:B2-lift'),destination:portal('HUH:platform-area:EAL'),mode:'walk',need:'accessible',departureS:39600,departureDate:'2026-10-11',allowedTransitModes:['metro','bus','tram']};
 const r=await f2(req,closed,area,closedRouter,undefined,block);assert.notEqual(r.journey?.complete,true,`${failure} guard must remain enforced`);
 if(failure==='direction'){
  const back=await f2({...req,origin:req.destination,destination:req.origin},closed,area,closedRouter,undefined,block);assert.equal(back.journey?.complete,true,'Remaining permitted reverse direction must work');
 }
 console.log('PASS lift safety guard:',failure);
}
for(const need of ['accessible','luggage']){
 const r=await f2({origin:portal('HUH:portal:D6'),destination:portal('HUH:platform-area:EAL'),mode:'walk',need,departureS:39600,departureDate:'2026-10-11',allowedTransitModes:['metro','bus','tram']},station,area,router,undefined,block);
 if(need==='accessible')assert.notEqual(r.journey?.complete,true,'Stair-only entry must remain rejected in strict mode');else if(r.journey?.complete)assert.equal(annotatePreferenceResult(r,{need}).luggageCarryRequired,true,'luggage carrying alternative is explicitly labelled');console.log('PASS stair policy',need);
}
