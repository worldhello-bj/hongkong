/**
 * Pure, clock-driven transit display model. Input is the existing intermodal
 * router.network (raw services.json has bus/tram only). No realtime data,
 * invented routes, synthetic loops, or changes to routing are made here.
 *
 * Frequency windows are start-inclusive/end-exclusive, explicit departures are
 * merged and deduplicated, and calendars apply to the trip's service date,
 * including departures above 24:00. These are the scheduled router's semantics.
 */
const DAY = 86400;
const MAX_SCHEDULE_S = 7 * DAY;
// Keep only a few recent service-date bands per prepared pattern. In particular,
// a date picker or long-running clock must not accumulate an unbounded calendar.
const MAX_CACHED_DAY_WINDOWS = 4;
const MAX_CACHED_DAYS_PER_WINDOW = 16;
const MODES = new Set(['metro', 'bus', 'tram']);
const finite = Number.isFinite;
const lowerBound = (values, target) => {
  let lo = 0, hi = values.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (values[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};
const validPoint = point => Array.isArray(point) && point.length >= 2 &&
  point.slice(0, 2).every(finite) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90;
const clamp = value => Math.max(0, Math.min(1, value));

function dateEpoch(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new RangeError('Invalid service date');
  const time = Date.parse(`${date}T00:00:00Z`);
  if (!finite(time) || new Date(time).toISOString().slice(0, 10) !== date) throw new RangeError('Invalid service date');
  return time;
}
function serviceDate(epoch, day) {
  return new Date(epoch + day * DAY * 1000).toISOString().slice(0, 10);
}
function runsOn(calendar, epoch, day) {
  if (!calendar) return true;
  const date = serviceDate(epoch, day);
  const exception = calendar.exceptions?.find(entry => entry.date === date);
  if (exception) return exception.active === true;
  return (!calendar.startDate || date >= calendar.startDate) &&
    (!calendar.endDate || date <= calendar.endDate) &&
    (calendar.weekdays ?? []).includes(new Date(epoch + day * DAY * 1000).getUTCDay());
}
function scheduleDepartures(pattern) {
  const departures = new Set(pattern.schedule?.departuresS ?? []);
  for (const departure of departures) {
    if (!finite(departure) || departure < 0 || departure > MAX_SCHEDULE_S) throw new RangeError(`Invalid departure: ${pattern.id}`);
  }
  for (const window of pattern.schedule?.windows ?? []) {
    const {startS, endS, headwayS} = window;
    if (![startS, endS, headwayS].every(finite) || startS < 0 || endS > MAX_SCHEDULE_S || endS <= startS || headwayS < 1) {
      throw new RangeError(`Invalid frequency window: ${pattern.id}`);
    }
    for (let departure = startS; departure < endS; departure += headwayS) departures.add(departure);
  }
  return [...departures].sort((a, b) => a - b);
}
function distance(a, b) {
  const r = Math.PI / 180;
  const h = Math.sin((b[1] - a[1]) * r / 2) ** 2 +
    Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin((b[0] - a[0]) * r / 2) ** 2;
  return 12742000 * Math.asin(Math.min(1, Math.sqrt(h)));
}
function bearing(a, b) {
  const r = Math.PI / 180, lon = (b[0] - a[0]) * r;
  return (Math.atan2(Math.sin(lon) * Math.cos(b[1] * r),
    Math.cos(a[1] * r) * Math.sin(b[1] * r) -
    Math.sin(a[1] * r) * Math.cos(b[1] * r) * Math.cos(lon)) / r + 360) % 360;
}
function prepareGeometry(shape, firstIndex, lastIndex) {
  const points = shape.slice(firstIndex, lastIndex + 1).map(point => point.slice(0, 2));
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) cumulative.push(cumulative[i - 1] + distance(points[i - 1], points[i]));
  return {points, cumulative, length: cumulative.at(-1)};
}
function interpolate(geometry, progress) {
  const {points, cumulative, length} = geometry;
  if (points.length === 1 || !length) return {position: [...points[0]], bearing: 0};
  const target = clamp(progress) * length;
  let index = Math.min(points.length - 1, Math.max(1, lowerBound(cumulative, target)));
  // Ignore repeated vertices when choosing a direction at a stop.
  while (index < points.length - 1 && cumulative[index] === cumulative[index - 1]) index++;
  const a = points[index - 1], b = points[index], span = cumulative[index] - cumulative[index - 1];
  const fraction = span ? clamp((target - cumulative[index - 1]) / span) : 0;
  return {position: [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction], bearing: bearing(a, b)};
}
function preparePattern(pattern, stops) {
  if (!pattern.id || !Array.isArray(pattern.shape) || pattern.shape.length < 2 || !pattern.shape.every(validPoint) ||
      !Array.isArray(pattern.stops) || pattern.stops.length < 2) throw new TypeError(`Invalid transit pattern: ${pattern.id}`);
  for (let i = 0; i < pattern.stops.length; i++) {
    const call = pattern.stops[i], previous = pattern.stops[i - 1];
    if (!stops.has(call.stopId) || !finite(call.arrivalOffsetS) || !finite(call.departureOffsetS) ||
        call.arrivalOffsetS < 0 || call.departureOffsetS < call.arrivalOffsetS ||
        !Number.isInteger(call.shapeIndex) || call.shapeIndex < 0 || call.shapeIndex >= pattern.shape.length ||
        previous && (call.arrivalOffsetS < previous.departureOffsetS || call.shapeIndex < previous.shapeIndex)) {
      throw new TypeError(`Invalid transit call: ${pattern.id}/${i}`);
    }
  }
  if (pattern.stops[0].arrivalOffsetS !== 0 || pattern.stops[0].departureOffsetS !== 0) {
    throw new TypeError(`First transit call must start at zero: ${pattern.id}`);
  }
  return {
    pattern,
    departures: scheduleDepartures(pattern),
    dayWindows: new Map(),
    durationS: pattern.stops.at(-1).arrivalOffsetS,
    segments: pattern.stops.slice(0, -1).map((call, i) => prepareGeometry(pattern.shape, call.shapeIndex, pattern.stops[i + 1].shapeIndex))
  };
}
function* eligibleServiceDays(prepared, firstDay, lastDay, epoch) {
  for (let day = firstDay; day <= lastDay; day++) {
    if (runsOn(prepared.pattern.calendar, epoch, day)) yield {day, shift: day * DAY, date: undefined};
  }
}
function serviceDayWindow(prepared, firstDay, lastDay, epoch) {
  // The candidate service-day band stays constant through most animation
  // frames. Cache calendar decisions, not sampled vehicles: positions, dwell,
  // trip bounds and the original relative-second arithmetic remain live.
  if (lastDay - firstDay + 1 > MAX_CACHED_DAYS_PER_WINDOW) {
    return eligibleServiceDays(prepared, firstDay, lastDay, epoch);
  }
  const key = `${epoch}:${firstDay}:${lastDay}`, cache = prepared.dayWindows;
  if (cache.has(key)) {
    const days = cache.get(key);
    cache.delete(key);
    cache.set(key, days);
    return days;
  }
  const days = [...eligibleServiceDays(prepared, firstDay, lastDay, epoch)];
  cache.set(key, days);
  if (cache.size > MAX_CACHED_DAY_WINDOWS) cache.delete(cache.keys().next().value);
  return days;
}
function* tripsBetween(prepared, fromS, toS, epoch) {
  const {pattern, departures} = prepared;
  if (!departures.length) return;
  const firstDay = Math.floor((fromS - departures.at(-1)) / DAY);
  const lastDay = Math.floor((toS - departures[0]) / DAY);
  for (const serviceDay of serviceDayWindow(prepared, firstDay, lastDay, epoch)) {
    const {day, shift} = serviceDay;
    for (let i = lowerBound(departures, fromS - shift); i < departures.length && departures[i] + shift <= toS; i++) {
      const departure = departures[i], date = serviceDay.date ??= serviceDate(epoch, day);
      yield {id: `${pattern.id}:${date}:${departure}`, serviceDate: date, startS: departure + shift};
    }
  }
}
const description = pattern => ({
  patternId: pattern.id, routeId: pattern.routeId, mode: pattern.mode, label: pattern.label,
  direction: pattern.direction, geometryMode: pattern.geometryMode ?? 'schematic',
  scheduleKind: pattern.provenance?.scheduleKind ?? 'demo', provenance: pattern.provenance,
  simulated: true, realtime: false
});

/**
 * at(timeS, date?) returns active simulated vehicles. timeS is seconds relative
 * to date's Hong Kong midnight, not a Unix timestamp. No wall clock is read.
 * Geometry/dwell comes only from the supplied pattern. A vehicle disappears at
 * its terminal arrival. maxVehicles bounds display work, never route results.
 *
 * departures(stopId,timeS,date?,{limit,horizonS,patternId,mode,routeId,direction})
 * returns boardable departures at that stop, earliest first. arrivalS and
 * departureS are stop-specific; waitS is until departure. Terminal calls are
 * excluded. A still-dwelling vehicle has waitS >= 0 and arrivalS <= timeS.
 */
export function createTransitVehicleModel(services, {maxVehicles = 160} = {}) {
  if (!Number.isInteger(maxVehicles) || maxVehicles < 0 || maxVehicles > 1000) throw new RangeError('Invalid vehicle display limit');
  const stops = new Map((services?.stops ?? []).map(stop => [stop.id, stop]));
  const patterns = (services?.patterns ?? []).filter(pattern => MODES.has(pattern.mode));
  const seen = new Set();
  const prepared = patterns.map(pattern => {
    if (seen.has(pattern.id)) throw new TypeError(`Duplicate transit pattern: ${pattern.id}`);
    seen.add(pattern.id);
    return preparePattern(pattern, stops);
  });
  const baseDate = services?.baseDate ?? patterns.find(pattern => pattern.calendar?.baseDate)?.calendar.baseDate ?? '1970-01-01';
  let validatedDate = baseDate, validatedEpoch = dateEpoch(baseDate);
  const epochFor = date => {
    if (date !== validatedDate) {
      // Validate before replacing the last good date, including after a bad
      // date-picker value. The simulation still never reads the wall clock.
      const epoch = dateEpoch(date);
      validatedDate = date;
      validatedEpoch = epoch;
    }
    return validatedEpoch;
  };
  const callsByStop = new Map();
  for (const entry of prepared) entry.pattern.stops.slice(0, -1).forEach((call, index) => {
    const calls = callsByStop.get(call.stopId) ?? [];
    calls.push({entry, call, index});
    callsByStop.set(call.stopId, calls);
  });
  return {
    baseDate, timezone: services?.timezone ?? 'Asia/Hong_Kong',
    patterns, stops: [...stops.values()], maxVehicles,
    at(timeS, date = baseDate) {
      if (!finite(timeS)) throw new RangeError('Invalid service clock');
      const epoch = epochFor(date), groups = [];
      for (const entry of prepared) {
        const {pattern, durationS, segments} = entry, vehicles = [];
        for (const trip of tripsBetween(entry, timeS - durationS, timeS, epoch)) {
          const age = timeS - trip.startS;
          if (age >= durationS) continue;
          for (let index = 0; index < pattern.stops.length - 1; index++) {
            const from = pattern.stops[index], to = pattern.stops[index + 1];
            if (age < from.arrivalOffsetS || age >= to.arrivalOffsetS) continue;
            const dwelling = age < from.departureOffsetS;
            const segmentProgress = dwelling ? 0 : (age - from.departureOffsetS) / (to.arrivalOffsetS - from.departureOffsetS || 1);
            const sample = interpolate(segments[index], segmentProgress);
            vehicles.push({
              ...description(pattern), id: trip.id, tripId: trip.id, serviceDate: trip.serviceDate,
              ...sample, coordinates: [...sample.position], state: dwelling ? 'dwelling' : 'moving',
              fromStopId: from.stopId, toStopId: to.stopId, nextStopId: to.stopId,
              currentStopId: dwelling ? from.stopId : null, segmentProgress: clamp(segmentProgress),
              departureS: trip.startS, arrivalS: trip.startS + durationS,
              nextArrivalS: trip.startS + to.arrivalOffsetS,
              progress: durationS ? clamp(age / durationS) : 1
            });
            break;
          }
        }
        groups.push(vehicles);
      }
      // Round-robin patterns prevents a dense bus route hiding all metro/tram.
      const result = [];
      for (let index = 0; result.length < maxVehicles && groups.some(group => index < group.length); index++) {
        for (const group of groups) if (index < group.length && result.length < maxVehicles) result.push(group[index]);
      }
      return result;
    },
    departures(stopId, timeS, date = baseDate, options = {}) {
      if (!finite(timeS)) throw new RangeError('Invalid service clock');
      const epoch = epochFor(date), {limit = 3, horizonS = DAY} = options;
      if (!Number.isInteger(limit) || limit < 0 || limit > 1000 || !finite(horizonS) || horizonS < 0 || horizonS > MAX_SCHEDULE_S) {
        throw new RangeError('Invalid departure limit or horizon');
      }
      if (!limit) return [];
      const result = [];
      for (const {entry, call, index} of callsByStop.get(stopId) ?? []) {
        const pattern = entry.pattern;
        if (['patternId', 'mode', 'routeId', 'direction'].some(key => options[key] !== undefined && options[key] !== (key === 'patternId' ? pattern.id : pattern[key]))) continue;
        for (const trip of tripsBetween(entry, timeS - call.departureOffsetS, timeS + horizonS - call.departureOffsetS, epoch)) {
          const departureS = trip.startS + call.departureOffsetS;
          result.push({
            ...description(pattern), id: trip.id, tripId: trip.id, serviceDate: trip.serviceDate,
            stopId, stopName: stops.get(stopId)?.name ?? stopId,
            toStopId: pattern.stops[index + 1].stopId,
            departureS, arrivalS: trip.startS + call.arrivalOffsetS,
            waitS: Math.max(0, departureS - timeS), tripDepartureS: trip.startS,
            destinationStopId: pattern.stops.at(-1).stopId,
            destinationName: stops.get(pattern.stops.at(-1).stopId)?.name ?? pattern.stops.at(-1).stopId
          });
        }
      }
      result.sort((a, b) => a.departureS - b.departureS || a.id.localeCompare(b.id));
      return result.slice(0, limit);
    }
  };
}

/** Compatibility name for callers that need only the metro subset. */
export function createMetroVehicleModel(services, options) {
  return createTransitVehicleModel({...services, patterns: services?.patterns?.filter(pattern => pattern.mode === 'metro') ?? []}, options);
}
