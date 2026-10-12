import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {createModeledConnectorGuard,parseContextRings,addShortDemoConnectors} from '../../src/navigation/integrated-navigation.js';
const land={kind:'green',d:'M0,0L10,0L10,10L0,10Z'},water={kind:'water',d:'M2,2L8,2L8,8L2,8Z M4,4L6,4L6,6L4,6Z'};
test('whole-segment guard rejects water and honors evenodd islands',()=>{
 const allow=createModeledConnectorGuard({geography:[land,water],project:p=>p});
 assert.equal(allow([.2,1],[9.5,1]),true);assert.equal(allow([.2,5],[9.5,5]),false);
 assert.equal(allow([4.2,5],[5.8,5]),true);assert.equal(allow([4.2,5],[9,5]),false);
 assert.equal(allow([2,3],[1,3]),false);assert.equal(allow([-1,1],[1,1]),false);
 const thin=createModeledConnectorGuard({geography:[land,{kind:'water',d:'M5,0L5.001,0L5.001,10L5,10Z'}],project:p=>p});assert.equal(thin([1,1],[9,1]),false);
});
test('known disabled edges and explicit physical closures remain barriers',()=>{
 for(const closed of ['disabled','closure']){
  const graph={edges:[{physical_id:'closed',disabled:closed==='disabled',coordinates:[[1,1],[1,9]]}],closures:closed==='closure'?[{physical_ids:['closed']}]:[]};
  const allow=createModeledConnectorGuard({geography:[land,water],graph,project:p=>p});assert.equal(allow([.5,1.5],[1.5,1.5]),false);assert.equal(allow([.1,.1],[.9,.1]),true);
 }
});
test('missing or malformed geometry fails closed',()=>{
 assert.equal(createModeledConnectorGuard()([0,0],[1,1]),false);
 assert.equal(parseContextRings('M0,0C1,1,2,2,3,3Z'),null);
 assert.equal(createModeledConnectorGuard({geography:[land,{kind:'water',d:'M0,0C1,1,2,2,3,3Z'}],project:p=>p})([0,0],[1,1]),false);
});
function fixture(need='ordinary'){
 const a=[114.1649153345,22.3054339736],b=[a[0]+121.617/102900,a[1]];
 return {journey:{complete:false,knownMinutes:2,steps:[{blocked:true,guidance:{leg_index:0}}]},route:{total_minutes:2,legs:[{kind:'access_connector',distance_m:121.617,minutes:121.617/72}]},request:{need,origin:{coordinates:a},destination:{coordinates:b}}};
}
test('121m ordinary land gap is explicit and timed; no arbitrary100m cut',()=>{
 const f=fixture();assert.equal(addShortDemoConnectors(f.journey,f.route,f.request,{isConnectorAllowed:()=>true}),true);
 assert.equal(f.route.total_minutes,2);assert.equal(f.journey.knownMinutes,2);assert.equal(f.route.legs[0].minutes,121.617/72);
 assert.equal(f.journey.demoConnectors,true);assert.match(f.journey.steps[0].guidance.instruction,/122 米/);assert.match(f.journey.steps[0].guidance.instruction,/2 分钟/);assert.match(f.journey.steps[0].guidance.instruction,/未实地核验/);assert.equal(f.journey.steps[0].guidance.geometry_mode,'schematic');
});
test('strict profiles and unknown/blocked geometry never become certified',()=>{
 for(const need of ['accessible']){const f=fixture(need);assert.equal(addShortDemoConnectors(f.journey,f.route,f.request,{isConnectorAllowed:()=>true}),false);assert.equal(f.journey.complete,false);}
 for(const context of [{},{isConnectorAllowed:()=>false}]){const f=fixture();assert.equal(addShortDemoConnectors(f.journey,f.route,f.request,context),false);assert.equal(f.journey.steps[0].blocked,true);}
});
test('real rendered Hong Kong water context rejects cross-harbour chords',()=>{
 const source=readFileSync(new URL('../../src/navigation/main.recovered.js',import.meta.url),'utf8');
 const start=source.indexOf('const O2=')+'const O2='.length,end=source.indexOf('],g1=new WeakMap',start)+1;
 assert.ok(start>8&&end>start);const geography=Function('return ('+source.slice(start,end)+')')();
 const allow=createModeledConnectorGuard({geography});assert.equal(allow([114.165,22.282],[114.165,22.305]),false);assert.equal(allow([114.1649153345,22.3054339736],[114.166,22.30545]),true);
});
