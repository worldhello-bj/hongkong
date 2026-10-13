import test from'node:test';import assert from'node:assert/strict';import{taxiPassengerPolicy,annotateTaxiPassengerResult}from'../../src/navigation/taxi-policy.js';
for(const need of ['ordinary','luggage','escalator','lift'])for(const enabled of [false,true])test(`taxi toggle ${enabled} respects ${need}`,()=>{
 const policy=taxiPassengerPolicy({enabled,need});assert.equal(policy.eligible,enabled);
 assert.equal(policy.needsVehicleConfirmation,enabled&&need==='luggage');
 if(enabled&&need==='luggage')assert.match(policy.message,/车型、后备厢容量/);
});
test('luggage quote carries capacity confirmation without changing geometry, time, or public evidence',()=>{
 const result={journey:{complete:true,steps:[{kind:'rail'},{kind:'taxi'}]},lines:[{coordinates:[[114.16,22.3],[114.17,22.28]]}],departureS:28800,arrivalS:30000,totalMinutes:20,warnings:[]};
 const changed=annotateTaxiPassengerResult(result,{need:'luggage'});assert.equal(changed.journey,result.journey);assert.equal(changed.lines,result.lines);assert.equal(changed.arrivalS,result.arrivalS);assert.equal(changed.totalMinutes,result.totalMinutes);
 assert.equal(changed.needsVehicleConfirmation,true);assert.equal(changed.luggageSpaceUnverified,true);assert.equal(changed.luggageCompatible,undefined);assert.equal(changed.accessibilityVerified,false);assert.equal(result.needsConfirmation,undefined);
});

test('removed and unknown preferences do not silently certify taxi capability',()=>{for(const need of ['accessible','strict','wheelchair','unexpected']){const p=taxiPassengerPolicy({enabled:true,need});assert.equal(p.eligible,false);assert.equal(p.reason,'unsupported-passenger-preference');assert.equal(p.needsVehicleConfirmation,true)}});
