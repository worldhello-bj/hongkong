import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {readFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';import {performance} from 'node:perf_hooks';
if(isMainThread){
 for(const configuration of ['metro','transit-base','transit-detailed','walk']){
  const started=performance.now();const worker=new Worker(new URL(import.meta.url),{workerData:configuration});
  await new Promise(resolve=>{const timer=setTimeout(()=>{console.log(JSON.stringify({configuration,status:'TIME_BUDGET',wallMs:Math.round(performance.now()-started)}));worker.terminate();resolve()},12000);
   worker.on('message',message=>{console.log(JSON.stringify({...message,configuration}));if(message.phase==='route'){clearTimeout(timer);worker.terminate();resolve()}});
   worker.on('error',e=>{clearTimeout(timer);console.log(e.message);resolve()});
  });
 }
}else{
 globalThis.document={createElement:()=>({relList:{supports:()=>true}})};
const version=JSON.parse(readFileSync(new URL('../../dist/build-meta.json',import.meta.url),'utf8')).version;
const built=path=>new URL('../../dist/'+path,import.meta.url).href+'?v='+version;
 let started=performance.now();
 const source=readFileSync(new URL('../../src/navigation/main.recovered.js',import.meta.url),'utf8');
 const head=source.slice(0,source.indexOf('// Removed obsolete straight-line demo ride generator.')).replaceAll(/from\s*"\.\/([^"\n]+)"/g,(_,file)=>'from '+JSON.stringify(built('assets/'+file)));
 const {f2,g2,E2}=await import('data:text/javascript;base64,'+Buffer.from(head+'\nexport {f2,g2,E2};').toString('base64'));
 const {p:prepare}=await import(built('assets/mobile-navigation-DfEsS_7b.js'));
 const read=path=>{const b=readFileSync(new URL('../../dist/'+path,import.meta.url));return JSON.parse(path.endsWith('.gz')?gunzipSync(b):b)};
 const station=prepare(read('area/station-graph.json.gz')),area=prepare(read('area/area-graph.json.gz')),block=read('area/admiralty-block-graph.json.gz');
 const services=read('transit/services.json'),links=read('transit/walk-links.json.gz');
 const router=E2(area,services,links,station,workerData==='transit-detailed'?g2(area,block):undefined);
 parentPort.postMessage({phase:'setup',durationMs:Math.round(performance.now()-started)});started=performance.now();
 const p=id=>{const n=station.portals.find(x=>x.id===id);return {id,name:id,coordinates:n.coordinates,lon:n.coordinates[0],lat:n.coordinates[1],node_id:n.node_id}};
 const result=await f2({origin:p('ADM:portal:E2'),destination:p('AUS:portal:B2'),mode:workerData.startsWith('transit')?'transit':workerData,need:'ordinary',departureS:28800,departureDate:'2026-10-11',allowedTransitModes:['metro','bus','tram']},station,area,router,undefined,block);
 parentPort.postMessage({phase:'route',durationMs:Math.round(performance.now()-started),complete:result.journey?.complete??false,minutes:result.totalMinutes,message:result.message});
}
