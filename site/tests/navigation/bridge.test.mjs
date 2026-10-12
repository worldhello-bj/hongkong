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
const {f2,g2,E2}=await import('data:text/javascript;base64,'+Buffer.from(head.replaceAll('import.meta.url',JSON.stringify(built('assets/main-integrated.js')))+'\nexport {f2,g2,E2};').toString('base64'));
const {p:prepare}=await import(built('assets/mobile-navigation-DfEsS_7b.js'));
const {createTaxiSimulation,SCENE}=await import(built('taxi/roaming.js'));
const read=path=>{const b=readFileSync(new URL('../../dist/'+path,import.meta.url));return JSON.parse(path.endsWith('.gz')?gunzipSync(b):b)};
const station=prepare(read('area/station-graph.json.gz')),area=prepare(read('area/area-graph.json.gz')),block=read('area/admiralty-block-graph.json.gz');
const router=E2(area,read('transit/services.json'),read('transit/walk-links.json.gz'),station,g2(area,block));
const portal=station.portals.find(p=>p.id==='AUS:portal:B2');
const node=station.nodes.find(n=>n.id===portal.node_id);
const pickup={node,distanceM:55,point:{id:portal.id,node_id:node.id,name:'柯士甸 B2',coordinates:node.coordinates,lon:node.coordinates[0],lat:node.coordinates[1]}},dropoff=nearestPedestrianNode(area,SCENE.destination.coordinate);
let prefix,request;
test('public prefix reaches actual graph node beside pickup, not silently snapped road',async()=>{
 const p=station.portals.find(p=>p.id==='ADM:portal:E2');
 request={origin:{id:p.id,name:'金钟 E2',coordinates:p.coordinates,lon:p.coordinates[0],lat:p.coordinates[1],node_id:p.node_id},destination:{id:'taxi-scene-destination',name:'M+ 接送区道路点',coordinates:SCENE.destination.coordinate},mode:'transit',need:'ordinary',departureS:28800,departureDate:'2026-10-11',allowedTransitModes:['metro','bus','tram']};
 prefix=await f2({...request,destination:pickup.point,mode:"metro"},station,area,router,undefined,block);
 assert.equal(prefix.journey?.complete,true,prefix.message);assert.ok(prefix.totalMinutes>0);prefix.arrivalS??=28800+prefix.totalMinutes*60;
 console.log('Taxi public prefix',prefix.totalMinutes,'minutes, pickup gap',pickup.distanceM,'m');
});
test('taxi matches real public arrival and explicit curb link; prototype stays scenario-only',()=>{
 assert.ok(prefix?.journey?.complete);pickup.durationS=30;dropoff.durationS=30;
 const sim=createTaxiSimulation({nowS:request.departureS});
 const quote=sim.offerQuotes({passengerReadyS:prefix.arrivalS+30,nowS:request.departureS})[0];
 const result=composeTaxiJourney({request,prefix,quote,pickupLink:pickup,dropoffLink:dropoff,scene:SCENE,graph:area});
 assert.equal(result.scenarioOnly,true);assert.equal(result.simulationOnly,true);assert.equal(result.journey.complete,true);
 assert.ok(result.segments.some(s=>s.kind==='taxi'));assert.ok(result.segments.some(s=>s.label.includes('到预约上客点')));
 assert.ok(result.lines.some(s=>s.kind==='taxi'&&s.coordinates.length>5));assert.equal(quote.passengerReadyS,prefix.arrivalS+30);
 assert.ok(result.warnings.some(w=>w.includes('不保证现实全程可通行')));
});
test('in-flight transit Worker is terminated on cancel and next query starts fresh',async()=>{
 const saved=globalThis.Worker,workers=[];
 class FakeWorker{constructor(){this.terminated=false;workers.push(this)}postMessage(message){this.message=message}terminate(){this.terminated=true}}
 globalThis.Worker=FakeWorker;
 try{
  const workerRouter=E2(area,read('transit/services.json'),read('transit/walk-links.json.gz'),station);
  const controller=new AbortController(),pending=workerRouter.route({departureS:28800},controller.signal);
  controller.abort();await assert.rejects(pending,{name:'AbortError'});assert.equal(workers[0].terminated,true);
  const second=new AbortController(),next=workerRouter.route({departureS:28800},second.signal);
  assert.equal(workers.length,2);assert.ok(workers[1].message.inputs);second.abort();await assert.rejects(next,{name:'AbortError'});
 }finally{if(saved===undefined)delete globalThis.Worker;else globalThis.Worker=saved;}
});
