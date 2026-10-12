import test from 'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{preferenceCost,preferenceAllows,waitingLabelDominates,annotatePreferenceResult,PREFERENCE_PROFILES}from'../../src/navigation/preference-routing.js';
globalThis.document={createElement:()=>({relList:{supports:()=>true}})};
const version=JSON.parse(readFileSync(new URL('../../dist/build-meta.json',import.meta.url))).version;
const{d:route,p:prepare}=await import(new URL('../../dist/assets/mobile-navigation-DfEsS_7b.js',import.meta.url).href+'?v='+version);
function graph(){const a=[114.16,22.28,0],b=[114.1601,22.2801,5];return prepare({regions:[{id:'R',center:a,radius_m:1000}],nodes:[{id:'s',coordinates:a,region_id:'R'},{id:'t',coordinates:b,region_id:'R'}],portals:[{id:'s',node_id:'s',coordinates:a,region_id:'R'},{id:'t',node_id:'t',coordinates:b,region_id:'R'}],edges:[['stairs',10],['escalator',20],['walk',30],['lift',50]].map(([kind,duration])=>({id:kind,physical_id:kind,from_id:'s',to_id:'t',region_id:'R',kind,name:kind,length_m:duration,duration_s:duration,coordinates:[a,b],geometry_mode:'official',snap_eligible:false,accessible_eligible:kind==='lift',wheelchair_barrier:2,disabled:false,source_id:'TEST'}))})}
test('all five UI preferences have explicit distinct semantics on a microscopic network',()=>{
 const g=graph(),expected={ordinary:'stairs',luggage:'lift',escalator:'escalator',lift:'walk',accessible:'lift'};
 for(const[need,profile]of Object.entries(PREFERENCE_PROFILES)){
  const r=route(g,{origin:{lon:114.16,lat:22.28,node_id:'s'},destination:{lon:114.1601,lat:22.2801,node_id:'t'},preference:profile.engine,mode:'walk'});
  assert.equal(r.status,'CONDITIONAL',need+':'+r.message);assert.equal(r.legs[0].kind,expected[need],need);
  assert.equal(r.total_minutes,Number(({stairs:10,escalator:20,walk:30,lift:50}[expected[need]]/60).toFixed(6)),need+' clock time stays physical');
 }
});
test('paid waiting cannot falsely dominate a later cheaper facility state',()=>{
 const early={elapsed:10,cost:90,access:0,tie:''},late={elapsed:30,cost:100,access:0,tie:''};
 assert.equal(waitingLabelDominates(early,late),false);assert.equal(waitingLabelDominates({...early,cost:70},late),true);
 assert.equal(waitingLabelDominates(late,early),false);
 assert.equal(waitingLabelDominates({...early,access:1},late),false);
});
test('luggage is distinct from wheelchair and known luggage bans remain hard',()=>{
 assert.equal(preferenceAllows({wheelchair_barrier:1},'luggage'),true);
 for(const edge of [{luggage_prohibited:true},{luggage_allowed:false},{baggage_prohibited:true}])assert.equal(preferenceAllows(edge,'luggage'),false);
 assert.equal(preferenceCost({kind:'walk'},30,'luggage'),60);assert.equal(preferenceCost({kind:'walk'},30,'lift_first'),30);
 const r=annotatePreferenceResult({journey:{complete:true},segments:[{kind:'escalator',minutes:1}]},{need:'luggage'});
 assert.equal(r.luggageCarryRequired,true);assert.equal(r.needsConfirmation,true);assert.match(r.message,/需搬运行李/);assert.equal(r.accessibilityVerified,false);
});
