import test from'node:test';import assert from'node:assert/strict';import{preferenceCost}from'../../src/navigation/preference-routing.js';
test('preference-aware reverse edge bound never exceeds any realizable profile/ride-state cost',()=>{
 let seed=98123;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 for(const preference of ['fast','luggage','escalator_first','lift_first','accessible','few_stairs'])for(const kind of ['walk','crossing','stairs','escalator','lift','ramp'])for(let i=0;i<100;i++){
  const duration_s=5+random()*200,lift_wait_s=kind==='lift'?random()*duration_s:0,fraction=random(),edge={kind,duration_s,lift_wait_s};
  const bound=preferenceCost(edge,Math.max(0,(duration_s-lift_wait_s))*fraction,preference,{continuingLift:true,fraction});
  for(const continuingLift of [false,true]){const duration=(duration_s-(continuingLift?lift_wait_s:0))*fraction;const actual=preferenceCost(edge,duration,preference,{continuingLift,fraction});assert.ok(bound<=actual+1e-9,preference+'/'+kind);}
 }
});
