import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {nearestPedestrianNode,composeTaxiJourney} from '../../src/navigation/taxi-bridge.js';
globalThis.document={createElement:()=>({relList:{supports:()=>true}})};
const version=JSON.parse(readFileSync(new URL('../../dist/build-meta.json',import.meta.url),'utf8')).version;
const built=path=>new URL('../../dist/'+path,import.meta.url).href+'?v='+version;
const source=readFileSync(new URL('../../src/navigation/main.recovered.js',import.meta.url),'utf8');
const head=source.slice(0,source.indexOf('// Removed obsolete straight-line demo ride generator.')).replaceAll(/from\s*"\.\/([^"\n]+)"/g,(_,file)=>'from '+JSON.stringify(built('assets/'+file)));
const {f2,g2,E2,t2}=await import('data:text/javascript;base64,'+Buffer.from(head.replaceAll('import.meta.url',JSON.stringify(built('assets/main-integrated.js')))+'\nexport {f2,g2,E2,t2};').toString('base64'));
const {p:prepare}=await import(built('assets/mobile-navigation-DfEsS_7b.js'));
const {createTaxiSimulation,SCENE}=await import(built('taxi/roaming.js'));
const read=path=>{const b=readFileSync(new URL('../../dist/'+path,import.meta.url));return JSON.parse(path.endsWith('.gz')?gunzipSync(b):b)};
const station=prepare(read('area/station-graph.json.gz')),area=prepare(read('area/area-graph.json.gz')),block=read('area/admiralty-block-graph.json.gz');
const router=E2(area,read('transit/services.json'),read('transit/walk-links.json.gz'),station,g2(area,block));

const requests=JSON.parse(readFileSync(new URL('./fixtures/demo-fallback-requests.json',import.meta.url),'utf8'));
test('expanded data and public selectors retain all original72 test endpoints',()=>{
 const all=JSON.parse(readFileSync(new URL('./fixtures/land-coverage-72.json',import.meta.url),'utf8')).rows;
 for(const {request} of all)for(const p of [request.origin,request.destination])assert.ok(t2(area,p),p.coordinates.join(','));
});
test('KOW C1 reaches outside land with Admiralty detail loaded and exact boundary identity',async()=>{
 const result=await f2(requests[1],station,area,router,undefined,block);assert.equal(result.journey?.complete,true,result.message);console.log('KOW full f2 with detail',result.totalMinutes,result.journey.steps.length);
});
