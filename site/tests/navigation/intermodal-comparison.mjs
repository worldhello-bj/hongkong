// Actual preserved routing bundles + real road simulation. No hand-authored travel times.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {Worker as NodeWorker} from 'node:worker_threads';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {planTaxiCandidates,taxiInterchangeCandidates} from '../../src/navigation/taxi-candidates.js';
import {createModeledConnectorGuard,compatibleWithOverlay,rankJourneys} from '../../src/navigation/integrated-navigation.js';
import {simulatedTaxiFareCents} from '../../src/navigation/route-quote.js';
import {journeyScore} from '../../src/navigation/journey-score.js';
const root=new URL('../../',import.meta.url),base=new URL('dist/',root),read=path=>{const b=readFileSync(new URL(path,base));return JSON.parse(path.endsWith('.gz')?gunzipSync(b):b)};
globalThis.document={createElement:()=>({relList:{supports:()=>true}})};
const workers=new Set();
globalThis.Worker=class {constructor(url){const path=fileURLToPath(new URL(new URL(url).pathname,'file:///'));this.w=new NodeWorker(`const {parentPort}=require('node:worker_threads');globalThis.self=globalThis;globalThis.postMessage=x=>parentPort.postMessage(x);parentPort.on('message',x=>globalThis.onmessage({data:x}));require(${JSON.stringify(path)});`,{eval:true,resourceLimits:{maxOldGenerationSizeMb:384}});workers.add(this);this.w.on('message',data=>this.onmessage?.({data}));this.w.on('error',error=>this.onerror?.(error));}postMessage(x){this.w.postMessage(x)}terminate(){workers.delete(this);return this.w.terminate()}};
let source=readFileSync(new URL('src/navigation/main.recovered.js',root),'utf8');
let head=source.slice(0,source.indexOf('// Removed obsolete straight-line demo ride generator.')).replaceAll(/from\s*"\.\/([^"\n]+)"/g,(_,file)=>'from '+JSON.stringify(new URL(existsSync(new URL('src/navigation/'+file,root))?'src/navigation/'+file:'dist/assets/'+file,root).href)).replaceAll(/new URL\("\/assets\/([^"\n]+)",import.meta.url\)/g,(_,file)=>'new URL('+JSON.stringify(new URL('assets/'+file,base).href)+')');
const {f2,E2,O2}=await import('data:text/javascript;base64,'+Buffer.from(head+'\nexport {f2,E2,O2};').toString('base64'));
const {p:prepare}=await import(new URL('assets/mobile-navigation-DfEsS_7b.js',base));
const taxi=await import(new URL('taxi/roaming.js',base));
const station=prepare(read('area/station-graph.json.gz')),area=prepare(read('area/area-graph.json.gz')),block=read('area/admiralty-block-graph.json.gz'),services=read('transit/services.json'),links=read('transit/walk-links.json.gz');
const router=E2(area,services,links,station),guard=createModeledConnectorGuard({geography:O2,graph:area,detail:block});
const point=(id,c)=>({id,name:id,coordinates:c,lon:c[0],lat:c[1]});
const portal=id=>{const p=station.portals.find(p=>p.id===id);return {...p,lon:p.coordinates[0],lat:p.coordinates[1]}};
const stop=id=>{const p=services.stops.find(p=>p.id===id);return {...p,lon:p.coordinates[0],lat:p.coordinates[1]}};
const westTail=area.nodes.filter(n=>n.coordinates[0]<114.157&&n.coordinates[1]>22.3005&&n.coordinates[1]<22.309&&Math.abs(n.coordinates[2]??0)<15).sort((a,b)=>Math.hypot(a.coordinates[0]-114.152,a.coordinates[1]-22.306)-Math.hypot(b.coordinates[0]-114.152,b.coordinates[1]-22.306))[0];
const tailPoint=westTail?{...point('已覆盖西九步道节点 '+westTail.id,westTail.coordinates),node_id:westTail.id}:null;
const specs=[
 ['覆盖走廊金钟至柯士甸',portal('ADM:portal:E2'),portal('AUS:portal:B2')],
 ['覆盖走廊柯士甸至金钟',portal('AUS:portal:B2'),portal('ADM:portal:E2')],
 ['覆盖走廊港岛接驳至柯士甸',point('金钟西侧街道',[114.1585,22.2803]),portal('AUS:portal:B2')],
 ['覆盖电车走廊',stop('td:99211'),stop('td:99227')],
 ['覆盖九龙公交走廊',stop('td:4025'),stop('td:4265')],
 ['缺失荃湾线诊断金钟至旺角',portal('ADM:portal:E2'),point('旺角',[114.16839,22.3179])],
 ['覆盖长尾金钟至西九步道',portal('ADM:portal:E2'),tailPoint],
 ['覆盖长尾西九步道至金钟',tailPoint,portal('ADM:portal:E2')]
];
const fare=new Function('simulatedTaxiFareCents','c2',source.slice(source.indexOf('function W2(e)'),source.indexOf('const V2=',source.indexOf('function W2(e)')))+';return W2;')(simulatedTaxiFareCents,(v,max)=>v===undefined?0:Number.isFinite(v)&&v>=0&&v<=max?v:(()=>{throw Error('bad metric')})());
function summarize(id,result){
 const cost=result.segments?.reduce((sum,s)=>sum+fare({mode:s.kind==='rail'?'metro':['metro','bus','tram','taxi'].includes(s.kind)?s.kind:'walk',distanceM:s.distanceM,durationMinutes:s.minutes,harbourTunnel:s.harbourTunnel}),0)/100;
 const choice={id,available:!!result.journey?.complete,minutes:result.totalMinutes,cost,walkMinutes:result.walkMinutes,transfers:result.transfers,result};
 const breakdown=Object.fromEntries(['walk','station','wait','ride','taxi'].map(k=>[k,0]));
 for(const leg of result.segments??[]){const key=leg.kind==='wait'?'wait':['rail','metro','bus','tram'].includes(leg.kind)?'ride':leg.kind==='taxi'?'taxi':['lift','stairs','escalator','travelator','station_access','transfer'].includes(leg.kind)?'station':'walk';breakdown[key]+=leg.minutes??0;}
 return {choice,row:{id,breakdown,legs:result.segments?.map(s=>({kind:s.kind,label:s.label,minutes:s.minutes,distanceM:s.distanceM})),kind:result.taxiCandidateKind??'public',available:choice.available,minutes:choice.minutes,cost,walkMinutes:choice.walkMinutes,waitMinutes:result.waitMinutes??0,transfers:choice.transfers,modes:result.segments?.map(s=>s.kind).filter((m,i,a)=>i===0||m!==a[i-1]),anchor:result.transferAnchor,score:journeyScore(choice).total,simulationOnly:!!result.simulationOnly,message:result.message}};
}
const report={runtime:read('build-meta.json').version,departureDate:'2026-10-12',departureS:39600,method:'Actual production f2 + routing Worker bundles and seeded 48-car road simulation; not browser QA; all fares/schedules/vehicles remain simulation',rows:[]};
try{
 for(const [name,origin,destination]of specs){
  if(process.env.HK_COMPARE&&name!==process.env.HK_COMPARE)continue;
  const start=performance.now(),request={origin,destination,departureS:39600,departureDate:report.departureDate,need:process.env.HK_NEED??'ordinary',mode:'transit',allowedTransitModes:['metro','bus','tram']};
  const row={name,request,candidates:[],diagnostics:[],shortlist:{first:taxiInterchangeCandidates({station,services,request,side:'first'}).map(p=>({id:p.id,mode:p.mode})),last:taxiInterchangeCandidates({station,services,request,side:'last'}).map(p=>({id:p.id,mode:p.mode}))}};report.rows.push(row);const choices=[];
  console.log('START',name);
  const publicRoute=async(origin,destination,departureS,mode='all')=>{
   const result=await f2({...request,origin,destination,departureS,mode:'transit',allowedTransitModes:['all','metro'].includes(mode)?['metro','bus','tram']:[mode]},station,area,router,undefined,block);
   return result.journey?.complete&&compatibleWithOverlay(result,area,block)?result:null;
  };
  for(const mode of ['all']){const result=await publicRoute(origin,destination,request.departureS,mode);if(result){const summary=summarize('public-'+mode,result);choices.push(summary.choice);row.candidates.push(summary.row);console.log('CANDIDATE',name,JSON.stringify(summary.row));}}
  const sim=taxi.createTaxiSimulation({fleetSize:48,nowS:request.departureS});
  const findRoad=point=>{const v=taxi.nearestRoadNode(point.coordinates);return v?.covered===false?null:v;};
  const ask=(pickup,destination,passengerReadyS)=>{try{const q=sim.offerQuotes({pickup,destination,passengerReadyS,nowS:request.departureS})[0];if(q)q.harbourTunnel=q.passengerRoute.edges.some(e=>/海底隧道|Harbour Crossing|Cross-Harbour/i.test(taxi.ROAD_GRAPH.ways[e.way]?.name??''));return q;}catch{return null;}};
  row.taxiStatus=await planTaxiCandidates({request,station,services,graph:area,findRoad,ask,publicRoute,isLinkAllowed:guard,onDiagnostic:d=>row.diagnostics.push(d),publish:(id,title,result)=>{const summary=summarize(id,result);choices.push(summary.choice);row.candidates.push({...summary.row,title});console.log('CANDIDATE',name,JSON.stringify(summary.row));}});
  row.rankings=Object.fromEntries(['time','cost','walk'].map(priority=>[priority,rankJourneys(choices,priority,request.need).map(c=>c.id)]));
  row.priceWeightSensitivity=[0,.25,.5,.75,1,2].map(costWeight=>({costWeight,winner:[...choices].sort((a,b)=>journeyScore(a,'time',request.need,{cost:costWeight}).total-journeyScore(b,'time',request.need,{cost:costWeight}).total)[0]?.id}));
  row.taxiPriceSensitivity=[.5,1,1.5,2,3].map(factor=>{const alternatives=choices.map(c=>{const taxiCents=c.result.segments.filter(s=>s.kind==='taxi').reduce((sum,s)=>sum+simulatedTaxiFareCents(s),0);return {...c,cost:c.cost+(factor-1)*taxiCents/100};});return {factor,winner:rankJourneys(alternatives,'time',request.need)[0]?.id};});
  row.ms=Math.round(performance.now()-start);writeFileSync(process.env.HK_REPORT_PATH??new URL('../../intermodal-comparison-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log('DONE',name,row.ms,row.rankings,row.taxiStatus);
 }
}finally{router.dispose();for(const worker of workers)worker.terminate();}
