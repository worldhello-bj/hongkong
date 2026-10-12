import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{gunzipSync}from'node:zlib';import{addShortDemoConnectors}from'../../src/navigation/integrated-navigation.js';
const file=p=>readFileSync(new URL('../../'+p,import.meta.url));
const cached=JSON.parse(gunzipSync(file('dist/transit/walk-links.json.gz'))).connections.find(c=>c.fromId==='ADM:portal:C1'&&c.toId==='td:99220');
const transit=file('dist/assets/intermodal-routing-D8vKT-lN.js').toString();
const code=transit.slice(transit.indexOf('function ot('),transit.indexOf('const st=',transit.indexOf('function nt(')));
const {nt,ot}=new Function('H','be',code+';return {nt,ot}')(x=>x,(a,b)=>Math.hypot((a[0]-b[0])*102900,(a[1]-b[1])*111320));
const mobile=file('dist/assets/mobile-navigation-DfEsS_7b.js').toString();
const guidance=new Function(mobile.slice(mobile.indexOf('function i6('),mobile.indexOf('function t6('))+';return i6;')();
const normalized=nt(cached.route),stripped=ot({...normalized,features:normalized.geometry.features},null,{id:'td:99220'},new Set()),leg=stripped.legs.at(-1);
test('real cached 18.252m stop access retains its own endpoints after entrance verification downgrade',()=>{
 assert.equal(leg.geometry_mode,'none');assert.equal(leg.geometry,undefined);assert.equal(leg.distance_m,18.252);
 assert.deepEqual(leg.local_access_geometry.coordinates,[[114.164456,22.27854832],[114.16438,22.2784]]);
 assert.equal(stripped.features.some(f=>f.properties.edge_id==='ACCESS:destination'),false);
});
test('guidance cannot borrow a later connector sharing ACCESS:destination',()=>{
 const wrong={geometry:{type:'LineString',coordinates:[[114.16355203,22.26033458],[114.16249504095414,22.260316295672865]]}};
 const result=guidance(leg,new Map(),new Map([['ACCESS:destination',[wrong]]]));assert.deepEqual(result.coordinates,leg.local_access_geometry.coordinates);
 assert.equal(guidance({...leg,local_access_geometry:undefined},new Map(),new Map([['ACCESS:destination',[wrong]]])),undefined);
});
test('internal modeled connector uses local source endpoints, never whole-trip destination, without shifting timetable',()=>{
 const route={legs:[{kind:'walk'},structuredClone(leg),{kind:'walk'}],total_minutes:9},journey={complete:false,steps:[{blocked:true,guidance:{leg_index:1}}]};
 const request={need:'ordinary',origin:{coordinates:[114.16605,22.30508]},destination:{coordinates:[114.162495,22.260316]}};
 assert.equal(addShortDemoConnectors(journey,route,request,{isConnectorAllowed:()=>true}),true);
 assert.deepEqual(journey.steps[0].guidance.geometry,leg.local_access_geometry);assert.equal(route.total_minutes,9);assert.equal(route.legs[1].minutes,leg.minutes);
});
test('missing local intermediate geometry and inconsistent distance both fail closed',()=>{
 for(const damaged of [{...leg,local_access_geometry:undefined},{...leg,distance_m:640.975}]){
 const route={legs:[{kind:'walk'},damaged,{kind:'walk'}]},journey={complete:false,steps:[{blocked:true,guidance:{leg_index:1}}]};
 assert.equal(addShortDemoConnectors(journey,route,{need:'ordinary',origin:{coordinates:[114.16,22.3]},destination:{coordinates:[114.16,22.26]}},{isConnectorAllowed:()=>true}),false);
 }
});
