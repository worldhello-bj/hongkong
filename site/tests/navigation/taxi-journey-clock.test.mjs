import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {composeTaxiJourney,emptyPublicJourney,modeledRoadLink} from '../../src/navigation/taxi-bridge.js';
import {planTaxiCandidates} from '../../src/navigation/taxi-candidates.js';
import {annotatePreferenceResult,PREFERENCE_PROFILES} from '../../src/navigation/preference-routing.js';
import {annotateTaxiPassengerResult} from '../../src/navigation/taxi-policy.js';
import {auditJourneyClock} from './four-preference-audit.mjs';
import {sourceIndex} from './point-matrix-audit.mjs';

const graph={nodes:[],edges:[]};
const near=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<1e-8,`${label}: ${actual} != ${expected}`);
const audit=(result,request)=>auditJourneyClock(result,request,sourceIndex([graph]),()=>true);
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/taxi-journey-clock-seeded.json',import.meta.url),'utf8')).cases;

for(const fixture of fixtures)test(`exact taxi-first clock replays ${fixture.sourceReport} ${fixture.need}`,()=>{
 const request={...fixture.request,need:fixture.need};
 const [pickupS,waitS,rideS,dropoffS]=fixture.taxiDurationsS;
 const pickup={coordinate:request.origin.coordinates},dropoff={coordinate:request.destination.coordinates};
 const quote={carId:'clock-replay',passengerWaitS:waitS,dropoffS:request.departureS+pickupS+waitS+rideS,
  passengerRoute:{durationS:rideS,lengthM:1000,geometry:[pickup.coordinate,dropoff.coordinate]}};
 const suffixDepartureS=quote.dropoffS+dropoffS;
 const suffixMinutes=fixture.suffixSteps.reduce((sum,[,,seconds])=>sum+seconds/60,0);
 const suffix={...emptyPublicJourney(graph,suffixDepartureS),departureS:suffixDepartureS,
  arrivalS:suffixDepartureS+suffixMinutes*60,totalMinutes:Math.ceil(suffixMinutes),
  segments:fixture.suffixSegments.map(([kind,minutes])=>({kind,minutes})),
  journey:{graph,complete:true,knownMinutes:suffixMinutes,
   phases:Array.from({length:Math.max(...fixture.suffixSteps.map(([,phase])=>phase))+1},(_,i)=>`source phase ${i}`),
   steps:fixture.suffixSteps.map(([kind,phase,durationS])=>({kind,phase,guidance:{minutes:durationS/60,edge_ids:[]}}))}};
 const snapshot=structuredClone(suffix);
 const raw=composeTaxiJourney({request,suffix,quote,graph,
  pickupLink:{node:{coordinates:pickup.coordinate},durationS:pickupS,distanceM:10},
  dropoffLink:{node:{coordinates:dropoff.coordinate},durationS:dropoffS,distanceM:10},
  scene:{pickup,destination:dropoff,disclaimer:'deterministic clock replay'}});
 const result=annotateTaxiPassengerResult(annotatePreferenceResult(raw,request),request);
 const clock=audit(result,request);
 assert.equal(clock.pass,true,JSON.stringify(clock.comparisons));
 near(result.journey.knownMinutes,fixture.observed.durationMinutes,'known duration');
 near(result.arrivalS,fixture.observed.stepArrivalS,'arrival');
 assert.equal(result.totalMinutes,Math.ceil(fixture.observed.durationMinutes));
 assert.equal(result.requestedPreference,fixture.need);
 assert.equal(result.effectivePreference,PREFERENCE_PROFILES[fixture.need].engine);
 assert.equal(result.accessibilityVerified,false);
 assert.equal(result.needsVehicleConfirmation,fixture.need==='luggage'?true:undefined);
 assert.deepEqual(suffix,snapshot,'composition must not move or rewrite the public journey');
 assert.deepEqual(result.journey.steps.slice(4).map(s=>({...s,phase:s.phase-4})),suffix.journey.steps);
 assert.deepEqual(result.segments.slice(4),suffix.segments);
 // Reproduce the removed formula, using the same exact quote and rounded display duration.
 const oldMinutes=(quote.dropoffS-request.departureS+dropoffS)/60+suffix.totalMinutes;
 near(oldMinutes,fixture.observed.knownMinutes,'frozen defective known duration');
 const legacy={...result,totalMinutes:Math.ceil(oldMinutes),arrivalS:request.departureS+oldMinutes*60,
  journey:{...result.journey,knownMinutes:oldMinutes}};
 const before=audit(legacy,request);
 assert.equal(before.pass,false);
 assert.equal(before.comparisons.knownJourneyClock,false);
 assert.equal(before.comparisons.reportedArrival,false);
 if(fixture.need==='lift')assert.equal(before.comparisons.roundedDisplayedMinutes,false);
});

test('an unrounded guidance clock is used if the public journey has no knownMinutes',()=>{
 const request={origin:{name:'origin',coordinates:[114.16,22.28]},destination:{name:'destination',coordinates:[114.18,22.28]},departureS:28980};
 const quote={carId:'clock',passengerWaitS:0,dropoffS:29010,passengerRoute:{durationS:30,lengthM:200,geometry:[request.origin.coordinates,request.destination.coordinates]}};
 const suffix={...emptyPublicJourney(graph,29010),totalMinutes:2,segments:[{kind:'metro',minutes:1.125}],
  journey:{graph,complete:true,phases:['metro'],steps:[{kind:'rail',phase:0,guidance:{minutes:1.125}}]}};
 const result=composeTaxiJourney({request,quote,suffix,graph,
  pickupLink:{node:{coordinates:request.origin.coordinates},durationS:0,distanceM:0},
  dropoffLink:{node:{coordinates:request.destination.coordinates},durationS:0,distanceM:0},
  scene:{pickup:{coordinate:request.origin.coordinates},destination:{coordinate:request.destination.coordinates}}});
 near(result.journey.knownMinutes,1.625,'exact fallback minutes');
 assert.equal(audit(result,request).pass,true);
});

for(const need of Object.keys(PREFERENCE_PROFILES))test(`first/last feeder calls keep exact public clocks and endpoint access for ${need}`,async()=>{
 const point=(id,x)=>({id,name:id,coordinates:[x,22.28]});
 const request={origin:point('origin',114.16),destination:point('destination',114.18),departureS:28980,departureDate:'2026-10-13',need};
 const interchange={...point('ADM:portal:E2',114.165),region_id:'ADM',node_id:'interchange-source'};
 const findRoad=p=>({id:p.id,coordinate:[p.coordinates[0]+.00001,p.coordinates[1]]});
 const calls=[],publicCalls=[],published=new Map(),publicMinutes=1.234567,routeGraph={nodes:[],edges:[]};
 const ask=(pickup,destination,readyS)=>{
  const quote={carId:'clock',passengerReadyS:readyS,passengerWaitS:23.456789,dropoffS:readyS+23.456789+91.234567,
   passengerRoute:{durationS:91.234567,lengthM:pickup.id==='origin'&&destination.id==='destination'?2000:500,geometry:[pickup.coordinate,destination.coordinate]}};
  calls.push({pickup,destination,readyS,quote});return quote;
 };
 const publicRoute=async(origin,destination,departureS,mode)=>{
  const edge={id:`source-edge:${origin.id}`,access_schedule:{expectedDepartureS:departureS}};routeGraph.edges.push(edge);
  const route={...emptyPublicJourney(routeGraph,departureS),departureS,arrivalS:departureS+publicMinutes*60,totalMinutes:Math.ceil(publicMinutes),
   segments:[{kind:'metro',minutes:publicMinutes}],journey:{graph:routeGraph,complete:true,knownMinutes:publicMinutes,phases:['source metro'],
    steps:[{kind:'rail',phase:0,guidance:{minutes:publicMinutes,edge_ids:[edge.id],geometry:{type:'LineString',coordinates:[origin.coordinates,destination.coordinates]}}}]}};
  publicCalls.push({origin,destination,departureS,mode,route});return route;
 };
 await planTaxiCandidates({request,station:{portals:[interchange]},services:{stops:[],patterns:[]},graph:routeGraph,findRoad,ask,publicRoute,
  publish:(id,title,result)=>published.set(id,result)});
 assert.equal(published.size,3);
 const last=calls.find(c=>c.pickup.id===interchange.id),first=calls.find(c=>c.destination.id===interchange.id);
 const prefix=publicCalls.find(c=>c.origin.id===request.origin.id),suffix=publicCalls.find(c=>c.origin.id===interchange.id);
 const link=modeledRoadLink(interchange,findRoad(interchange));
 near(last.readyS,prefix.route.arrivalS+link.durationS,'taxi-last exact pickup readiness');
 assert.ok(Math.abs(last.readyS-(request.departureS+prefix.route.totalMinutes*60+link.durationS))>1,'rounded public display must not delay pickup');
 near(suffix.departureS,first.quote.dropoffS+link.durationS,'taxi-first exact public departure');
 for(const result of published.values()){
  const clock=auditJourneyClock(result,request,sourceIndex([routeGraph]),(edge,startS)=>
   !edge.access_schedule||Math.abs(startS-edge.access_schedule.expectedDepartureS-.001)<1e-8);
  assert.equal(clock.pass,true,JSON.stringify(clock.comparisons));
  if(result.taxiCandidateKind!=='direct')assert.equal(clock.records.filter(r=>r.scheduledEdgeIds.length).length,1);
 }
 const raw=published.get('taxi-first-metro-ADM:portal:E2');
 const result=annotateTaxiPassengerResult(annotatePreferenceResult(raw,request),request);
 assert.equal(result.requestedPreference,need);assert.equal(result.effectivePreference,PREFERENCE_PROFILES[need].engine);
 assert.deepEqual(result.endpointAccess.map(e=>e.requested.coordinates),[request.origin.coordinates,request.destination.coordinates]);
 assert.equal(result.journey.steps.at(-1).guidance,suffix.route.journey.steps[0].guidance);
 assert.deepEqual(result.journey.steps.at(-1).guidance.edge_ids,[`source-edge:${interchange.id}`]);
 assert.equal(result.journey.complete,true);assert.equal(result.accessibilityVerified,false);
});
