import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {earliestOpenWait} from '../../src/navigation/fifo-wait.js';
globalThis.document={createElement:()=>({relList:{supports:()=>true}})};
const version=JSON.parse(readFileSync(new URL('../../dist/build-meta.json',import.meta.url),'utf8')).version;
const {d:route,p:prepare,t:canTraverse,q:openingTimes}=await import(new URL('../../dist/assets/mobile-navigation-DfEsS_7b.js',import.meta.url).href+'?v='+version);
const schedule=(windows,kind='daily')=>({access_time_id:'test',access_schedule:{source_rule_id:'test',kind,windows:windows.map(([start_s,end_s])=>({start_s,end_s}))}});
const calc=(edge,arrivalS,durationS,destination,horizonS=14400,date='2026-10-11')=>earliestOpenWait({edge,destination,arrivalS,durationS,horizonS,date,canTraverse,openingTimes});
test('opening waits respect traversal, closing, midnight, calendar, destination and horizon',()=>{
 assert.equal(calc(schedule([[100,200]]),90,20),10);
 assert.equal(calc(schedule([[100,200]]),190,20),null);
 assert.equal(calc(schedule([[100,200]]),180,20),0);
 assert.equal(calc(schedule([[100,200]]),200,0),null);
 assert.equal(calc(schedule([[0,100],[86300,86400]]),86390,30),0);
 assert.equal(calc(schedule([[0,100]],'weekly'),86390,30,null,14400,'2026-10-11'),10);
 assert.equal(calc(schedule([[100,200]]),90,20,schedule([[190,210]])),80);
 assert.equal(calc(schedule([[100,150]]),90,20,schedule([[190,210]])),null);
 assert.equal(calc(schedule([[14400,14500]]),0,0,null),14400);
 assert.equal(calc(schedule([[14400,14500]]),0,0.001,null),null);
 assert.equal(calc(schedule([[0,100]],'weekly'),0,1,null,100,null),null);
});
test('deterministic window oracle exhaustively checks 2000 generated cases',()=>{
 let seed=73591;const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n};
 for(let q=0;q<2000;q++){
  const windows=()=>Array.from({length:3},()=>{const a=random(100),b=random(100);return[Math.min(a,b),Math.max(a,b)+1]});
  const e=schedule(windows()),d=schedule(windows()),t=random(100),duration=random(20);let expected=null;
  for(let wait=0;wait+duration<=100;wait++)if(canTraverse(e,t+wait,duration,'2026-10-11')&&canTraverse(d,t+wait+duration,0,'2026-10-11')){expected=wait;break}
  assert.equal(calc(e,t,duration,d,100),expected,'generated case '+q);
 }
});
function fixture({noWait=false,disabled=false,facility=false,unscheduled=false}={}){
 const coordinates={s:[114.16,22.28],u:[114.1601,22.2801],v:[114.1602,22.28],t:[114.1603,22.28]};
 const nodes=Object.entries(coordinates).map(([id,coordinates])=>({id,coordinates,region_id:'R',...(noWait&&id==='v'?{wait_allowed:false}:{})}));
 const edge=(id,from,to,duration,extra={})=>({id,physical_id:id,from_id:from,to_id:to,region_id:'R',kind:'walk',name:id,length_m:duration,duration_s:duration,coordinates:[coordinates[from],coordinates[to]],geometry_mode:'official',snap_eligible:true,accessible_eligible:true,disabled:false,source_id:'TEST',...extra});
 const edges=unscheduled?[edge('long','s','t',15000)]:[
  edge('direct','s','v',facility?5:10,facility?{kind:'stairs'}:{}),edge('via-u','s','u',facility?5:10),edge('via-v','u','v',facility?5:10),
  edge('gate','v','t',facility?1:5,{...schedule(facility?[[0,8]]:[[20,100]]),disabled})];
 const graph=prepare({regions:[{id:'R',center:coordinates.s,radius_m:10000}],nodes,edges,portals:['s','t'].map(id=>({id,node_id:id,region_id:'R',coordinates:coordinates[id]}))});
 const point=id=>({lon:coordinates[id][0],lat:coordinates[id][1],node_id:id});
 return route(graph,{origin:point('s'),destination:point('t'),preference:facility?'few_stairs':'fast',mode:'walk',departureS:0,departureDate:'2026-10-11'});
}
test('real engine reconstructs paid wait and keeps earliest fast arrival',()=>{
 const result=fixture();assert.equal(result.status,'CONDITIONAL',result.message);
 assert.equal(result.total_minutes,Number((25/60).toFixed(6)));
 assert.equal(result.recommendation_cost_seconds,25);
 assert.ok(result.legs.some(leg=>leg.kind==='wait'&&Math.abs(leg.minutes-10/60)<1e-6));
 assert.ok(result.legs.some(leg=>leg.edge_ids.includes('direct')));
 assert.ok(Math.abs(result.legs.reduce((sum,leg)=>sum+leg.minutes,0)-result.total_minutes)<2e-6);
});
test('no-wait node preserves later arrival needed for gate',()=>{
 const result=fixture({noWait:true});assert.equal(result.status,'CONDITIONAL',result.message);
 assert.ok(!result.legs.some(leg=>leg.kind==='wait'));
 assert.ok(result.legs.some(leg=>leg.edge_ids.includes('via-u')));
 assert.equal(result.total_minutes,Number((25/60).toFixed(6)));
});
test('disabled scheduled edge cannot be reopened by waiting',()=>assert.equal(fixture({disabled:true}).status,'NO_ROUTE'));
test('facility preference preserves earlier expensive state needed before closing',()=>{
 const result=fixture({facility:true});assert.equal(result.status,'CONDITIONAL',result.message);
 assert.equal(result.recommendation_cost_seconds,16);assert.equal(result.total_minutes,0.1);
 assert.ok(result.legs.some(leg=>leg.edge_ids.includes('direct')));
});
test('unscheduled route retains support beyond scheduled four-hour horizon',()=>{
 const result=fixture({unscheduled:true});assert.equal(result.status,'CONDITIONAL',result.message);assert.equal(result.total_minutes,250);
});
