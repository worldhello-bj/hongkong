import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
globalThis.document={createElement:()=>({relList:{supports:()=>true}})};
const version=JSON.parse(readFileSync(new URL('../../dist/build-meta.json',import.meta.url),'utf8')).version;
const built=path=>new URL('../../dist/'+path,import.meta.url).href+'?v='+version;
const {b:buildRouter} = await import(built('assets/intermodal-routing-D8vKT-lN.js'));
const {p:prepare}=await import(built('assets/mobile-navigation-DfEsS_7b.js'));
const root=new URL('../../dist/',import.meta.url);
const read=(path)=>{const bytes=readFileSync(new URL(path,root));return JSON.parse(path.endsWith('.gz')?gunzipSync(bytes):bytes)};
const area=prepare(read('area/area-graph.json.gz'));
const station=prepare(read('area/station-graph.json.gz'));
const services=read('transit/services.json');
const links=read('transit/walk-links.json.gz');
const router=buildRouter(area,services,links,station);
const point=id=>{const p=area.portals.find(x=>x.id===id);assert.ok(p,id);return {lon:p.coordinates[0],lat:p.coordinates[1],coordinates:p.coordinates,node_id:p.node_id}};
test('latest city graph retained rather than old small prototype',()=>{assert.ok(area.nodes.length>50000);assert.ok(station.nodes.length>5000);assert.ok(router.network.patterns.some(p=>p.mode==='tram'));assert.ok(router.network.patterns.some(p=>p.mode==='bus'));assert.ok(router.network.patterns.some(p=>p.mode==='metro'))});
test('strict accessibility remains guarded rather than silently substituting ordinary route',async()=>{
 const result=await router.route({origin:point('ADM:portal:E2'),destination:point('AUS:portal:B2'),departureS:28800,departureDate:'2026-10-11',preference:'accessible',allowedModes:['metro','bus','tram']});
 assert.equal(result.status,'NO_ROUTE');assert.match(result.message,/无障碍/);
});
test('cancellation preserved',async()=>{const controller=new AbortController();controller.abort();await assert.rejects(router.route({origin:point('ADM:portal:E2'),destination:point('AUS:portal:B2'),departureS:28800},controller.signal),{name:'AbortError'})});
test('public multimodal engine returns clock-aware journey and actual service anchors',async()=>{
 const result=await router.route({origin:point('ADM:portal:E2'),destination:point('AUS:portal:B2'),departureS:28800,departureDate:'2026-10-11',preference:'fast',allowedModes:['metro','bus','tram']});
 assert.equal(result.status,'CONDITIONAL',result.message);assert.ok(result.arrivalS>28800);assert.ok(result.timedLegs.length);assert.ok(result.legs.some(l=>l.kind==='rail'));assert.ok(result.legs.some(l=>!['rail','wait'].includes(l.kind)));
 console.log('Verified real graph route:',result.total_minutes,'minutes;',result.legs.map(l=>l.kind).join(' → '));
});
test('same-shore public preset has a complete route in loaded source graph',async()=>{
 const result=await router.route({origin:point('AUS:portal:B2'),destination:point('HUH:portal:A3'),departureS:39600,departureDate:'2026-10-11',preference:'fast',allowedModes:['metro','bus','tram']});
 assert.equal(result.status,'CONDITIONAL',result.message);console.log('Same-shore preset:',result.total_minutes,result.legs.map(l=>l.kind).join(' → '));
});
