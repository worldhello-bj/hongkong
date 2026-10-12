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
const portal=id=>{const p=graph.portals.find(p=>p.id===id);return {...p,lon:p.coordinates[0],lat:p.coordinates[1]}};
const cases=read(root+'tests/navigation/fixtures/huh-identity-requests.json');
for(const {id,request} of cases){
 const r=await f2(request,station,area,router,undefined,block);
 assert.equal(r.journey?.complete,true,`HUH case ${id}: ${r.message}`);
 assert.equal(r.journey.demoConnectors,true,'Estimated outdoor connectors remain explicitly modeled');
 assert.ok(!r.segments.some(s=>s.kind==='station_access'),'No unverified station-access placeholder survives');
 assert.ok(r.segments.some(s=>['rail','bus','tram'].includes(s.kind)));
 console.log('PASS actual HUH identity route',id,r.totalMinutes,'minutes');
}
