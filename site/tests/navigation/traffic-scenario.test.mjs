import test from 'node:test';
import assert from 'node:assert/strict';
import {createTaxiSimulation, ROAD_GRAPH, DEMO_FLEET_BOUNDS, distanceM} from '../../src/taxi/roaming.js';
import {createTrafficScenario, createTrafficTaxiSimulation, TRAFFIC_SCENARIO_NOTE} from '../../src/navigation/traffic-scenario.js';

const departureDate = '2026-10-13', departureS = 28800;
const create = (options = {}) => createTrafficTaxiSimulation({createTaxiSimulation, departureDate, departureS, ...options});
const relativeQuotes = (simulation, time) => simulation.offerQuotes({nowS:time, passengerReadyS:time + 30}).map(quote => ({
  carId:quote.carId, currentState:quote.currentState,
  availableInS:quote.availableAtS - time, arrivalInS:quote.carArrivalS - time,
  pickupInS:quote.pickupS - time, dropoffInS:quote.dropoffS - time,
  previousDropoffInS:quote.previousOrder ? quote.previousOrder.dropoffS - time : null,
  deadheadEdges:quote.deadheadRoute.edgeIds, passengerEdges:quote.passengerRoute.edgeIds
}));
const positions = (simulation, time) => simulation.simulateAt(time).map(car => [car.id, car.position]);
const busyCars = (simulation, time) => simulation.simulateAt(time).filter(car => car.state === 'existingorder').map(car => car.id);

test('scenario metadata is stable, bounded and explicitly simulated', () => {
  const first = createTrafficScenario({departureDate, departureS});
  assert.deepEqual(first, createTrafficScenario({departureDate, departureS}));
  assert.ok(Object.isFrozen(first));
  assert.equal(first.timezone, 'Asia/Hong_Kong');
  assert.equal(first.simulated, true);
  assert.equal(first.realtime, false);
  assert.equal(first.persistentDayReplay, false);
  assert.equal(first.note, TRAFFIC_SCENARIO_NOTE);
  assert.ok(first.warmupS >= 120 && first.warmupS <= 300);
  assert.equal(first.simulationStartS, departureS - first.warmupS);
  assert.notEqual(first.id, createTrafficScenario({departureDate, departureS:departureS + 1}).id);
  assert.notEqual(first.seed, createTrafficScenario({departureDate, departureS, seed:43}).seed);
  // Same wall time expressed past midnight has the same scenario identity.
  const midnight = createTrafficScenario({departureDate, departureS:86400});
  const nextDay = createTrafficScenario({departureDate:'2026-10-14', departureS:0});
  assert.equal(midnight.id, nextDay.id);
  assert.equal(midnight.seed, nextDay.seed);
  assert.equal(midnight.warmupS, nextDay.warmupS);
});

test('invalid date/time inputs fail instead of silently selecting another scenario', () => {
  for (const date of [undefined, '', '2026-2-01', '2026-02-30', '2026-13-01', '2026-00-01']) {
    assert.throws(() => createTrafficScenario({departureDate:date, departureS}), /date/);
  }
  for (const time of [undefined, NaN, Infinity, -1, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => createTrafficScenario({departureDate, departureS:time}), /time/);
  }
  assert.throws(() => createTrafficScenario({departureDate:'9999-12-31', departureS:86400}), /calendar/);
  assert.throws(() => createTrafficScenario({departureDate, departureS, seed:1.5}), /seed/);
  assert.throws(() => createTrafficTaxiSimulation({departureDate, departureS}), /factory/);
  assert.equal(createTrafficScenario({departureDate:'2028-02-29', departureS:0}).departureDate, '2028-02-29');
});

test('same selected date/time reproduces full fleet, previous orders and quotes', () => {
  const first = create(), second = create();
  assert.equal(first.fleetSize, 48);
  assert.equal(first.startS, departureS);
  assert.deepEqual(first.simulateAt(departureS), second.simulateAt(departureS));
  assert.deepEqual(first.getCars(), second.getCars());
  assert.deepEqual(relativeQuotes(first, departureS), relativeQuotes(second, departureS));
  const defaultTimeQuote = first.offerQuotes({passengerReadyS:departureS + 30})[0];
  assert.ok(defaultTimeQuote);
  assert.equal(defaultTimeQuote.quotedAtS, departureS, 'default quote must use selected time, not warm-up start');
});

test('different date or time changes physical positions, busy cars and relative quotes', () => {
  const morning = create(), later = create({departureS:39600}), nextDay = create({departureDate:'2026-10-14'});
  const referencePositions = positions(morning, departureS);
  const referenceBusy = busyCars(morning, departureS);
  const referenceQuotes = relativeQuotes(morning, departureS);
  assert.ok(referenceQuotes.length > 0);
  for (const [simulation, time] of [[later, 39600], [nextDay, departureS]]) {
    assert.notDeepEqual(positions(simulation, time), referencePositions, 'not just a clock offset');
    assert.notDeepEqual(busyCars(simulation, time), referenceBusy);
    assert.notEqual(busyCars(simulation, time).length, referenceBusy.length);
    const quotes = relativeQuotes(simulation, time);
    assert.ok(quotes.length > 0);
    assert.notDeepEqual(quotes, referenceQuotes);
    assert.notEqual(quotes[0].arrivalInS, referenceQuotes[0].arrivalInS);
    assert.notEqual(quotes[0].dropoffInS, referenceQuotes[0].dropoffInS);
  }
});

test('warm-up keeps directed road geometry, turn restrictions and prior-order-before-pickup', () => {
  const simulation = create();
  const quotes = simulation.offerQuotes({nowS:departureS, passengerReadyS:departureS + 30, maxCandidates:72});
  const busyQuote = quotes.find(quote => quote.currentState === 'existingorder');
  assert.ok(busyQuote, 'fixture must exercise finishing a prior order');
  for (const quote of quotes) {
    assert.ok(quote.availableAtS >= departureS);
    assert.equal(quote.carArrivalS, quote.availableAtS + quote.deadheadRoute.durationS);
    if (quote.currentState === 'existingorder') {
      assert.ok(Math.abs(quote.availableAtS - quote.previousOrder.dropoffS) < 1e-6);
      assert.ok(quote.pickupS >= quote.previousOrder.dropoffS);
    }
  }
  simulation.reserveQuote(busyQuote.id);
  assert.equal(simulation.simulateAt(departureS).find(car => car.id === busyQuote.carId).state, 'existingorder');
  simulation.prepareUntil(busyQuote.pickupS + 1);
  assert.equal(simulation.simulateAt(busyQuote.pickupS + 1).find(car => car.id === busyQuote.carId).state, 'passengertrip');
  const restrictions = new Map();
  for (const restriction of ROAD_GRAPH.restrictions) {
    const key = restriction.via + '|' + restriction.fromWay;
    const list = restrictions.get(key) ?? [];
    list.push(restriction); restrictions.set(key, list);
  }
  for (const car of simulation.getCars()) for (let i = 0; i < car.segments.length; i++) {
    const segment = car.segments[i], previous = car.segments[i - 1];
    assert.ok(segment.endS > segment.startS);
    const edge = ROAD_GRAPH.edges[segment.edgeId];
    if (segment.fromId !== segment.toId) {
      assert.equal(edge.from, segment.fromId); assert.equal(edge.to, segment.toId);
    }
    if (['roaming', 'existingorder'].includes(segment.state) && !segment.waitingOutsideBounds) {
      for (const [lon, lat] of edge?.geometry ?? [ROAD_GRAPH.nodes[segment.fromId]]) {
        assert.ok(lon >= DEMO_FLEET_BOUNDS[0] && lon <= DEMO_FLEET_BOUNDS[2]);
        assert.ok(lat >= DEMO_FLEET_BOUNDS[1] && lat <= DEMO_FLEET_BOUNDS[3]);
      }
    }
    if (!previous) continue;
    assert.ok(Math.abs(segment.startS - previous.endS) < 1e-6);
    assert.equal(segment.fromId, previous.toId);
    if (segment.fromId === segment.toId) continue;
    for (const restriction of restrictions.get(segment.fromId + '|' + previous.way) ?? []) {
      if (restriction.kind.startsWith('no_')) assert.notEqual(segment.way, restriction.toWay);
      if (restriction.kind.startsWith('only_')) assert.equal(segment.way, restriction.toWay);
    }
  }
});

test('forward ticking retains a single fleet and reservation with continuous positions', () => {
  let creations = 0;
  const simulation = create({createTaxiSimulation:options => { creations++; return createTaxiSimulation(options); }});
  const scenario = simulation.scenario;
  const quote = simulation.offerQuotes({passengerReadyS:departureS + 30})[0];
  simulation.reserveQuote(quote.id);
  let previous = simulation.simulateAt(departureS);
  for (const elapsed of [0.1, 0.2, 0.3, 0.4, 0.5]) {
    simulation.prepareUntil(departureS + elapsed + 300);
    const current = simulation.simulateAt(departureS + elapsed);
    for (let i = 0; i < current.length; i++) {
      assert.equal(current[i].id, previous[i].id);
      assert.ok(distanceM(previous[i].position, current[i].position) < 5, 'no per-tick teleport');
    }
    previous = current;
  }
  assert.equal(creations, 1);
  assert.equal(simulation.scenario, scenario);
  assert.equal(simulation.getCars().find(car => car.id === quote.carId).reservation.id, quote.id);
  assert.throws(() => simulation.reserveQuote(quote.id), /reserved/);
});

test('late date/time initialization is bounded rather than replaying the day', () => {
  let options, preparedAt;
  const stub = {prepareUntil:time => {preparedAt = time;}, offerQuotes:request => request};
  const simulation = createTrafficTaxiSimulation({
    createTaxiSimulation:received => {options = received; return stub;},
    departureDate:'2099-12-31', departureS:86399, fleetSize:48
  });
  assert.equal(simulation, stub);
  assert.equal(options.fleetSize, 48);
  assert.ok(86399 - options.nowS >= 120 && 86399 - options.nowS <= 300);
  assert.equal(preparedAt, 86699);
  assert.equal(simulation.offerQuotes({passengerReadyS:86450}).nowS, 86399);
});
