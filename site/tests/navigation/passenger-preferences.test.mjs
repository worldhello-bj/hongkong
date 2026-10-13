import test from 'node:test';
import assert from 'node:assert/strict';
import {PASSENGER_NEEDS,normalizePassengerNeed,normalizeEnginePreference,isRemovedPassengerNeed} from '../../src/navigation/passenger-preferences.js';
import {PREFERENCE_PROFILES,annotatePreferenceResult} from '../../src/navigation/preference-routing.js';
import {taxiPassengerPolicy} from '../../src/navigation/taxi-policy.js';

test('the public registry contains four preferences, without a hidden strict mode',()=>{
  assert.deepEqual(PASSENGER_NEEDS,['ordinary','luggage','escalator','lift']);
  assert.deepEqual(Object.keys(PREFERENCE_PROFILES),PASSENGER_NEEDS);
  assert.ok(Object.isFrozen(PASSENGER_NEEDS));
  for(const need of PASSENGER_NEEDS){assert.equal(normalizePassengerNeed(need),need);assert.equal(isRemovedPassengerNeed(need),false)}
});
test('legacy aliases migrate predictably without claiming facility suitability',()=>{
  for(const need of ['accessible','ACCESSIBLE',' strict ','strict_accessibility','strict-accessibility','wheelchair','wheelchair_accessible','step-free','stepFree','严格无障碍']){
    assert.equal(isRemovedPassengerNeed(need),true,need);
    assert.equal(normalizePassengerNeed(need),'ordinary',need);
    assert.equal(taxiPassengerPolicy({enabled:true,need}).eligible,false,'raw old API value must not silently enable a vehicle');
  }
  for(const value of [null,undefined,0,{},'unknown',''])assert.equal(normalizePassengerNeed(value),'ordinary');
});
test('normalization leaves physical routing results immutable and removes stale certification',()=>{
  const input={journey:{complete:true,steps:[]},segments:[{kind:'walk',minutes:2}],totalMinutes:2,accessibility:'verified',accessibilityVerified:true};
  const before=structuredClone(input);
  for(const need of [...PASSENGER_NEEDS,'accessible']){
    const output=annotatePreferenceResult(input,{need});
    assert.equal(output.accessibilityVerified,false);
    assert.equal(output.accessibility,'unknown');
    assert.equal(output.journey,input.journey);
    assert.equal(output.segments,input.segments);
    assert.equal(output.totalMinutes,2);
    assert.equal(output.requestedPreference,normalizePassengerNeed(need));
    assert.equal(output.effectivePreference,PREFERENCE_PROFILES[normalizePassengerNeed(need)].engine);
    if(need==='accessible')assert.deepEqual(output.preferenceMigration,{from:'accessible',to:'ordinary'});
  }
  assert.deepEqual(input,before);
});


test('actual product router boundary cannot forward a retired engine preference',async()=>{
  const {readFileSync}=await import('node:fs'),vm=await import('node:vm');
  const source=readFileSync(new URL('../../src/navigation/main.recovered.js',import.meta.url),'utf8');
  const code=source.slice(source.indexOf('function E2('),source.indexOf('const O2=',source.indexOf('function E2(')));
  for(const workerPath of [false,true]){
  const requests=[],context={normalizeEnginePreference,Map,DOMException,URL,w2:()=>({route:async request=>{requests.push(request);return {status:'CONDITIONAL'}}})};
  if(workerPath)context.Worker=class {postMessage(message){requests.push(message.request);queueMicrotask(()=>this.onmessage({data:{id:message.id,route:{status:'CONDITIONAL'}}}))}terminate(){}};
  vm.createContext(context);vm.runInContext(code.replaceAll('import.meta.url',JSON.stringify('file:///test/main.js')),context);const router=context.E2({},[],{},{});
  for(const preference of ['fast','luggage','escalator_first','lift_first','accessible','strict','wheelchair',undefined]){
    const request={origin:{node_id:'a'},destination:{node_id:'b'},preference,departureS:39600};
    await router.route(request);
    assert.equal(requests.at(-1).preference,normalizeEnginePreference(preference));
    assert.equal(requests.at(-1).origin,request.origin);assert.equal(requests.at(-1).destination,request.destination);
    assert.equal(request.preference,preference,'caller input remains immutable');
  }
  assert.deepEqual(requests.map(r=>r.preference),['fast','luggage','escalator_first','lift_first','fast','fast','fast','fast']);
  router.dispose();
  }
});
