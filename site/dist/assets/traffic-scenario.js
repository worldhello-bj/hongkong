/**
 * Selected-time taxi scenarios, not a live feed or a persistent day replay.
 *
 * Explicit date/time edits select a new reproducible synthetic snapshot. Keep
 * its simulation instance for clock ticks, route planning and taxi toggles;
 * do not call this factory on each tick. Existing road routing, previous-order
 * completion and reservations stay in the taxi simulation unchanged.
 *
 * The road module is injected to preserve the UI's lazy road-graph import.
 */
export const TRAFFIC_SCENARIO_VERSION = 'selected-time-taxi-v1';
export const TRAFFIC_SCENARIO_NOTE = '按所选日期和时刻生成可复现的模拟车队；更改日期或时刻会切换模拟场景。不是实时车况，也不是同一天的连续回放。';

const DAY_S = 86400;
const WARMUP_MIN_S = 120;
const WARMUP_MAX_S = 300;

function hash32(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  }
  return hash >>> 0;
}

/** Pure, timezone-independent selection metadata. Times use Hong Kong local days. */
export function createTrafficScenario({departureDate, departureS, seed = 42} = {}) {
  if (typeof departureDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(departureDate)) {
    throw new Error('Expected a departure date in YYYY-MM-DD form');
  }
  // UTC is only used for calendar arithmetic; never interpret the selection in
  // the browser's local timezone or treat this timestamp as a live observation.
  const dayMs = Date.parse(departureDate + 'T00:00:00.000Z');
  if (!Number.isFinite(dayMs) || new Date(dayMs).toISOString().slice(0, 10) !== departureDate) {
    throw new Error('Invalid departure date');
  }
  if (!Number.isFinite(departureS) || departureS < 0 || !Number.isSafeInteger(Math.floor(departureS))) {
    throw new Error('Invalid departure time');
  }
  if (!Number.isSafeInteger(seed)) throw new Error('Invalid scenario seed');

  const days = Math.floor(departureS / DAY_S);
  const selectedDay = new Date(dayMs + days * DAY_S * 1000);
  if (!Number.isFinite(selectedDay.getTime()) || selectedDay.getUTCFullYear() > 9999) {
    throw new Error('Departure time exceeds supported calendar range');
  }
  const canonicalDate = selectedDay.toISOString().slice(0, 10);
  const secondOfDayS = departureS - days * DAY_S;
  const baseSeed = seed >>> 0;
  const id = `${TRAFFIC_SCENARIO_VERSION}|${baseSeed}|${canonicalDate}|${secondOfDayS}`;
  // A bounded warm-up lets some synthetic prior orders finish by the selected
  // time without replaying hours or days. Movement remains on legal road edges.
  const warmupS = WARMUP_MIN_S + hash32(id + '|warmup') % (WARMUP_MAX_S - WARMUP_MIN_S + 1);
  return Object.freeze({
    id, version: TRAFFIC_SCENARIO_VERSION, departureDate, departureS,
    canonicalDate, secondOfDayS, timezone: 'Asia/Hong_Kong',
    baseSeed, seed: hash32(id), warmupS, simulationStartS: departureS - warmupS,
    simulated: true, realtime: false, persistentDayReplay: false,
    note: TRAFFIC_SCENARIO_NOTE
  });
}

/** Build once for an explicit selection, then use the original simulation API. */
export function createTrafficTaxiSimulation({
  createTaxiSimulation, departureDate, departureS, seed = 42,
  fleetSize = 48, roamingBounds
} = {}) {
  if (typeof createTaxiSimulation !== 'function') throw new Error('Taxi simulation factory is required');
  const scenario = createTrafficScenario({departureDate, departureS, seed});
  const simulation = createTaxiSimulation({
    seed: scenario.seed, fleetSize, nowS: scenario.simulationStartS, roamingBounds
  });
  simulation.prepareUntil(departureS + 300);
  // The core's default quote time is its initialization time. Hide the warm-up
  // from callers that omit nowS, while explicit later queries keep their time.
  const offerQuotes = simulation.offerQuotes;
  simulation.offerQuotes = ({nowS = departureS, ...request} = {}) => offerQuotes({...request, nowS});
  // startS is the user-facing selectable window, not the internal warm-up start.
  simulation.startS = departureS;
  simulation.scenario = scenario;
  return simulation;
}
