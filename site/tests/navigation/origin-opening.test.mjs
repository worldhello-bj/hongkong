import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { evaluateOriginOpening } from '../../src/navigation/origin-opening.js';

globalThis.document = { createElement: () => ({ relList: { supports: () => true } }) };
const engine = await import('../../dist/assets/mobile-navigation-DfEsS_7b.js');
const graph = JSON.parse(gunzipSync(readFileSync(new URL('../../dist/area/admiralty-block-graph.json.gz', import.meta.url))));
const place = graph.places.find(p => p.id === 'pacific-place');
const point = floor => ({ id: `${place.id}:floor:${floor.id}`, namedPlaceId: place.id, floorId: floor.id, coordinates: [...place.coordinates] });
const request = (origin, departureS = 28800) => ({ origin, destination: { id: 'outdoor', coordinates: [114.165, 22.28] }, departureDate: '2026-10-13', departureS });

test('all five loaded floors use the existing source-origin predicate and preserve requests', () => {
  assert.equal(place.floors.length, 5);
  for (const floor of place.floors) for (const time of [28800, 28980, 35999, 36000, 39600, 79199, 79200, 82800, 86400 + 28800]) {
    const r = request(point(floor), time), before = JSON.stringify(r), source = { ...r.origin, access_time_id: place.access_time_id, access_schedule: place.access_schedule };
    const result = evaluateOriginOpening(r, graph, engine.t);
    assert.equal(!!result, !engine.t(source, time, 0, r.departureDate), `${floor.name} at ${time}`);
    if (result) {
      assert.equal(result.failureStatus, 'NO_ROUTE');
      assert.equal(result.reason, 'source-origin-opening-constraint');
      assert.equal(result.sourceRuleId, place.access_time_id);
      assert.equal(result.floorId, floor.id);
      assert.match(result.message, /不代表整座场地关闭/);
    }
    assert.equal(JSON.stringify(r), before);
  }
});

test('named floor uses source data rather than stale request schedules; whole-place taxi semantics stay unchanged', () => {
  const origin = { ...point(place.floors[0]), access_time_id: 999, access_schedule: { kind: 'daily', windows: [{ start_s: 0, end_s: 86400 }], source_rule_id: 999 } };
  assert.ok(evaluateOriginOpening(request(origin), graph, engine.t));
  assert.equal(evaluateOriginOpening(request(origin, 39600), graph, engine.t), null);
  assert.equal(evaluateOriginOpening(request({ id: place.id, namedPlaceId: place.id, coordinates: [...place.coordinates] }), graph, engine.t), null);
});

test('destination closure at departure, unrelated points, portals, and unknown floors do not short-circuit', () => {
  const floor = place.floors[0], origin = point(floor), portalId = floor.entrance_ids[0], portal = graph.portals.find(p => p.id === portalId);
  assert.equal(evaluateOriginOpening({ ...request({ id: 'outdoor' }), destination: origin }, graph, engine.t), null);
  for (const p of [
    { ...origin, id: 'arbitrary-coordinate' },
    { ...origin, id: `${place.id}:floor:missing`, floorId: 'missing' },
    { ...origin, node_id: portal.node_id },
    { ...origin, node_ids: [portal.node_id] },
    { ...portal, namedPlaceId: place.id },
    { id: 'outdoor', access_time_id: place.access_time_id, access_schedule: place.access_schedule }
  ]) assert.equal(evaluateOriginOpening(request(p), graph, engine.t), null);
  assert.equal(evaluateOriginOpening(request(origin), {}, engine.t), null);
  assert.equal(evaluateOriginOpening(request(origin), { ...graph, portals: [] }, engine.t), null);
  assert.equal(evaluateOriginOpening(request(origin), { ...graph, nodes: [] }, engine.t), null);
});

test('malformed clock or source metadata falls through to the authoritative router', () => {
  const r = request(point(place.floors[0]));
  for (const clock of [{ departureS: NaN }, { departureS: -1 }, { departureDate: '2026-02-30' }, { departureDate: '0000-01-01' }])
    assert.equal(evaluateOriginOpening({ ...r, ...clock }, graph, engine.t), null);
  for (const edit of [{ access_time_id: null }, { access_schedule: undefined }, { access_schedule: { ...place.access_schedule, source_rule_id: 1 } }, { access_schedule: { ...place.access_schedule, windows: [{ start_s: 20, end_s: 10 }] } }])
    assert.equal(evaluateOriginOpening(r, { ...graph, places: [{ ...place, ...edit }] }, engine.t), null);
});

test('weekly source windows retain original date/day and midnight semantics', () => {
  const weekly = { ...place.access_schedule, kind: 'weekly', week_start: 'MON', windows: [{ start_s: 86400 + 36000, end_s: 86400 + 79200 }] };
  const g = { ...graph, places: [{ ...place, access_schedule: weekly }] }, r = request(point(place.floors[0]), 39600);
  assert.equal(evaluateOriginOpening(r, g, engine.t), null); // Tuesday
  assert.ok(evaluateOriginOpening({ ...r, departureDate: '2026-10-14' }, g, engine.t));
  assert.ok(evaluateOriginOpening({ ...r, departureS: 79200 }, g, engine.t));
});
