import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDemoAccessibilityGraph, createDemoWalkLinks, annotateDemoFallback, demoEndpointEvidence, demoEndpointEvidenceMissing} from '../../src/navigation/demo-fallback.js';

const edge = (id, extra = {}) => ({id, physical_id: id, kind: 'walk', disabled: false, accessible_eligible: true, wheelchair_barrier: 2, geometry_mode: 'official', ...extra});
const resultFor = (graph, ids = ['walk'], extra = {}) => ({
  totalMinutes: 8, arrivalS: 29280, warnings: ['原来源提示'],
  segments: [{kind: 'walk', minutes: 8}],
  journey: {complete: true, graph, steps: [{kind: 'walk', guidance: {edge_ids: ids, geometry_mode: 'official'}}]},
  ...extra,
});

test('demo accessibility graph filters known barriers and all closed physical directions', () => {
  const denied = ['stairs', 'stairlift', 'escalator', 'travelator', 'movingwalkway', 'moving_walkway', 'moving-walkway'];
  const graph = {nodes: [], edges: [edge('walk'), edge('lift', {kind: 'lift'}),
    ...denied.map(kind => edge(kind, {kind})), edge('barrier', {wheelchair_barrier: 1}),
    edge('disabled', {disabled: true}), edge('closed-forward', {physical_id: 'closed'}),
    edge('closed-reverse', {physical_id: 'closed'})], closures: [{physical_ids: ['closed']}]};
  assert.deepEqual(createDemoAccessibilityGraph(graph).edges.map(item => item.id), ['walk', 'lift']);
});

test('graph filter is cached, source-immutable, and retains all metadata and schedules', () => {
  const schedule = {kind: 'daily', windows: [{start_s: 28800, end_s: 79200}]};
  const retained = edge('walk', {access_schedule: schedule, accessible_eligible: false, direction: 1});
  const graph = {nodes: [{id: 'original'}], edges: [retained, edge('stairs', {kind: 'stairs'})],
    selection_envelopes: [{id: 'KOW'}], kowloon_exact_boundary_join: {joins: ['original']},
    closures: [{physical_ids: ['other']}], portals: [{access_schedule: schedule}],
    source: {version: 'original'}, version: 'v1'};
  const before = structuredClone(graph), filtered = createDemoAccessibilityGraph(graph);
  assert.notEqual(filtered, graph);
  assert.notEqual(filtered.edges, graph.edges);
  assert.equal(createDemoAccessibilityGraph(graph), filtered);
  assert.deepEqual(graph, before);
  for (const key of Object.keys(graph).filter(key => key !== 'edges')) assert.equal(filtered[key], graph[key], key);
  assert.equal(filtered.edges[0], retained);
  assert.equal(filtered.edges[0].access_schedule, schedule);
  assert.equal(filtered.edges[0].accessible_eligible, false);
  assert.equal(createDemoAccessibilityGraph(undefined), undefined);
});

test('ordinary simulation and accessible/luggage pending facilities have explicit non-verified tags', () => {
  const input = resultFor({edges: [edge('walk')]});
  for (const need of ['ordinary', 'accessible', 'luggage']) {
    const actual = annotateDemoFallback(input, {need});
    assert.ok(actual);
    assert.equal(actual.scenarioOnly, true);
    assert.equal(actual.simulationOnly, true);
    assert.equal(actual.confidence, 'modeled');
    assert.equal(actual.needsConfirmation, true);
    assert.equal(actual.needsFacilityConfirmation, need !== 'ordinary');
    assert.equal(actual.accessibilityVerified, false);
    assert.equal(actual.accessibility, 'unverified');
    assert.equal(actual.originalNeed, need);
    assert.match(actual.reviewLabel, need === 'ordinary' ? /演示路线/ : /设施待确认/);
    assert.match(actual.message, /待确认/);
    assert.equal(actual.totalMinutes, 8);
    assert.equal(actual.arrivalS, 29280);
    assert.deepEqual(actual.warnings, ['原来源提示', actual.message]);
  }
  assert.equal(input.scenarioOnly, undefined);
  assert.deepEqual(input.warnings, ['原来源提示']);
});

test('source-graph lookup rejects barriers reintroduced beneath generic walking steps', () => {
  for (const unsafe of [edge('walk', {kind: 'stairs'}), edge('walk', {kind: 'escalator'}),
    edge('walk', {kind: 'stairlift'}), edge('walk', {kind: 'travelator'}),
    edge('walk', {kind: 'moving_walkway'}), edge('walk', {wheelchair_barrier: 1})]) {
    for (const need of ['accessible']) {
      assert.equal(annotateDemoFallback(resultFor({edges: [unsafe]}), {need}), null, `${need}: ${unsafe.kind}`);
    }
    assert.ok(annotateDemoFallback(resultFor({edges: [unsafe]}), {need: 'ordinary'}));
    const luggage=annotateDemoFallback(resultFor({edges:[unsafe]}),{need:'luggage'});assert.ok(luggage);if(unsafe.kind!=='walk')assert.equal(luggage.luggageCarryRequired,true);
  }
  const duplicate = resultFor({edges: [edge('walk', {kind: 'stairs'}), edge('walk')]});
  assert.equal(annotateDemoFallback(duplicate, {need: 'accessible'}), null);
});

test('unused graph barriers do not invalidate the actual safe route', () => {
  const result = resultFor({edges: [edge('walk'), edge('unused', {kind: 'stairs', disabled: true})]});
  assert.ok(annotateDemoFallback(result, {need: 'accessible'}));
});

test('every demo profile rejects disabled or physically closed traversed edges', () => {
  for (const need of ['ordinary', 'accessible', 'luggage']) {
    for (const graph of [{edges: [edge('walk', {disabled: true})]},
      {edges: [edge('walk', {physical_id: 'closed'})], closures: [{physical_ids: ['closed']}]}]) {
      assert.equal(annotateDemoFallback(resultFor(graph), {need}), null);
    }
  }
});

test('direct prohibited steps or summary segments cannot be relabelled as accessible', () => {
  const graph = {edges: [edge('walk')]};
  const direct = resultFor(graph);
  direct.journey.steps[0].kind = 'stairs';
  assert.equal(annotateDemoFallback(direct, {need: 'accessible'}), null);
  const luggage=annotateDemoFallback(resultFor(graph, ['walk'], {segments: [{kind: 'escalator'}]}), {need: 'luggage'});assert.equal(luggage.luggageCarryRequired,true);assert.equal(luggage.needsConfirmation,true);assert.match(luggage.message,/需搬运行李/);
});

test('no invented lifts or unresolved official physical source edges', () => {
  for (const graph of [{edges: []}, {edges: [edge('lift')]}]) {
    const result = resultFor(graph, ['lift']);
    result.journey.steps[0].kind = 'lift';
    for (const need of ['ordinary', 'accessible']) assert.equal(annotateDemoFallback(result, {need}), null);
  }
  const lift = edge('lift', {kind: 'lift'}), result = resultFor({edges: [lift]}, ['lift']);
  result.journey.steps[0].kind = 'lift';
  assert.ok(annotateDemoFallback(result, {need: 'accessible'}));
  assert.equal(annotateDemoFallback(resultFor({edges: []}), {need: 'accessible'}), null);
  const connector = resultFor({edges: []}, ['synthetic-endpoint']);
  connector.journey.steps[0] = {kind: 'access_connector', blocked: false,
    guidance: {edge_ids: ['synthetic-endpoint'], geometry_mode: 'schematic'}};
  assert.equal(annotateDemoFallback(connector, {need: 'accessible'}), null, 'unverified connector never meets a strict constraint');
  assert.ok(annotateDemoFallback(connector, {need: 'ordinary'}));
});

test('incomplete, missing and blocked journeys never acquire false completion', () => {
  for (const value of [null, {}, {journey: {complete: false, steps: []}}, {journey: {complete: true}}]) {
    assert.equal(annotateDemoFallback(value, {need: 'accessible'}), null);
  }
  const blocked = resultFor({edges: [edge('walk')]});
  blocked.journey.steps[0].blocked = true;
  const before = structuredClone(blocked);
  assert.equal(annotateDemoFallback(blocked, {need: 'ordinary'}), null);
  assert.deepEqual(blocked, before);
  blocked.journey.steps[0].blocked = false;
  blocked.journey.steps[0].kind = 'gap';
  assert.equal(annotateDemoFallback(blocked, {need: 'ordinary'}), null);
});

const connection = (id, kind = 'walk') => ({id, route: {status: 'CONDITIONAL',
  legs: [{kind, geometry_mode: 'official', source_edge_ids: [id]}],
  geometry: {type: 'FeatureCollection', features: [{properties: {id, kind, geometry_mode: 'official'}}]}}});

test('cached walks reject prohibited or absent source edges and preserve source links', () => {
  const area = createDemoAccessibilityGraph({version: 'area-v2', edges: [edge('walk'), edge('stairs', {kind: 'stairs'})]});
  const station = createDemoAccessibilityGraph({version: 'station-v1', edges: [edge('station')]});
  const links = {graph_version: 'old', services_version: 4, preference: 'fast', warnings: ['existing'],
    connections: [connection('walk'), connection('station'), connection('stairs'), connection('missing')]};
  const before = structuredClone(links);
  const actual = createDemoWalkLinks(links, [area, station]);
  assert.deepEqual(actual.connections.map(item => item.id), ['walk', 'station']);
  assert.equal(actual.connections[0], links.connections[0]);
  assert.equal(actual.graph_version, area.version);
  assert.equal(actual.services_version, 4);
  assert.equal(actual.warnings, links.warnings);
  assert.equal(createDemoWalkLinks(links, [area, station]), actual);
  assert.equal(createDemoWalkLinks(links, {area, station}), actual);
  assert.deepEqual(links, before);
});

test('cached legs and geometry both undergo barrier validation, including source aliases', () => {
  const area = {version: 'v', edges: [edge('walk'), edge('reverse:r'), edge('disabled', {disabled: true}),
    edge('barrier', {wheelchair_barrier: 1}), edge('closed', {physical_id: 'closed'})]};
  const block = {edges: [], closures: [{physical_ids: ['closed']}]};
  const split = connection('walk');
  split.route.geometry.features[0].properties.id = 'walk:split:0';
  const reverse = connection('reverse:r');
  reverse.route.geometry.features[0].properties.id = 'reverse:r:split:1';
  const badFeature = connection('walk');
  badFeature.route.geometry.features[0].properties.kind = 'stairs';
  const badLeg = connection('walk', 'escalator');
  badLeg.route.geometry.features[0].properties.kind = 'walk';
  const missingFeature = connection('walk');
  missingFeature.route.geometry.features[0].properties.id = 'missing';
  const wrongPhysical = connection('walk');
  wrongPhysical.route.geometry.features[0].properties.physical_id = 'different';
  const disguisedLift = connection('walk', 'lift');
  const links = {connections: [split, reverse, badFeature, badLeg, missingFeature, wrongPhysical, disguisedLift,
    connection('disabled'), connection('barrier'), connection('closed')]};
  assert.deepEqual(createDemoWalkLinks(links, [area, block]).connections, [split, reverse]);
});

test('only explicit schematic endpoint access can lack a physical cached source', () => {
  const area = {version: 'v', edges: [edge('walk')]};
  const make = (kind, geometryMode, id = 'ACCESS:destination') => ({...connection('walk'), route: {
    status: 'CONDITIONAL', legs: [{kind, geometry_mode: geometryMode, edge_ids: [id]}],
    geometry: {features: [{properties: {kind, geometry_mode: geometryMode, id: `${id}:0`}}]},
  }});
  const modeled = make('access_connector', 'schematic');
  const links = {connections: [modeled, make('walk', 'schematic'), make('access_connector', 'official'),
    make('access_connector', 'schematic', 'MADE-UP-LINK')]};
  assert.deepEqual(createDemoWalkLinks(links, [area]).connections, [modeled]);
});


test('strict fallback rejects unknown eligibility and official unknown barriers, including split aliases', () => {
  for(const extra of [{accessible_eligible:false},{accessible_eligible:undefined},{wheelchair_barrier:undefined},{wheelchair_barrier:0}]){
    const result=resultFor({edges:[edge('walk',extra)]},['walk:split:0']);
    assert.equal(annotateDemoFallback(result,{need:'accessible'}),null);
  }
  assert.ok(annotateDemoFallback(resultFor({edges:[edge('walk')]},['walk:split:0']),{need:'accessible'}));
});

const exactFixture=()=>{
  const origin={id:'o',node_id:'O',coordinates:[114.16624518,22.27888752,6]},destination={id:'HUH:portal:B2-lift',node_id:'D',coordinates:[114.18193105,22.30359537,13.8]};
  const graph={nodes:[{id:'O',coordinates:origin.coordinates},{id:'D',coordinates:destination.coordinates}],edges:[edge('real',{from_id:'O',to_id:'D'})]};
  const result=resultFor(graph,['real']);result.journey.steps[0].guidance.geometry={type:'LineString',coordinates:[origin.coordinates,destination.coordinates]};
  result.routedEndpoints={origin:origin.coordinates,destination:destination.coordinates};
  return {request:{origin,destination,need:'accessible'},result};
};
test('exact endpoint completion requires actual source incidence, XYZ and routed endpoint agreement',()=>{
  const {request,result}=exactFixture();assert.ok(annotateDemoFallback(result,request));
  const wrong=[114.18203649,22.30385404,13.541];
  const relocated=structuredClone(result);relocated.routedEndpoints.destination=wrong;
  relocated.journey.steps.push({kind:'access_connector',guidance:{edge_ids:[],geometry_mode:'schematic',geometry:{type:'LineString',coordinates:[wrong,request.destination.coordinates]}}});
  assert.equal(demoEndpointEvidence(relocated,request),false);
  assert.equal(annotateDemoFallback(relocated,{...request,need:'ordinary'}),null,'30.74m drawn link cannot certify original lift endpoint');
  const noSource=structuredClone(result);noSource.journey.graph.edges[0].to_id='unrelated-co-located-node';
  assert.equal(demoEndpointEvidence(noSource,request),false);
  const wrongHeight=structuredClone(result);wrongHeight.journey.steps[0].guidance.geometry.coordinates[1][2]=0;
  assert.equal(demoEndpointEvidence(wrongHeight,request),false);
});
test('named floors resolve only to an allowed source portal, while ordinary XY keeps explicit scenario access',()=>{
  const {request,result}=exactFixture();request.destination={coordinates:[114.18,22.30],floorId:'L4',floorName:'L4',namedPlaceId:'place',node_ids:['D']};
  result.journey.graph.portals=[{id:'entrance',node_id:'D'}];result.resolvedEndpoints=[{side:'destination',entranceId:'entrance',placeId:'place',floorName:'L4'}];
  assert.equal(demoEndpointEvidence(result,request),true);
  result.resolvedEndpoints[0].floorName='L3';assert.equal(demoEndpointEvidence(result,request),false);
  assert.equal(demoEndpointEvidence(result,{origin:{coordinates:[114.16,22.28]},destination:{coordinates:[114.18,22.30]}}),true);
});

const floorEvidenceFixture=(side,need)=>{
  const {request,result}=exactFixture(),selected=request[side],nodeId=selected.node_id;
  request.need=need;
  // The UI keeps a place centroid until f2 derives exact permitted floor nodes.
  // All result-side evidence is deliberately correct, to isolate the missing set.
  request[side]={id:'place:floor:L4',namedPlaceId:'place',floorId:'L4',floorName:'L4',coordinates:[114.18,22.30]};
  result.journey.graph.portals=[{id:'floor-entrance',node_id:nodeId}];
  result.resolvedEndpoints=[{side,entranceId:'floor-entrance',placeId:'place',floorName:'L4'}];
  return {request,result,nodeId,sourceCoordinates:selected.coordinates};
};

test('missing floor evidence implies rejection on either endpoint under all five preferences, despite otherwise correct source evidence',()=>{
  let compared=0;
  for(const side of ['origin','destination'])for(const need of ['ordinary','luggage','escalator','lift','accessible']){
    for(const absence of [{},{node_ids:undefined},{node_ids:null},{node_ids:[]}]){
      const {request,result}=floorEvidenceFixture(side,need);Object.assign(request[side],absence);
      const before=structuredClone({request,result});
      assert.equal(demoEndpointEvidenceMissing(request),true,side+'/'+need);
      assert.equal(demoEndpointEvidence(result,request),false,side+'/'+need);
      assert.equal(annotateDemoFallback(result,request),null,side+'/'+need);
      assert.deepEqual({request,result},before,'precheck and verifier are non-mutating');
      compared++;
    }
  }
  assert.equal(compared,40);
});

test('supplying the legitimate floor source set or exact node restores eligibility rather than suppressing a valid floor route',()=>{
  let compared=0;
  for(const side of ['origin','destination'])for(const need of ['ordinary','luggage','escalator','lift','accessible']){
    for(const form of ['one-node','several-nodes','exact-node']){
      const {request,result,nodeId,sourceCoordinates}=floorEvidenceFixture(side,need);
      if(form==='exact-node')Object.assign(request[side],{node_id:nodeId,node_ids:[],coordinates:sourceCoordinates});
      else request[side].node_ids=Object.freeze(form==='one-node'?[nodeId]:['other-floor-candidate',nodeId]);
      const before=structuredClone({request,result});
      assert.equal(demoEndpointEvidenceMissing(request),false,side+'/'+need+'/'+form);
      assert.equal(demoEndpointEvidence(result,request),true,side+'/'+need+'/'+form);
      assert.ok(annotateDemoFallback(result,request),side+'/'+need+'/'+form);
      assert.deepEqual({request,result},before);
      compared++;
    }
  }
  assert.equal(compared,30);
});

test('the precheck is limited to nullish or genuinely empty node sets and leaves malformed/unknown sets on the original path',()=>{
  for(const side of ['origin','destination']){
    const point={floorId:'L4'};
    for(const node_ids of [undefined,null,[]])assert.equal(demoEndpointEvidenceMissing({[side]:{...point,node_ids}}),true);
    for(const node_ids of ['',0,false,{}, {length:0}, {length:1,0:'D'}, 'D', new Set(),new Uint8Array(),['D'],[undefined],Array(1)]){
      assert.equal(demoEndpointEvidenceMissing({[side]:{...point,node_ids}}),false,'not an asserted empty array: '+String(node_ids));
    }
    for(const floorId of [undefined,null,'',0,false])assert.equal(demoEndpointEvidenceMissing({[side]:{floorId,node_ids:[]}}),false);
    assert.equal(demoEndpointEvidenceMissing({[side]:{...point,node_id:'D'}}),false);
    assert.equal(demoEndpointEvidenceMissing({[side]:{...point,node_id:'',node_ids:[]}}),true,'matches the verifier truthiness rule');
    for(const value of [undefined,null,{}, {coordinates:[114,22]}, {coordinates:[114,22,6]}])assert.equal(demoEndpointEvidenceMissing({[side]:value}),false);
  }
  assert.equal(demoEndpointEvidenceMissing(),false);
  assert.equal(demoEndpointEvidenceMissing({}),false);
  let inspected=false;const malformed={length:0,get includes(){inspected=true;throw Error('must not inspect malformed set')}};
  assert.equal(demoEndpointEvidenceMissing({origin:{floorId:'L4',node_ids:malformed}}),false);
  assert.equal(inspected,false);
});

test('absence of a precheck rejection does not waive floor, source incidence, XYZ or closure constraints',()=>{
  for(const side of ['origin','destination']){
    const {request,result,nodeId}=floorEvidenceFixture(side,'ordinary');request[side].node_ids=[nodeId];
    const wrongFloor=structuredClone(result);wrongFloor.resolvedEndpoints[0].floorName='L3';
    const wrongPlace=structuredClone(result);wrongPlace.resolvedEndpoints[0].placeId='different-place';
    const wrongPortal=structuredClone(result);wrongPortal.journey.graph.portals[0].node_id='different-node';
    const wrongIncidence=structuredClone(result);wrongIncidence.journey.graph.edges[0][side==='origin'?'from_id':'to_id']='other';
    const wrongXYZ=structuredClone(result);wrongXYZ.routedEndpoints[side]=[...wrongXYZ.routedEndpoints[side]];wrongXYZ.routedEndpoints[side][2]+=1;
    const closed=structuredClone(result);closed.journey.graph.edges[0].disabled=true;
    for(const invalid of [wrongFloor,wrongPlace,wrongPortal,wrongIncidence,wrongXYZ,closed]){
      assert.equal(demoEndpointEvidenceMissing(request),false);
      assert.equal(annotateDemoFallback(invalid,request),null);
    }
  }
});

test('current source-backed LG1/L4 UI fixture matches only the missing-verifier-evidence condition, without changing its selected floor',()=>{
  const fixture=JSON.parse(readFileSync(new URL('./fixtures/point-matrix-v1.json',import.meta.url),'utf8'));
  const request=fixture.rows.find(row=>row.id==='mall-floors').request,before=structuredClone(request);
  assert.equal(request.origin.floorId,'250000101');assert.equal(request.destination.floorId,'250000073');
  for(const side of ['origin','destination']){
    assert.equal(Object.hasOwn(request[side],'node_id'),false);
    assert.equal(Object.hasOwn(request[side],'node_ids'),false);
    assert.equal(demoEndpointEvidenceMissing({[side]:request[side]}),true);
  }
  assert.equal(demoEndpointEvidenceMissing(request),true);
  assert.deepEqual(request,before);
});
