import test from 'node:test';
import assert from 'node:assert/strict';
import {PASSENGER_NEEDS,normalizePassengerNeed,isRemovedPassengerNeed} from '../../src/navigation/passenger-preferences.js';
import {parseNavigationLocation,navigationUrl,normalizeNavigationState,normalizeAccountPreferences,migrateSavedNavigationData} from '../../src/navigation/ui-navigation.js';
import {informationPanel} from '../../src/navigation/ui-content.js';
import {buildPacificPlaceModel,pacificPlaceModelSvg,createPacificPlaceModel,PACIFIC_PLACE_BUILDING_ID} from '../../src/navigation/pacific-place-model.js';

const retired=['accessible','accessibility','strict_accessibility','strict-accessibility','wheelchair','strict','step-free',' 严格无障碍 '];
test('four choices and every retired spelling migrate to ordinary, never an advertised mode',()=>{
  assert.deepEqual(PASSENGER_NEEDS,['ordinary','luggage','escalator','lift']);
  for(const need of PASSENGER_NEEDS)assert.equal(normalizePassengerNeed(need),need);
  for(const need of retired){
    assert.equal(isRemovedPassengerNeed(need),true);
    const state=normalizeNavigationState({need,origin:{id:'keep-origin'},destination:{id:'keep-destination'}});
    assert.equal(state.need,'ordinary');assert.equal(state.passengerNeedMigrated,true);
    assert.equal(state.origin.id,'keep-origin');assert.equal(state.destination.id,'keep-destination');
    for(const location of [{search:'?need='+encodeURIComponent(need)},{hash:'#home?need='+encodeURIComponent(need)},{search:'?passengerNeed='+encodeURIComponent(need)}]){
      const result=parseNavigationLocation(location);assert.equal(result.need,'ordinary');assert.equal(result.passengerNeedMigrated,true);
      assert.equal(navigationUrl(result),'/#home');
    }
  }
  assert.equal(parseNavigationLocation({search:'?need=lift',hash:'#home?need=luggage'}).need,'luggage');
  assert.equal(normalizeNavigationState({need:'invalid'}).need,'ordinary');
  assert.equal(normalizeNavigationState({need:'invalid'}).passengerNeedMigrated,undefined);
  const info=informationPanel();assert.match(info,/共四种偏好/);assert.match(info,/设施通行能力不明时视为未核验/);
  assert.doesNotMatch(info,/严格无障碍|共五种偏好/);assert.match(info,/https:\/\/portal.csdi.gov.hk/);assert.match(info,/https:\/\/www.mtr.com.hk/);
});

test('retired legacy URL names and hashes migrate without treating transport or ranking controls as passenger modes',()=>{
  for(const key of ['preference','profile','accessibility','mode'])for(const value of retired){
    for(const location of [{search:'?'+key+'='+encodeURIComponent(value)},{hash:'#home?'+key+'='+encodeURIComponent(value)}]){
      const result=parseNavigationLocation(location);assert.equal(result.need,'ordinary');assert.equal(result.passengerNeedMigrated,true);assert.equal(navigationUrl(result),'/#home');
    }
  }
  for(const hash of ['#accessible','#strict','#/strict','#'+encodeURIComponent('严格无障碍')])assert.deepEqual(parseNavigationLocation({hash}),{stage:'home',station:'ADM',need:'ordinary',passengerNeedMigrated:true});
  for(const value of ['1','true','yes','on'])assert.equal(parseNavigationLocation({search:'?accessibility='+value}).passengerNeedMigrated,true);
  for(const search of ['?mode=metro','?mode=transit','?mode=walk','?priority=accessible','?priority=budget','?profile=commuter','?preference=budget','?accessibility=false','?accessibility=unknown'])assert.equal(parseNavigationLocation({search}).need,undefined,search);
  assert.equal(parseNavigationLocation({hash:'#home?need=lift',search:'?profile=strict'}).need,'lift','an explicit current preference has precedence');
  assert.equal(parseNavigationLocation({hash:'#home?need=lift'}).passengerNeedMigrated,false,'a new explicit choice clears a migration note');
});

test('stored account and order inputs migrate immutably without changing identities, payment or source evidence',()=>{
  for(const need of retired){
    const saved={version:1,account:{id:'existing',name:'kept'},preferences:{priority:need,stepFree:true,avoidCrowds:true,allowedModes:['walk','metro'],need},orders:[{id:'paid-order',status:'paid',paidCents:1200,need,quote:{need,totalCents:1200},request:{need},evidence:{accessible_eligible:undefined,wheelchair_barrier:1}}]};
    const before=structuredClone(saved),migrated=migrateSavedNavigationData(saved);
    assert.deepEqual(saved,before);assert.equal(migrated.preferences.priority,'fast');assert.equal(migrated.preferences.stepFree,false);
    assert.equal(migrated.preferences.need,'ordinary');assert.equal(migrated.preferences.passengerNeedMigrated,true);
    assert.deepEqual(migrated.account,saved.account);assert.equal(migrated.orders[0].paidCents,1200);assert.equal(migrated.orders[0].status,'paid');
    assert.equal(migrated.orders[0].need,'ordinary');assert.equal(migrated.orders[0].quote.need,'ordinary');assert.equal(migrated.orders[0].request.need,'ordinary');
    assert.deepEqual(migrated.orders[0].evidence,saved.orders[0].evidence);
  }
  assert.equal(normalizeAccountPreferences({priority:'budget',stepFree:true}).priority,'budget');
  assert.equal(normalizeAccountPreferences({priority:'unknown',stepFree:false}).priority,'unknown','invalid account priorities remain invalid for validation');
  assert.equal(migrateSavedNavigationData(null),null);assert.deepEqual(migrateSavedNavigationData({preferences:[],orders:[null]}),{preferences:[],orders:[null]});
});

function modelFixture(evidence){
  const a=[114.165,22.278,10],b=[114.1651,22.2781,11];
  return {version:'fixture',nodes:[{id:'a',coordinates:a},{id:'b',coordinates:b}],portals:[],places:[{id:'pacific-place',name:'太古广场',entrance_ids:[],floors:[{id:'L1',name:'L1',entrance_ids:[]}]}],edges:[{id:'lift',physical_id:'lift',from_id:'a',to_id:'b',kind:'lift',name:'来源升降机',building_id:PACIFIC_PLACE_BUILDING_ID,floor_name:'L1',floor_id:'L1',coordinates:[a,b],geometry_mode:'official',...evidence}]};
}
test('mall retains unknown source lifts visually but never counts missing capability as source-confirmed',()=>{
  for(const evidence of [{},{accessible_eligible:true},{wheelchair_barrier:2},{accessible_eligible:true,wheelchair_barrier:1},{accessible_eligible:1,wheelchair_barrier:2}]){
    const graph=modelFixture(evidence),before=structuredClone(graph),model=buildPacificPlaceModel(graph);
    assert.equal(model.edges.length,1);assert.equal(model.summary.lifts,1);assert.equal(model.summary.wheelchairEvidenceLifts,0);
    assert.deepEqual(graph,before);assert.equal(model.edges[0].accessible_eligible,evidence.accessible_eligible);assert.equal(model.edges[0].wheelchair_barrier,evidence.wheelchair_barrier);
    assert.match(pacificPlaceModelSvg(model),/轮椅通行条件未核验/);
    const host={innerHTML:'',addEventListener(){}};const viewer=createPacificPlaceModel(host,model);
    assert.match(host.innerHTML,/轮椅通行条件待核验/);assert.doesNotMatch(host.innerHTML,/严格无障碍/);viewer.dispose();
  }
  assert.equal(buildPacificPlaceModel(modelFixture({accessible_eligible:true,wheelchair_barrier:2})).summary.wheelchairEvidenceLifts,1);
});
