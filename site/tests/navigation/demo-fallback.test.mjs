import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoAccessibilityGraph, createDemoWalkLinks, annotateDemoFallback} from '../../src/navigation/demo-fallback.js';

const edge = (id, extra = {}) => ({id, physical_id: id, kind: 'walk', disabled: false, ...extra});
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
  assert.ok(annotateDemoFallback(connector, {need: 'accessible'}));
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
