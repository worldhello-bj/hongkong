import{readFileSync,writeFileSync}from'node:fs';
import{fileURLToPath,pathToFileURL}from'node:url';
export const routeMemoryAssets=['app-transit-worker-CaCMeUxU.js','intermodal-routing-D8vKT-lN.js'];
const begin='\n/* HK_ROUTE_MEMORY_V1_BEGIN */\n',end='/* HK_ROUTE_MEMORY_V1_END */\n';
let helper=readFileSync(new URL('../src/navigation/route-memory.js',import.meta.url),'utf8').replaceAll('export function ','function ');
for(const [from,to]of Object.entries({routeMemo:'__hkRouteMemo',connectionEvidence:'__hkConnectionEvidence',indoorGraph:'__hkIndoorGraph'}))helper=helper.replaceAll(new RegExp('\\b'+from+'\\b','g'),to);
const prefix=begin+helper+end;
const configs=[
 {test:'function Lt(t){',station:'s=new Map,c=r=>',stationNew:n=>`s=__hkRouteMemo(${n}),c=r=>`,memo:'ae=new Map,le=(l,L)=>',memoNew:n=>`ae=__hkRouteMemo(${n},_e,R),le=(l,L)=>`,evidence:'_e.get(Se(l.connectionId,l.departureS))??ge.get(l.connectionId)',evidenceNew:'__hkConnectionEvidence(_e,ae,ge,R,l,le,Se,oe)',graph:'{...t,regions:t.regions.filter(y=>y.id===P),nodes:B,edges:t.edges.filter(y=>y.region_id===P&&y.source_id==="CSDI-INDOOR"&&y.geometry_mode==="official"&&O.has(y.from_id)&&O.has(y.to_id)),portals:B.map(y=>({id:"EXACT:"+y.id,node_id:y.id,name:"官方站内节点",region_id:P,coordinates:y.coordinates,offset_m:0}))}',graphNew:'__hkIndoorGraph(t,P,B,O)'},
 {test:'function Ye(o){',station:'n=new Map,d=u=>',stationNew:n=>`n=__hkRouteMemo(${n}),d=u=>`,memo:'te=new Map,Q=(a,D)=>',memoNew:n=>`te=__hkRouteMemo(${n},le,S),Q=(a,D)=>`,evidence:'le.get(ue(a.connectionId,a.departureS))??ce.get(a.connectionId)',evidenceNew:'__hkConnectionEvidence(le,te,ce,S,a,Q,ue,j)',graph:'{...o,regions:o.regions.filter(O=>O.id===x),nodes:F,edges:o.edges.filter(O=>O.region_id===x&&O.source_id==="CSDI-INDOOR"&&O.geometry_mode==="official"&&se.has(O.from_id)&&se.has(O.to_id)),portals:F.map(O=>({id:"EXACT:"+O.id,node_id:O.id,name:"官方站内节点",region_id:x,coordinates:O.coordinates,offset_m:0}))}',graphNew:'__hkIndoorGraph(o,x,F,se)'}
];
function config(source){const choices=configs.filter(c=>source.includes(c.test));if(choices.length!==1)throw Error('Route-memory engine anchor drift');return choices[0]}
function once(source,old,next){if(source.split(old).length!==2)throw Error('Route-memory patch anchor drift: '+old.slice(0,70));return source.replace(old,next)}
function stripHelper(source){const start=source.indexOf(begin),finish=source.indexOf(end,start);if(start<0||finish<0)throw Error('Route-memory helper marker drift');return source.slice(0,start)+source.slice(finish+end.length)}
export function restoreRouteMemory(source){
 if(!source.includes(begin))return source;
 source=stripHelper(source);const c=config(source);
 const station=source.match(c===configs[0]?/s=__hkRouteMemo\(\d+\),c=r=>/:/n=__hkRouteMemo\(\d+\),d=u=>/);
 const memo=source.match(c===configs[0]?/ae=__hkRouteMemo\(\d+,_e,R\),le=\(l,L\)=>/:/te=__hkRouteMemo\(\d+,le,S\),Q=\(a,D\)=>/);
 if(!station||!memo)throw Error('Route-memory restore anchor drift');
 source=once(source,station[0],c.station);source=once(source,memo[0],c.memo);source=once(source,c.evidenceNew,c.evidence);
 if(source.includes(c.graphNew))source=once(source,c.graphNew,c.graph);
 return source;
}
export function patchRouteMemory(source,{connectionLimit=64,stationLimit=64,sparsePortals=true}={}){
 for(const value of[connectionLimit,stationLimit])if(!Number.isInteger(value)||value<1)throw new RangeError('Invalid route memo capacity');
 const original=source;source=restoreRouteMemory(source);const c=config(source);
 source=once(source,c.station,c.stationNew(stationLimit));source=once(source,c.memo,c.memoNew(connectionLimit));source=once(source,c.evidence,c.evidenceNew);
 if(sparsePortals)source=once(source,c.graph,c.graphNew);
 source=source+prefix;return{source,changes:source===original?0:1};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const root=process.argv[2]??fileURLToPath(new URL('../',import.meta.url));for(const file of routeMemoryAssets){const path=root+'/dist/assets/'+file,result=patchRouteMemory(readFileSync(path,'utf8'));if(result.changes)writeFileSync(path,result.source);console.log(file+': '+result.changes+' route result retention changes')}
}
