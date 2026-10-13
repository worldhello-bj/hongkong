import test from 'node:test';
import assert from 'node:assert/strict';
import {fourPreferenceFixture,fourPreferenceCells,PREFERENCES} from './four-preference-fixture.mjs';
import {auditJourneyClock,auditFourPreferenceCandidate} from './four-preference-audit.mjs';
import {sourceIndex} from './point-matrix-audit.mjs';
const a=[114.16,22.28,1],b=[114.1601,22.28,21];
const edge={id:'source-lift',physical_id:'source-lift',from_id:'a',to_id:'b',kind:'lift',geometry_mode:'official',wheelchair_barrier:null,accessible_eligible:false,access_schedule:{windows:[{start_s:36000,end_s:79200}]}};
const graph={nodes:[{id:'a',coordinates:a},{id:'b',coordinates:b}],edges:[edge],closures:[]};
const request={origin:{node_id:'a',coordinates:a},destination:{node_id:'b',coordinates:b},departureDate:'2026-10-12',departureS:39600};
const canTraverse=(e,start,duration)=>!e.access_schedule||e.access_schedule.windows.some(w=>start>=w.start_s&&start+duration<=w.end_s);
function candidate(){return {id:'walk',available:true,minutes:1,cost:0,quote:{totalCents:0,segments:[{mode:'walk',amountCents:0}]},result:{requestedPreference:'lift',effectivePreference:'lift_first',segments:[{kind:'lift',minutes:1}],totalMinutes:1,departureS:39600,arrivalS:39660,routedEndpoints:{origin:a,destination:b},journey:{complete:true,knownMinutes:1,steps:[{kind:'lift',guidance:{minutes:1,edge_ids:['source-lift'],geometry_mode:'official',geometry:{type:'LineString',coordinates:[a,b]}}}]}}};}
const context={request,need:'lift',taxi:false,fixture:{floors:[]},index:sourceIndex([graph]),canTraverse};
test('16 cells preserve the existing exact ODs, five source floors and Hong Kong clock',()=>{
 const f=fourPreferenceFixture();assert.deepEqual(PREFERENCES,['ordinary','luggage','escalator','lift']);assert.equal(fourPreferenceCells().length,16);assert.equal(f.floors.length,5);
 assert.equal(f.rows[0].request.origin.floorName,'LG1');assert.equal(f.rows[0].request.destination.floorName,'L4');assert.equal(f.rows[1].request.origin.id,'ADM:portal:E2');assert.equal(f.rows[1].request.destination.id,'HUH:portal:B2-lift');assert(f.rows.every(r=>r.request.departureS===39600));
});
test('source lift remains legal while unknown wheelchair suitability is not certified',()=>{
 const c=candidate(),r=auditFourPreferenceCandidate(c,context);assert(r.pass);assert.equal(r.fourPreferenceAudit.unknownWheelchairEvidenceCount,1);
 c.result.accessibilityVerified=true;assert.equal(auditFourPreferenceCandidate(c,context).checks.unknownWheelchairEvidenceNotPromoted,false);
});
test('wrong preference, closed facility, paid clock mismatch and original geometry rules still fail',()=>{
 const c=candidate();c.result.effectivePreference='accessible';assert.equal(auditFourPreferenceCandidate(c,context).checks.effectivePreference,false);
 c.result.effectivePreference='lift_first';c.result.arrivalS+=60;assert.equal(auditFourPreferenceCandidate(c,context).checks.paidJourneyClock,false);
 c.result.arrivalS-=60;c.result.journey.steps[0].guidance.geometry.coordinates[1]=[...b.slice(0,2),0];assert.equal(auditFourPreferenceCandidate(c,context).checks.endpoints,false);
 const closed={...request,departureS:28800};assert.equal(auditJourneyClock(candidate().result,closed,context.index,canTraverse).pass,false);
});
