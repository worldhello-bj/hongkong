import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PUBLIC_MODES,SEARCH_VARIANTS,journeyModeChain,rankJourneys,deduplicateJourneys,publicArrivalAnchors} from '../../src/navigation/integrated-navigation.js';
test('all public modes enabled without taxi; no private-car or bike fiction',()=>{
 assert.deepEqual(PUBLIC_MODES,['metro','bus','tram']); assert.equal(SEARCH_VARIANTS[0],'transit');
});
test('route chain preserves middle and final taxi, excludes waits',()=>{
 assert.deepEqual(journeyModeChain(['walk','rail','wait','walk','taxi','walk','bus','walk'].map(kind=>({kind}))),['walk','metro','walk','taxi','walk','bus','walk']);
});
test('ranking respects actual user priority rather than former mode tab',()=>{
 const choices=[{id:'transit',available:true,minutes:40,cost:8,walkMinutes:2,transfers:1},{id:'walk',available:true,minutes:20,cost:0,walkMinutes:20,transfers:0},{id:'failed',available:false,minutes:1,cost:0,walkMinutes:0,transfers:0}];
 assert.equal(rankJourneys(choices)[0].id,'walk');assert.equal(rankJourneys(choices,'walk')[0].id,'transit');assert.equal(rankJourneys(choices,'cost')[0].id,'walk');
});
test('arrival bridge uses timed service geometry, never a made-up pickup',()=>{
 assert.deepEqual(publicArrivalAnchors({timedLegs:[{kind:'metro',toId:'AUS',arrivalS:30000,geometry:[[114.1,22.2],[114.16,22.3]]}]}),[{id:'AUS',name:'AUS',coordinates:[114.16,22.3],arrivalS:30000,legIndex:0,publicMode:'metro',requiresExitWalk:true}]);
 assert.deepEqual(publicArrivalAnchors({timedLegs:[{kind:'metro',arrivalS:3}]}),[]);
});
test('entry retains detailed routes and Web Workers but exposes exactly two selectors',async()=>{
 const s=await readFile(new URL('../../dist/assets/main-integrated.js',import.meta.url),'utf8');
 assert.match(s,/data-taxi-policy/);assert.doesNotMatch(s,/data-mode=/);assert.doesNotMatch(s,/data-extra=/);
 for(const marker of ['app-transit-worker-CaCMeUxU.js','app-walk-worker-jk5g-BMr.js','metro-planning-CBAOotPX.js','endpointFloor','allowedTransitModes:[...PUBLIC_MODES]']) assert.ok(s.includes(marker),marker);
 assert.doesNotMatch(s,/n3\(e\),/);
});
test('identical route results collapse; distinct steps remain',()=>{
 const a={available:true,minutes:8,result:{journey:{steps:[{kind:'walk',guidance:{edge_ids:['a']}}]}}};
 const b={...a,result:{journey:{steps:[{kind:'walk',guidance:{edge_ids:['b']}}]}}};
 assert.equal(deduplicateJourneys([a,a,b]).length,2);
});
test('two policy controls render and preserve facility/date preferences',async()=>{
 const source=await readFile(new URL('../../src/navigation/main.recovered.js',import.meta.url),'utf8');
 const body=source.slice(source.indexOf('function X2()'),source.indexOf('function x()'));
 const render=new Function('t1','Q2','q1','M','trafficClock','J2','r','G',body+';return X2();');
 const args=[()=>'',false,x=>x,{date:'2026-10-11',time:'08:00:00'},{luggage:'大件行李'},{need:'luggage'},'time'];
 for (const taxis of [new Set(),new Set(['taxi'])]) {
  const html=render(taxis,...args);assert.equal((html.match(/data-taxi-policy=/g)||[]).length,2);
  assert.match(html,/data-app="need"/);assert.match(html,/data-app="departure-date"/);assert.match(html,/行李模式优先减少步行与搬运/);
  assert.match(html,/value="2026-10-11"/);assert.match(html,/value="08:00:00"/);assert.match(html,/全局模拟时间/);
  assert.ok(html.includes(`data-taxi-policy="${taxis.size?'with':'without'}" aria-pressed="true"`));
  assert.equal((html.match(/<div\b/g)||[]).length,(html.match(/<\/div>/g)||[]).length);
 }
});
test('user-requested calculation cap removal retains cancel and progress',async()=>{
 const s=await readFile(new URL('../../src/navigation/main.recovered.js',import.meta.url),'utf8');
 assert.doesNotMatch(s,/setTimeout\(\s*\(\)\s*=>\s*budget\.abort/);
 assert.doesNotMatch(s,/本轮计算已达到演示时限/);
 assert.match(s,/await runRoutingPhases\(\{basePublic:publicWork,taxi:taxiWork,refinePublic:publicRefinementWork,walk:walkWork,isCurrent:\(\)=>!stale\(\)\}\)/);
 assert.match(s,/routeResultCache/);assert.match(s,/__navigationPerformance/);assert.match(s,/cancel-plan/);
 for(const name of ['mobile-navigation-DfEsS_7b.js','intermodal-routing-D8vKT-lN.js','app-walk-worker-jk5g-BMr.js','app-transit-worker-CaCMeUxU.js','metro-worker-BDEusPKL.js']){
  const engine=await readFile(new URL('../../dist/assets/'+name,import.meta.url),'utf8');assert.equal(engine.includes('超过安全预算'),false,name);
 }
});
