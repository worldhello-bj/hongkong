import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {ROOT,FIXTURE,readJSON,buildFixture,cells,digest} from './point-matrix-fixture.mjs';
import {auditCandidate,auditUnavailable,fareAudit,endpointAudit,sourceIndex,classifyObservation,completionTiming,identity,samePoint} from './point-matrix-audit.mjs';
const fixture=readJSON(FIXTURE);
test('fixed point fixture is reproducible from unchanged real source points',()=>assert.deepEqual(buildFixture(),fixture));
test('each of six OD rows has exactly the same five preferences × taxi off/on',()=>{
 assert.equal(cells(fixture).length,60);assert.equal(cells(fixture,'A').length,30);assert.equal(cells(fixture,'B').length,30);
 for(const row of fixture.rows){const got=cells(fixture).filter(c=>c.rowId===row.id);assert.equal(got.length,10);assert.equal(new Set(got.map(c=>`${c.need}-${c.taxi}`)).size,10);}
});
test('floors use all five actual source IDs and all 41 source portals; never LG2',()=>{
 assert.deepEqual(fixture.floors.map(f=>f.name),['LG1','L1','L2','L3','L4']);assert.equal(fixture.floors.reduce((n,f)=>n+f.portals.length,0),41);
 const block=readJSON(resolve(ROOT,'dist/area/admiralty-block-graph.json.gz')),nodes=new Map(block.nodes.map(n=>[n.id,n]));
 for(const f of fixture.floors)for(const p of f.portals){assert.ok(block.places.find(p=>p.id==='pacific-place').floors.find(x=>x.id===f.id).entrance_ids.includes(p.id));assert.deepEqual(p.coordinates,nodes.get(p.node_id).coordinates);assert.equal(p.level,f.name);}
});
test('land OD coordinates are copied with original seed and provenance, not resampled or snapped',()=>{
 const path=resolve(ROOT,fixture.landFixture.path),land=readJSON(path);assert.equal(fixture.selectionSeed,20261011);assert.equal(digest(readFileSync(path)),fixture.landFixture.sha256);
 for(const [index,id] of [[1,'land-island'],[12,'land-cross']]){const row=fixture.rows.find(r=>r.id===id);for(const side of ['origin','destination'])assert.deepEqual(row.request[side],land.rows[index-1].request[side]);}
});
const a=[114.16,22.28,1],b=[114.1601,22.28,2],edge={id:'e',physical_id:'e',from_id:'a',to_id:'b',kind:'walk',coordinates:[a,b],geometry_mode:'official',accessible_eligible:true},graph={nodes:[{id:'a',coordinates:a},{id:'b',coordinates:b}],edges:[edge]};
const request={origin:{id:'A',coordinates:a,node_id:'a'},destination:{id:'B',coordinates:b,node_id:'b'}};
const candidate=()=>({id:'walk',cost:0,minutes:1,modeChain:['walk'],quote:{available:true,totalCents:0,segments:[{mode:'walk',amountCents:0,durationMinutes:1}]},result:{segments:[{kind:'walk',minutes:1}],journey:{complete:true,graph,steps:[{kind:'walk',guidance:{edge_ids:['e'],geometry_mode:'official',geometry:{type:'LineString',coordinates:[a,b]}}}]}}});
const context={request,need:'ordinary',taxi:false,fixture,index:sourceIndex([graph])};
test('exact source endpoints preserve XYZ and node identities',()=>{
 assert.ok(auditCandidate(candidate(),context).pass);const changed=candidate();changed.result.journey.steps[0].guidance.geometry.coordinates=[a,[...b.slice(0,2),0]];assert.equal(auditCandidate(changed,context).checks.endpoints,false);assert.equal(samePoint(a,a.slice(0,2)),false);
 const wrong={...request,origin:{...request.origin,node_id:'not-a-node'}};assert.equal(auditCandidate(candidate(),{...context,request:wrong}).checks.endpoints,false);
 const aliasGraph={...graph,nodes:[...graph.nodes,{id:'co-located-other-node',coordinates:a}]};const alias={...request,origin:{...request.origin,node_id:'co-located-other-node'}};assert.equal(auditCandidate(candidate(),{...context,request:alias,index:sourceIndex([aliasGraph])}).checks.endpoints,false);
});
test('named floor centroid is allowed only with explicit same-floor source-portal resolution',()=>{
 const f=fixture.floors[0],portal=f.portals[0],node={id:portal.node_id,coordinates:portal.coordinates},p={id:`pacific-place:floor:${f.id}`,namedPlaceId:'pacific-place',floorId:f.id,floorName:f.name,coordinates:[114.16432165,22.27762541]};
 const result={routedEndpoints:{origin:portal.coordinates,destination:b},resolvedEndpoints:[{side:'origin',placeId:'pacific-place',entranceId:portal.id,floorName:f.name,coordinates:portal.coordinates}],journey:{steps:[{guidance:{geometry:{type:'LineString',coordinates:[portal.coordinates,b]}}}]}};
 const index=sourceIndex([{nodes:[node,...graph.nodes],edges:[]}]);
 assert.ok(endpointAudit({...request,origin:p},result,fixture,index).origin.pass);result.resolvedEndpoints[0].floorName='L4';assert.equal(endpointAudit({...request,origin:p},result,fixture,index).origin.pass,false);result.resolvedEndpoints=[];assert.equal(endpointAudit({...request,origin:p},result,fixture,index).origin.pass,false);
});
test('known closure and strict forbidden facility cannot pass even on modeled geometry',()=>{
 const bad=candidate();bad.result.journey.steps[0].guidance.geometry_mode='schematic';const idx=sourceIndex([{...graph,edges:[{...edge,kind:'stairs'}],closures:[{physical_ids:['e']}]}]);
 const audit=auditCandidate(bad,{...context,need:'accessible',index:idx});assert.equal(audit.checks.knownForbiddenEdges,false);assert.equal(audit.evidence.status,'modeled-or-unverified');
});
test('schematic continuity is reported separately from source-backed evidence',()=>{
 const c=candidate();c.result.journey.steps[0].guidance.geometry_mode='schematic';const audit=auditCandidate(c,context);assert.ok(audit.checks.continuous);assert.equal(audit.evidence.status,'modeled-or-unverified');
});
test('disconnected neighboring legs are detected including vertical jumps',()=>{
 const c=candidate();c.result.journey.steps.push({kind:'walk',guidance:{geometry_mode:'official',geometry:{type:'LineString',coordinates:[[...b.slice(0,2),12],b]}}});assert.equal(auditCandidate(c,context).checks.continuous,false);
});
test('fare covers every compacted leg, preserves middle taxi, and sums to complete total',()=>{
 const c={cost:45,quote:{totalCents:4500,segments:[{mode:'walk',amountCents:0},{mode:'metro',amountCents:1200},{mode:'taxi',amountCents:3300},{mode:'walk',amountCents:0}]},result:{segments:['walk','walk','rail','taxi','walk'].map(kind=>({kind}))}};assert.ok(fareAudit(c).pass);c.quote.segments.splice(2,1);assert.equal(fareAudit(c).pass,false);c.quote.pricingUnavailable=true;assert.equal(fareAudit(c).pass,false);
});
test('taxi off, strict taxi, and luggage confirmation policies are independently audited',()=>{
 const c=candidate();c.result.taxiCandidateKind='direct';assert.equal(auditCandidate(c,context).checks.taxiPolicy,false);assert.equal(auditCandidate(c,{...context,taxi:true,need:'accessible'}).checks.strictTaxi,false);assert.equal(auditCandidate(c,{...context,taxi:true,need:'luggage'}).checks.luggageTaxiConfirmation,false);
});
test('timeout is pending, OOM separate, completed empty remains diagnostic, never inferred NO_ROUTE',()=>{
 assert.equal(classifyObservation({state:'observation-window-ended'}),'pending-observation-window');assert.equal(classifyObservation({state:'complete'}),'completed-without-candidate-needs-diagnosis');assert.equal(classifyObservation({state:'complete',workerErrors:[{code:'ERR_WORKER_OUT_OF_MEMORY'}]}),'resource-failure-oom');assert.equal(classifyObservation({state:'complete',candidates:[{pass:false}]}),'invariant-failure');assert.equal(classifyObservation({state:'complete',cancel:{pass:false}}),'invariant-failure');
});
test('request identity includes named-floor and exact-node selection',()=>assert.notDeepEqual(identity({...request.origin,floorId:'1'}),identity({...request.origin,floorId:'2'})));

test('unavailable taxi retains endpoint-access reason and complete pricing scenario without implying connectivity',()=>{
 const c=candidate();c.available=false;c.result.journey.complete=false;c.result.taxiCandidateKind='direct';c.result.incompleteReason='UNVERIFIED_ENDPOINT_ACCESS';c.result.endpointAccess=[{side:'origin',status:'unverified-node-or-floor',requested:request.origin}];c.result.scenarioOnly=true;c.quote.available=false;
 const out=auditUnavailable(c);assert.equal(out.available,false);assert.equal(out.journeyComplete,false);assert.equal(out.incompleteReason,'UNVERIFIED_ENDPOINT_ACCESS');assert.deepEqual(out.endpointAccess,c.result.endpointAccess);assert.equal(out.fareScenario.totalCents,0);assert.equal(out.fareScenario.legs.length,1);assert.equal(out.fareScenario.available,false);assert.match(out.qualification,/does not establish/);
});

test('source floor projection preserves existing directed edges without city-sized graph',async()=>{
 const {projectPacificPlaceGraph}=await import('./point-source-projection.mjs');const {buildPacificPlaceModel,addPacificPlaceSourceAnchor}=await import('../../src/navigation/pacific-place-model.js');
 const original=addPacificPlaceSourceAnchor(readJSON(resolve(ROOT,'dist/area/admiralty-block-graph.json.gz'))),model=buildPacificPlaceModel(original),sub=projectPacificPlaceGraph(original,model.edges.map(e=>e.physical_id));
 assert.equal(new Set(sub.edges.map(e=>e.physical_id)).size,110);assert.ok(sub.nodes.length<200);assert.ok(sub.edges.length<300);for(const edge of sub.edges)assert.ok(original.edges.includes(edge));for(const f of fixture.floors)for(const p of f.portals)assert.ok(sub.nodes.some(n=>n.id===p.node_id));
});

test('closed-at-departure destination may be reached after an explicit paid opening wait',async()=>{
 const {auditTimedSourceRoute}=await import('./point-source-projection.mjs'),scheduled={id:'gate',access_schedule:{windows:[{start_s:36000,end_s:79200}]}};
 const canTraverse=(e,start,duration)=>!e.access_schedule||e.access_schedule.windows.some(w=>start>=w.start_s&&start+duration<=w.end_s);
 const req={origin:{},destination:scheduled,departureS:28800,departureDate:'2026-10-12'},route={status:'CONDITIONAL',total_minutes:121,legs:[{kind:'wait',minutes:120},{kind:'walk',minutes:1,edge_ids:['gate']}]};
 assert.ok(auditTimedSourceRoute(route,req,{edges:new Map([['gate',scheduled]])},canTraverse).pass);
 const bad={...route,total_minutes:1,legs:route.legs.slice(1)};assert.equal(auditTimedSourceRoute(bad,req,{edges:new Map([['gate',scheduled]])},canTraverse).pass,false);
 assert.equal(auditTimedSourceRoute(route,{...req,origin:scheduled},{edges:new Map([['gate',scheduled]])},canTraverse).pass,false);
});

test('stopped S1 with background errors and usable candidates remains incomplete',()=>{
 const performance={comparisonStatus:'incomplete-error',failedStages:[{id:'taxi-public-middle',message:'non-worker failure'}]};
 assert.equal(classifyObservation({state:'complete',candidates:[{pass:true}],...performance}),'incomplete-routing-error');
 const timing=completionTiming('complete',120000,performance);assert.equal(timing.state,'stopped-incomplete-error');assert.equal(timing.fullCandidateWallMs,null);assert.equal(timing.stoppedWallMs,120000);assert.deepEqual(timing.failedStages,performance.failedStages);
 assert.equal(completionTiming('observation-window-ended',60000,{}).fullCandidateWallMs,null);assert.equal(completionTiming('complete',1200,{comparisonStatus:'complete'}).fullCandidateWallMs,1200);
 const blocked=completionTiming('complete',17.8,{}, {planningStarted:false});assert.equal(blocked.state,'planning-not-started');assert.equal(blocked.fullCandidateWallMs,null);assert.equal(classifyObservation(blocked),'planning-not-started');
});
test('offline price sweep uses complete available metrics and fixed production contributions',async()=>{
 const {evaluatePriceSensitivity}=await import('./point-price-sensitivity.mjs'),{journeyScore}=await import('../../src/navigation/journey-score.js'),{rankJourneys}=await import('../../src/navigation/integrated-navigation.js');
 const make=(id,minutes,cost)=>({id,kind:id,available:true,pass:true,checks:{complete:true},scoringInput:{id,available:true,minutes,cost,walkMinutes:2,transfers:0,result:{waitMinutes:1,segments:[]}}});
 const report={rowId:'r',need:'ordinary',taxi:true,state:'complete',classification:'completed-with-candidates',candidates:[make('taxi',20,100),make('public',40,10),{...make('invalid',1,0),pass:false}]};
 const audit=evaluatePriceSensitivity(report,{journeyScore,rankJourneys});assert.equal(audit.samples.length,5);assert.equal(audit.samples[0].winner,'taxi');assert.equal(audit.samples[4].winner,'public');assert.equal(audit.excluded[0].id,'invalid');
 for(const sample of audit.samples)for(const c of sample.ranked){assert.equal(c.contributions.cost,c.metrics.cost*sample.priceWeight);assert.equal(c.contributions.minutes,c.metrics.minutes);assert.ok(Math.abs(Object.values(c.contributions).reduce((a,b)=>a+b,0)-c.score)<1e-8);}
 assert.equal(evaluatePriceSensitivity({...report,state:'observation-window-ended',classification:'pending-observation-window'},{journeyScore,rankJourneys}).candidateSetComplete,false);
});

test('2D point uses actual boundary geometry while retaining a separate internal road-snap anchor',()=>{
 const c=candidate();c.result.routedEndpoints={origin:[114.1599,22.28,2],destination:[114.1602,22.28,2]};
 const req={origin:{id:'stop-a',coordinates:a.slice(0,2)},destination:{id:'map-b',coordinates:b.slice(0,2)}};
 assert.ok(auditCandidate(c,{...context,request:req}).checks.endpoints);
 c.result.journey.steps[0].guidance.geometry.coordinates=[[114.1599,22.28,2],b];assert.equal(auditCandidate(c,{...context,request:req}).checks.endpoints,false);
});
test('projected source bus geometry retains exact stops through final production journey guidance',async()=>{
 globalThis.document??={createElement:()=>({relList:{supports:()=>true}})};
 const {alignTransitStopProjection}=await import('../../src/navigation/transit-stop-projection.js'),engine=await import('../../dist/assets/mobile-navigation-DfEsS_7b.js'),data=readJSON(resolve(ROOT,'dist/transit/services.json'));
 const pattern=data.patterns.find(p=>p.id==='td:1326:1:287'),from=data.stops.find(p=>p.id==='td:4025'),to=data.stops.find(p=>p.id==='td:9013'),a=pattern.stops.find(p=>p.stopId===from.id),b=pattern.stops.find(p=>p.stopId===to.id),timed={kind:'bus',patternId:pattern.id,fromId:from.id,toId:to.id,geometry:pattern.shape.slice(a.shapeIndex,b.shapeIndex+1),departureS:40800,arrivalS:41492,durationS:692};
 const aligned=alignTransitStopProjection(timed,pattern,from,to),edgeId='RIDE:point-projection-test',geometry={type:'LineString',coordinates:aligned.coordinates},route={status:'CONDITIONAL',origin:{coordinates:from.coordinates},destination:{coordinates:to.coordinates},snapped_origin:{coordinates:from.coordinates,offset_m:0},snapped_destination:{coordinates:to.coordinates,offset_m:0},total_minutes:692/60,distance_m:1000,warnings:aligned.warnings,legs:[{kind:'bus',label:'Source bus test',minutes:692/60,geometry_mode:aligned.geometryMode,edge_ids:[edgeId],geometry,...aligned.metadata}],geometry:{type:'FeatureCollection',features:[{type:'Feature',geometry,properties:{edge_id:edgeId,kind:'bus',geometry_mode:aligned.geometryMode,...aligned.metadata}}]},timedLegs:[timed],timedLegAreaIndices:[[0]]};
 const journey=engine.a({edges:[],portals:[],nodes:[],regions:[]},route,'Projection guidance test'),step=journey.steps.find(s=>s.kind==='bus');
 assert.deepEqual(step.guidance.geometry.coordinates[0],from.coordinates);assert.deepEqual(step.guidance.geometry.coordinates.at(-1),to.coordinates);assert.equal(step.guidance.geometry_mode,'schematic');assert.equal(step.guidance.minutes,692/60);assert.equal(journey.steps.filter(s=>s.kind==='walk').length,0);assert.deepEqual(timed.geometry,pattern.shape.slice(a.shapeIndex,b.shapeIndex+1));
});

test('ride boundary audit preserves source centreline and timetable instead of inventing walking time',async()=>{
 const {auditTransitRideBoundaries}=await import('./point-matrix-audit.mjs');const p0=[114.16,22.28],p1=[114.1601,22.28],p2=[114.17,22.28],p3=[114.1701,22.28];
 const services={stops:[{id:'from',coordinates:p0},{id:'to',coordinates:p3}],patterns:[{id:'service',mode:'bus',geometryMode:'official'}]},result={timedLegs:[{kind:'bus',patternId:'service',fromId:'from',toId:'to',geometry:[p1,p2],departureS:10,arrivalS:70,durationS:60}],timedLegAreaIndices:[[0]],journey:{steps:[{kind:'bus',phase:0,guidance:{minutes:1,geometry:{type:'LineString',coordinates:[p0,p1,p2,p3]}}}]}};
 const out=auditTransitRideBoundaries(result,services);assert.ok(out[0].pass);assert.equal(out[0].associations.length,2);assert.ok(out[0].sourceShapePreserved);assert.ok(out[0].timingPreserved);result.journey.steps[0].guidance.minutes=2;assert.equal(auditTransitRideBoundaries(result,services)[0].pass,false);
});

test('matrix summary counts observed pending cells without counting them as completed',async()=>{
 const {summarizeMatrix}=await import('./point-matrix-summary.mjs'),dir=mkdtempSync(resolve(tmpdir(),'hk-point-summary-'));
 try{
  const selection=cells(fixture).slice(0,2),shared={runtime:{version:'unit',signature:'unit'},state:'complete',performance:{startedMonotonic:1},fixtureSha256:digest(readFileSync(FIXTURE)),candidates:[{id:'walk',pass:true,checks:{complete:true}}],unavailable:[],cancel:{pass:true},requestIdentityPreserved:true,firstResultMs:10,stoppedWallMs:null};
  for(const [i,cell] of selection.entries())writeFileSync(resolve(dir,cell.id+'.json'),JSON.stringify({...shared,rowId:cell.rowId,need:cell.need,taxi:cell.taxi,classification:i?'pending-observation-window':'completed-with-candidates',comparisonStatus:i?'pending':'complete',fullCandidateWallMs:i?null:100}));
  const summary=summarizeMatrix(dir);assert.equal(summary.expectedCells,60);assert.equal(summary.observedCells,2);assert.equal(summary.completedAndAuditedCells,1);assert.equal(summary.completedComparisonCells,1);assert.equal(summary.classificationCounts['not-observed'],58);assert.equal(summary.classificationCounts['pending-observation-window'],1);assert.equal(summary.fullCandidateComparison.count,1);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('strict physical source audit uses the exact built eligibility predicate, including unknown evidence',async()=>{
 const {loadPointSourceEligibility,strictSourceFailureReasons}=await import('./point-source-eligibility.mjs');globalThis.document??={createElement:()=>({relList:{supports:()=>true}})};
 const eligibility=await loadPointSourceEligibility(resolve(ROOT,'dist')),good={...edge,wheelchair_barrier:2};
 assert.deepEqual(strictSourceFailureReasons(good,eligibility),[]);
 for(const [change,reason] of [[{accessible_eligible:false},'source-not-explicitly-accessible-eligible'],[{wheelchair_barrier:null},'official-wheelchair-barrier-not-2'],[{kind:'station_access'},'strict-engine-forbidden-kind'],[{kind:'access_connector',geometry_mode:'schematic'},'strict-engine-forbidden-kind'],[{access_time_id:'unparsed'},'source-opening-rule-invalid-or-unparsed']])assert.ok(strictSourceFailureReasons({...good,...change},eligibility).includes(reason));
 const allowed=sourceIndex([{...graph,edges:[good]}]);assert.ok(auditCandidate(candidate(),{...context,need:'accessible',index:allowed,sourceEligibility:eligibility}).checks.strictSourceEligibility);
 const bad=sourceIndex([{...graph,edges:[{...good,accessible_eligible:false}]}]),out=auditCandidate(candidate(),{...context,need:'accessible',index:bad,sourceEligibility:eligibility});assert.equal(out.checks.strictSourceEligibility,false);assert.ok(out.strictSourceAudit.failures[0].reasons.includes('source-not-explicitly-accessible-eligible'));
});

test('supplement compares all retained candidate and unavailable fields while ignoring only diagnostics',async()=>{
 const {compareRetainedObservation}=await import('./point-supplement-compare.mjs');
 const base={runtime:{version:'before',signature:'a'},rowId:'row',need:'ordinary',taxi:false,fixtureSha256:'fixture',request,candidates:[{id:'public',pass:true,cost:12,fare:{legs:[{mode:'bus',amountCents:1200}]},strictSourceAudit:{provenance:{file:'engine.js',sha256:'a',method:'exact'}}}],unavailable:[{id:'taxi',message:'unverified',endpointAccess:[{status:'unverified-node-or-floor'}]}],requestIdentityPreserved:true,cancel:{pass:true},firstResultMs:20,fullCandidateWallMs:50};
 const next=structuredClone(base);next.runtime={version:'after',signature:'b'};next.firstResultMs=10;next.fullCandidateWallMs=25;next.candidates[0].strictSourceAudit.provenance.sha256='b';assert.ok(compareRetainedObservation(base,next).pass);
 next.candidates[0].fare.legs[0].amountCents=1199;assert.equal(compareRetainedObservation(base,next).pass,false);next.candidates[0].fare.legs[0].amountCents=1200;
 next.unavailable[0].message='changed';assert.equal(compareRetainedObservation(base,next).pass,false);
 const selection=readJSON(resolve(ROOT,'tests/navigation/fixtures/point-supplement-v1.json'));assert.equal(selection.cellIds.length,14);assert.equal(selection.cellIds.filter(id=>id.startsWith('mall-floors-')).length,10);assert.equal(selection.fixtureSha256,digest(readFileSync(FIXTURE)));
});
