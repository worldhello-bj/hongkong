/** Bounded candidate-enumeration audit. No route searches or invented feasible journeys. */
import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{gunzipSync}from'node:zlib';
import{taxiInterchangeCandidates}from'../../src/navigation/taxi-candidates.js';
const station=JSON.parse(gunzipSync(readFileSync(new URL('../../dist/area/station-graph.json.gz',import.meta.url)))),services=JSON.parse(readFileSync(new URL('../../dist/transit/services.json',import.meta.url)));
const od36=JSON.parse(readFileSync(new URL('fixtures/land-coverage-72.json',import.meta.url))).rows[35].request;
const portal=station.portals.find(p=>p.id==='AUS:portal:B2'),p={...portal,lon:portal.coordinates[0],lat:portal.coordinates[1]};
const cases=[{name:'seeded OD36',request:od36},{name:'existing covered Hong Kong tail to Austin comparison',request:{origin:{id:'covered-hk-tail',coordinates:[114.1585,22.2803],lon:114.1585,lat:22.2803},destination:p}}];
const distance=(a,b)=>Math.hypot((a.coordinates[0]-b.coordinates[0])*102900,(a.coordinates[1]-b.coordinates[1])*111320);
const rows=[];
for(const item of cases)for(const side of ['first','last']){
 const selected=taxiInterchangeCandidates({station,services,request:item.request,side}),eligible=taxiInterchangeCandidates({station,services,request:item.request,side,limits:{metro:100,bus:100,tram:100}}),other=side==='first'?item.request.destination:item.request.origin;
 const brief=a=>({id:a.id,name:a.name,mode:a.mode,feederStraightMeters:Number(a.distanceM.toFixed(1)),onwardStraightMeters:Number(distance(a,other).toFixed(1)),shortlistHeuristic:Number(a.selectionScore.toFixed(3))});
 const chosen=selected.map(brief),omitted=eligible.filter(a=>!selected.some(b=>a.id===b.id)).map(brief);
 rows.push({case:item.name,side,selected:chosen,omitted:omitted.map(a=>({...a,notDominatedBySelectedCoordinateProxies:!chosen.some(b=>b.mode===a.mode&&b.feederStraightMeters<=a.feederStraightMeters&&b.onwardStraightMeters<=a.onwardStraightMeters&&b.shortlistHeuristic<=a.shortlistHeuristic)}))});
}
const result={runtime:JSON.parse(readFileSync(new URL('../../dist/build-meta.json',import.meta.url))).version,method:'Same production selector; compare existing 2 rail/1 bus/1 tram cap to 100 per-mode candidates after the identical physical/direction filters and 250m spacing. Coordinate proxies and heuristic scores are not actual road fares or proof of a feasible/better route. No coverage or accessibility inference.',rows};
const out=new URL('../../validation/performance/taxi-shortlist-audit.json',import.meta.url);writeFileSync(out,JSON.stringify(result,null,2)+'\n');
for(const row of rows)console.log(JSON.stringify({case:row.case,side:row.side,selected:row.selected.map(x=>x.id),omitted:row.omitted.length,proxyNonDominated:row.omitted.filter(x=>x.notDominatedBySelectedCoordinateProxies).map(x=>x.id)}));
