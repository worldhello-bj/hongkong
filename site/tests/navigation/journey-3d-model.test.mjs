import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JOURNEY_3D_MODELS, JOURNEY_3D_SOURCES} from '../../src/navigation/journey-3d-data.js';
import {buildJourney3DModel, resolveJourney3DStep, journey3DModelSvg, journey3DModelPanel, createJourney3DModel, JOURNEY_3D_STATIONS} from '../../src/navigation/journey-3d-model.js';
import {planHighSpeedJourney} from '../../src/navigation/highspeed-routing.js';
const north = {fromStopId:'HSR:WEK',toStopId:'HSR:FUT'};
const south = {fromStopId:'HSR:FUT',toStopId:'HSR:WEK'};
const step = (kind, procedure) => ({kind, highSpeedProcedure:procedure});
function fakeHost() {
  const listeners = new Map(), host = {innerHTML:'', addEventListener(type, fn, {signal}) {listeners.set(type,fn);signal.addEventListener('abort',()=>listeners.delete(type));}};
  return {host,listeners,change(control,value) {listeners.get('change')?.({target:{dataset:{j3dControl:control},value}});},click(action,index) {listeners.get('click')?.({target:{closest:()=>({dataset:{j3dAction:action,j3dStage:index}})}});}};
}

test('two immutable display models have documented levels and no geographical or route eligibility claims',()=>{
 assert.deepEqual(JOURNEY_3D_STATIONS.map(s=>s.id),['HSR:WEK','HSR:FUT']);
 assert.deepEqual(buildJourney3DModel('HSR:WEK').floors.map(f=>f.id),['B1','B2','B3','B4']);
 assert.deepEqual(buildJourney3DModel('HSR:FUT').floors.map(f=>f.id),['B1','B2','B3']);
 for(const model of Object.values(JOURNEY_3D_MODELS)) {
  assert(Object.isFrozen(model)); assert(Object.isFrozen(model.nodes[0].displayPoint));
  assert.equal(model.routeEligible,false);assert.equal(model.accessibilityVerified,false);assert.equal(model.surveyed,false);
  assert.equal(model.coordinateSystem,'unitless-display');
  assert(!('edges' in model));assert(!('coordinates' in model));
  for(const node of model.nodes) {assert(!('coordinates' in node));assert.equal(node.routeEligible,false);assert.equal(node.geometryMode,'schematic-ui');assert(model.floors.some(f=>f.id===node.floor));}
  for(const floor of model.floors) assert(JOURNEY_3D_SOURCES[floor.sourceId]);
 }
 for(const value of ['ADM','FUT','constructor','__proto__','<script>',null,undefined]) assert.equal(buildJourney3DModel(value),null);
});

test('northbound and southbound procedures locate only bounded documented floors',()=>{
 for(const [procedure,floors] of [['verification',['B1']],['security',['B1','B3']],['immigration',['B3']],['boarding',['B3','B4']]]) {
  const result=resolveJourney3DStep(step('procedure',procedure),{trip:north});
  assert.equal(result.stationId,'HSR:WEK');assert.equal(result.direction,'departure');assert.deepEqual(result.floorIds,floors);assert.equal(result.routeEligible,false);
 }
 const arrival=resolveJourney3DStep(step('procedure','immigration'),{trip:south});assert.equal(arrival.direction,'arrival');assert.deepEqual(arrival.floorIds,['B4','B2']);
 const fut=resolveJourney3DStep(step('procedure','departure-buffer'),{trip:south});assert.equal(fut.stationId,'HSR:FUT');assert.deepEqual(fut.floorIds,['B2','B3']);
 for(const trip of [north,south]) {const r=resolveJourney3DStep(step('wait','onboard-wait'),{trip});assert.deepEqual(r.nodeIds,['platform']);assert.equal(r.stationId,trip.fromStopId);}
});

test('unknown, nearby, named, transfer, mainline, wait and directionless steps never guess indoor position',()=>{
 for(const candidate of [null,{}, {kind:'procedure',target:'西九龙 B3'},step('walk','verification'),step('transfer','transfer'),step('highspeed','highspeed'),step('wait','wait'),step('procedure','new-procedure'),{kind:'walk',guidance:{geometry:{coordinates:[[114.1648,22.3049,0]]}}}]) assert.equal(resolveJourney3DStep(candidate,{trip:north}),null);
 assert.equal(resolveJourney3DStep(step('procedure','immigration')),null);
 assert.equal(resolveJourney3DStep(step('procedure','verification'),{trip:south}),null);
 assert.equal(resolveJourney3DStep(step('procedure','departure-buffer'),{trip:north}),null);
});

test('both directions and every floor render finite bounded markup with honest schema separation',()=>{
 for(const model of Object.values(JOURNEY_3D_MODELS)) for(const direction of ['departure','arrival']) for(const floor of ['ALL',...model.floors.map(f=>f.id)]) for(const exploded of [true,false]) {
  const svg=journey3DModelSvg(model,{direction,floor,exploded,angle:Infinity,progress:NaN});
  assert.match(svg,/role="img"/);assert.match(svg,/非实测/);assert.doesNotMatch(svg,/NaN|Infinity|undefined/);
  const layers=[...svg.matchAll(/data-model-floor="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(layers.length,floor==='ALL'?model.floors.length:1);if(floor!=='ALL') assert.deepEqual(layers,[floor]);
 }
 assert.doesNotMatch(journey3DModelSvg(buildJourney3DModel('HSR:FUT'),{direction:'arrival'}),/data-procedure-link/,'unverified Futian arrival path has no connector');
 assert.match(journey3DModelSvg(null),/暂不可用/);
});

test('rendered text is escaped and sources remain explicit, historical and externally safe',()=>{
 const model=structuredClone(buildJourney3DModel('HSR:WEK'));
 model.name='<img src=x onerror="alert(1)">';model.nodes[0].label='<script>alert(1)</script>';model.floors[0].label='" onload="bad';
 const html=journey3DModelPanel(model,{notice:'<script>bad</script>'});
 assert.doesNotMatch(html,/<img|<script| onload="bad/);assert.match(html,/&lt;img/);
 assert.match(html,/noopener noreferrer/);assert.match(html,/geometry|程序化/);assert.match(html,/非步行通道/);
 assert.match(journey3DModelPanel(buildJourney3DModel('HSR:FUT')),/2015 年/);
 const css=readFileSync(new URL('../../src/navigation/journey-3d-model.css',import.meta.url),'utf8');
 assert.match(css,/prefers-reduced-motion/);assert.match(css,/min-height:44px/);assert.match(css,/:focus-visible/);
});

test('host-only UI supports repeated switching, floor focus, progress, unknown reset and cleanup',()=>{
 const f=fakeHost();const choices=[];const view=createJourney3DModel(f.host,{onStationChange:id=>choices.push(id)});
 assert.match(f.host.innerHTML,/香港西九龙/);assert.equal(view.focusFloor('B3'),true);assert.equal(view.focusFloor('MISSING'),false);
 assert.match(f.host.innerHTML,/<option value="B3" selected>/);assert.match(f.host.innerHTML,/<option value="ALL">/);
 f.change('floor','ALL');assert.match(f.host.innerHTML,/<option value="ALL" selected>/);
 f.click('arrival');assert.equal(view.getState().direction,'arrival');assert.equal(view.setProgress(1),true);assert.equal(view.getState().stageIndex,2);
 f.change('station','HSR:FUT');assert.deepEqual(choices,['HSR:FUT']);assert.equal(view.getState().stationId,'HSR:FUT');
 f.click('departure');f.click('stage','2');assert.equal(view.getState().stageIndex,2);
 f.click('left');f.click('explode');assert.equal(view.getState().exploded,false);
 const target=view.focusStep(step('procedure','verification'),{trip:north});assert.equal(target.stationId,'HSR:WEK');assert.equal(view.getState().floor,'B1');assert.match(f.host.innerHTML,/导航步骤对应/);
 view.focusStep(step('wait','wait'),{trip:north});assert.equal(view.getState().stageIndex,-1);assert.match(f.host.innerHTML,/未定位到站内楼层/);assert.doesNotMatch(f.host.innerHTML,/j3d-node is-active|j3d-layer is-active/);
 const previous=f.host.innerHTML;assert.equal(view.setStation('missing'),false);assert.equal(view.setProgress(Infinity),false);assert.equal(previous,f.host.innerHTML);
 view.dispose();view.dispose();assert.equal(f.host.innerHTML,'');assert.equal(f.listeners.size,0);assert.equal(view.setStation('HSR:FUT'),false);assert.equal(view.setProgress(.5),false);assert.equal(view.focusStep(step('procedure','verification'),{trip:north}),null);assert.equal(f.host.innerHTML,'');
});

test('missing initial model has useful fallback and supports recovery',()=>{
 const f=fakeHost(), view=createJourney3DModel(f.host,{stationId:'missing'});assert.match(f.host.innerHTML,/暂不可用/);assert.equal(view.setStation('HSR:FUT'),true);assert.match(f.host.innerHTML,/深圳福田高铁站/);view.dispose();
});

test('actual high-speed steps map documented procedures without changing route result or graph',async()=>{
 for(const [fromId,toId] of [['HSR:WEK','HSR:FUT'],['HSR:FUT','HSR:WEK']]) {
  const graph={nodes:[],edges:[],regions:[]};const request={origin:{id:fromId,name:fromId},destination:{id:toId,name:toId},departureS:10*3600,departureDate:'2026-10-13'};
  const route=await planHighSpeedJourney({request,graph});assert(route.journey.complete);
  const before=JSON.stringify(route), targets=route.journey.steps.map(s=>resolveJourney3DStep(s,{trip:route.highSpeedTrip}));
  assert(targets.some(Boolean));assert(targets.filter(Boolean).every(t=>t.geometryMode==='schematic-ui'));
  route.journey.steps.forEach((s,i)=>{if(s.kind==='highspeed'||s.highSpeedProcedure==='wait') assert.equal(targets[i],null);});
  const f=fakeHost(), view=createJourney3DModel(f.host);for(const s of route.journey.steps) view.focusStep(s,{trip:route.highSpeedTrip});view.dispose();
  assert.equal(JSON.stringify(route),before);assert.equal(route.journey.graph,graph);
 }
});


test('damaged model geometry fails closed; randomized views remain bounded and finite',()=>{
 for(const point of [[Infinity,0],[0,NaN],[1e6,0],null]) {const model=structuredClone(buildJourney3DModel('HSR:WEK'));model.nodes[0].displayPoint=point;assert.match(journey3DModelSvg(model),/暂不可用/);assert.match(journey3DModelPanel(model),/暂不可用/);}
 let seed=492613;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 for(let i=0;i<240;i++) {
  const model=buildJourney3DModel(i%2?'HSR:FUT':'HSR:WEK'), floor=i%3?'ALL':model.floors[i%model.floors.length].id;
  const svg=journey3DModelSvg(model,{direction:i%4?'departure':'arrival',floor,angle:rand()*1.3-.65,exploded:i%5!==0,progress:rand()});
  assert.doesNotMatch(svg,/NaN|Infinity|undefined/);
  for(const match of svg.matchAll(/points="([^"]+)"/g)) for(const pair of match[1].split(' ')) {const [x,y]=pair.split(',').map(Number);assert(x>=0&&x<=720,`x ${x}`);assert(y>=35&&y<=435,`y ${y}`);}
 }
});
