/**
 * Official-timetable-derived high-speed rail demonstration. The observed MTR
 * planner has no travel-date selector: repeating its normal rows is a MODEL
 * ASSUMPTION, never a statement that a train operates or has tickets on a date.
 * All clocks are seconds from the caller's Hong Kong midnight; no wall clock,
 * realtime feed, invented frequency, or geographic railway track is used.
 */
const DAY = 86400;
const MINUTE = 60;
const MAX_HORIZON_S = 7 * DAY;
const MAX_CACHED_SERVICE_DAYS = 4;
const BASE_DATE = '2026-10-11';
const finite = Number.isFinite;
const deepFreeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};
const seconds = time => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 3600 + minutes * MINUTE;
};

// Verified 2026-10-13 against the official Journey Planner and its three-page
// short-haul PDF, effective 11 Oct 2026. Saturday-only extras are NOT included:
// northbound G5680/G5866; southbound G5865. Train codes retain the source's '/'.
const NORTHBOUND = [
  ['G5820', '07:07', '07:21'],
  ['G388', '07:20', '07:34'],
  ['G6390', '07:26', '07:40'],
  ['G5636', '07:31', '07:45'],
  ['G5822', '08:12', '08:26'],
  ['G6552', '08:30', '08:44'],
  ['G924', '08:48', '09:02'],
  ['G914/5', '09:02', '09:16'],
  ['G6510', '09:08', '09:22'],
  ['G5812', '09:23', '09:37'],
  ['G6048/5', '10:18', '10:32'],
  ['G5816', '10:23', '10:37'],
  ['G6528', '10:29', '10:43'],
  ['G6534', '10:35', '10:49'],
  ['G5630', '10:46', '11:00'],
  ['G5818', '11:25', '11:39'],
  ['G5858', '12:34', '12:48'],
  ['G5644', '12:46', '13:00'],
  ['G6530', '13:15', '13:29'],
  ['G5808', '13:24', '13:38'],
  ['G6536', '13:32', '13:47'],
  ['G6558', '13:38', '13:52'],
  ['G386/3', '13:58', '14:12'],
  ['G5646', '14:04', '14:18'],
  ['G6548', '14:32', '14:46'],
  ['G5810', '14:38', '14:52'],
  ['G5860', '14:46', '15:01'],
  ['G5806', '15:27', '15:41'],
  ['G6580', '16:04', '16:18'],
  ['G5828', '16:10', '16:24'],
  ['G6560', '16:49', '17:03'],
  ['G5814', '17:10', '17:24'],
  ['G5830', '17:24', '17:38'],
  ['G6590', '18:13', '18:27'],
  ['G5862', '18:19', '18:34'],
  ['G5614', '18:43', '18:57'],
  ['G5832', '18:49', '19:03'],
  ['G5652', '19:13', '19:27'],
  ['G6398', '19:20', '19:34'],
  ['G6588', '19:43', '19:57'],
  ['G5824', '19:54', '20:10'],
  ['G5612', '20:11', '20:25'],
  ['G5618', '20:20', '20:34'],
  ['G5654', '20:39', '20:53'],
  ['G6532', '20:57', '21:11'],
  ['G5826', '21:12', '21:26'],
  ['G5660', '21:44', '21:58'],
  ['G5604', '22:02', '22:16'],
  ['G6502', '22:11', '22:25'],
  ['G6506', '22:26', '22:40'],
  ['G6504', '22:37', '22:51'],
  ['G5608', '23:00', '23:14'],
];
const SOUTHBOUND = [
  ['G5669', '06:45', '07:00'],
  ['G5801', '06:52', '07:06'],
  ['G6501', '07:32', '07:46'],
  ['G5819', '07:38', '07:52'],
  ['G5625', '07:45', '07:59'],
  ['G5607', '07:51', '08:06'],
  ['G5609', '08:05', '08:19'],
  ['G5603', '08:15', '08:29'],
  ['G5637', '08:22', '08:36'],
  ['G5659', '08:27', '08:42'],
  ['G5821', '08:45', '09:01'],
  ['G6551', '08:53', '09:07'],
  ['G5627', '09:03', '09:17'],
  ['G6517', '09:08', '09:22'],
  ['G6397', '09:25', '09:39'],
  ['G6527', '09:35', '09:49'],
  ['G5617', '09:45', '10:00'],
  ['G5811', '09:53', '10:07'],
  ['G6579', '10:01', '10:15'],
  ['G6545', '10:07', '10:21'],
  ['G6581', '10:25', '10:39'],
  ['G5815', '10:54', '11:08'],
  ['G5641', '10:59', '11:13'],
  ['G6565', '11:04', '11:18'],
  ['G6572/3', '11:19', '11:34'],
  ['G6539', '11:26', '11:40'],
  ['G5817', '11:57', '12:12'],
  ['G6519', '12:06', '12:20'],
  ['G5857', '13:09', '13:23'],
  ['G6589', '13:21', '13:37'],
  ['G5807', '13:54', '14:08'],
  ['G6547', '13:59', '14:13'],
  ['G921', '14:06', '14:20'],
  ['G6507', '14:22', '14:37'],
  ['G6525', '14:28', '14:43'],
  ['G5621', '14:34', '14:48'],
  ['G5647', '14:56', '15:10'],
  ['G5809', '15:12', '15:26'],
  ['G5859', '15:24', '15:39'],
  ['G6533', '15:30', '15:45'],
  ['G5623', '15:55', '16:09'],
  ['G5805', '16:00', '16:14'],
  ['G6557', '16:17', '16:31'],
  ['G5635', '16:36', '16:50'],
  ['G5827', '16:50', '17:05'],
  ['G6559', '17:10', '17:24'],
  ['G5649', '17:21', '17:35'],
  ['G6523', '17:26', '17:40'],
  ['G5813', '17:45', '17:59'],
  ['G5829', '17:53', '18:07'],
  ['G5861', '18:53', '19:07'],
  ['G5831', '19:20', '19:34'],
  ['G6569', '19:28', '19:42'],
  ['G5653', '20:05', '20:19'],
  ['G5823', '20:35', '20:50'],
  ['G916/3', '21:08', '21:22'],
  ['G5655', '21:32', '21:46'],
  ['G5825', '21:52', '22:07'],
  ['G6563', '22:13', '22:27'],
  ['G6587', '22:19', '22:33'],
];

export const HIGH_SPEED_STATIONS = deepFreeze([
  {id:'HSR:WEK', name:'香港西九龙', coordinates:[114.1648,22.3049], lon:114.1648, lat:22.3049,
    detail:'高铁站概略位置；前往福田须在西九龙完成实名核验、安检及两地出入境手续。'},
  {id:'HSR:FUT', name:'深圳福田', coordinates:[114.0557,22.5383], lon:114.0557, lat:22.5383,
    detail:'高铁站概略位置；前往香港须预留进站安检时间，抵达西九龙后办理两地出入境手续。'}
]);
const SOURCES = deepFreeze({
  timetable:'https://www.highspeed.mtr.com.hk/res/pdf/short-haul-train-timetable.pdf',
  northboundPlanner:'https://www.highspeed.mtr.com.hk/en/trip-planner.html?id=WEK2FUT',
  southboundPlanner:'https://www.highspeed.mtr.com.hk/en/trip-planner.html?id=FUT2WEK',
  departureProcess:'https://www.highspeed.mtr.com.hk/en/guide/process-departure.html',
  arrivalProcess:'https://www.highspeed.mtr.com.hk/en/guide/process-arrival.html',
  stationHours:'https://www.highspeed.mtr.com.hk/en/about/wek.html',
  controlPointHours:'https://www.customs.gov.hk/en/service-enforcement-information/passenger-clearance/contact-us/index.html?print=1',
  effectiveFrom:BASE_DATE, retrievedAt:'2026-10-13T09:58:00Z'
});
const OPERATING_HOURS = deepFreeze({
  westKowloonStation:{opensS:6*3600,closesS:DAY},
  westKowloonControlPoint:{opensS:6*3600+30*MINUTE,closesS:23*3600+30*MINUTE}
});
const WARNINGS = deepFreeze([
  '班次取自2026年10月11日起生效的港铁官方时刻表；正常班次按日重复仅作演示，不保证任何指定日期开行，未包含周六加班车。',
  '非实时列车位置或余票查询；实际班次、票务及运行安排请以官方购票系统为准。',
  '地图仅按两站概略坐标绘制示意连线，不代表真实轨道、隧道走向或可步行路线。',
  '西九龙站服务时间为06:00至24:00，西九龙口岸为06:30至23:30；闭站期间须在站外另行安排等候，不能假定可在站内过夜。',
  '办理手续用时为模型预留，可能因证件、客流或检查而增加；本演示不确认车票或通关资格。'
]);
const stationById = new Map(HIGH_SPEED_STATIONS.map(station => [station.id, station]));
function makePattern(fromId, toId, rows, sourceUrl) {
  const from = stationById.get(fromId), to = stationById.get(toId);
  const trips = rows.map(([trainCode, departure, arrival]) => ({
    trainCode, departure, arrival,
    departureS:seconds(departure), arrivalS:seconds(arrival),
    durationS:seconds(arrival)-seconds(departure)
  }));
  return {
    id:`${fromId}:${toId}`, routeId:'HSR:WEK-FUT', mode:'highspeed',
    label:'广深港高铁', direction:`${from.name} → ${to.name}`,
    fromId, toId, geometryMode:'schematic', shape:[from.coordinates, to.coordinates],
    // Arrival offsets vary by train (14–16 min). Consumers must use trips;
    // assigning a fixed terminal offset would silently falsify some arrivals.
    stops:[{stopId:fromId, shapeIndex:0, arrivalOffsetS:0, departureOffsetS:0},
      {stopId:toId, shapeIndex:1, terminal:true}],
    schedule:{kind:'explicit-trips', departuresS:trips.map(trip => trip.departureS), trips},
    provenance:{scheduleKind:'official-timetable-derived-demo', sourceUrl,
      timetableUrl:SOURCES.timetable, effectiveFrom:BASE_DATE, retrievedAt:SOURCES.retrievedAt,
      recurrence:'illustrative-daily', dateSpecific:false, realtime:false}
  };
}
export const HIGH_SPEED_NETWORK = deepFreeze({
  baseDate:BASE_DATE, timezone:'Asia/Hong_Kong', stops:HIGH_SPEED_STATIONS,
  patterns:[
    makePattern('HSR:WEK','HSR:FUT',NORTHBOUND,SOURCES.northboundPlanner),
    makePattern('HSR:FUT','HSR:WEK',SOUTHBOUND,SOURCES.southboundPlanner)
  ],
  sources:SOURCES, warnings:WARNINGS, operatingHours:OPERATING_HOURS,
  simulated:true, realtime:false, dateSpecific:false
});

function dateEpoch(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new RangeError('Invalid service date');
  const epoch = Date.parse(`${date}T00:00:00Z`);
  if (!finite(epoch) || new Date(epoch).toISOString().slice(0,10) !== date) throw new RangeError('Invalid service date');
  return epoch;
}
function validateClock(timeS) {
  if (!finite(timeS) || Math.abs(timeS) > Number.MAX_SAFE_INTEGER / 1000) throw new RangeError('Invalid service clock');
}
function dayDate(epoch, day) {
  const date = new Date(epoch + day * DAY * 1000);
  if (!finite(date.getTime()) || date.getUTCFullYear() < 0 || date.getUTCFullYear() > 9999) {
    throw new RangeError('Invalid service clock date range');
  }
  return date.toISOString().slice(0,10);
}
function validateStopId(stopId) {
  if (typeof stopId !== 'string' || !stopId.trim()) throw new TypeError('Invalid high-speed station ID');
}
function heading(a, b) {
  const r = Math.PI / 180, lon = (b[0] - a[0]) * r;
  return (Math.atan2(Math.sin(lon) * Math.cos(b[1] * r),
    Math.cos(a[1] * r) * Math.sin(b[1] * r) -
    Math.sin(a[1] * r) * Math.cos(b[1] * r) * Math.cos(lon)) / r + 360) % 360;
}
function describe(pattern, row, date, shift) {
  const id = `${pattern.id}:${date}:${row.trainCode}:${row.departureS}`;
  return {
    id, tripId:id, patternId:pattern.id, routeId:pattern.routeId, date, serviceDate:date,
    mode:'highspeed', label:row.trainCode, trainCode:row.trainCode, direction:pattern.direction,
    fromStopId:pattern.fromId, toStopId:pattern.toId, nextStopId:pattern.toId,
    departure:row.departureS+shift, departureS:row.departureS+shift,
    arrivalS:row.arrivalS+shift, nextArrivalS:row.arrivalS+shift, durationS:row.durationS,
    geometryMode:'schematic', scheduleKind:pattern.provenance.scheduleKind,
    provenance:pattern.provenance, simulated:true, realtime:false, dateSpecific:false
  };
}

/**
 * Pure clock adapter matching transit-vehicles/stopDepartures. Only running
 * trains are returned by at(); departure is inclusive, terminal arrival is not.
 * departures() means timetable departures, NOT eligibility to complete border
 * procedures. planHighSpeedLeg() applies the required modeled arrival buffers.
 *
 * A model owns at most four cached service days. Sampled positions and returned
 * rows are never cached, so seeking/reversing a clock cannot retain stale state.
 */
export function createHighSpeedServiceModel() {
  const dayCache = new Map();
  let lastDate = BASE_DATE, lastEpoch = dateEpoch(BASE_DATE);
  const epochFor = date => {
    if (date !== lastDate) {
      const epoch = dateEpoch(date);
      lastDate = date; lastEpoch = epoch;
    }
    return lastEpoch;
  };
  const rowsForDay = (epoch, day) => {
    const date = dayDate(epoch, day);
    if (dayCache.has(date)) {
      const value = dayCache.get(date);
      dayCache.delete(date); dayCache.set(date,value);
      return value;
    }
    const value = HIGH_SPEED_NETWORK.patterns.flatMap(pattern =>
      pattern.schedule.trips.map(row => ({pattern, row, date})));
    dayCache.set(date,value);
    if (dayCache.size > MAX_CACHED_SERVICE_DAYS) dayCache.delete(dayCache.keys().next().value);
    return value;
  };
  const maxDurationS = Math.max(...HIGH_SPEED_NETWORK.patterns.flatMap(pattern => pattern.schedule.trips.map(row => row.durationS)));
  return {
    baseDate:BASE_DATE, timezone:HIGH_SPEED_NETWORK.timezone,
    patterns:HIGH_SPEED_NETWORK.patterns, stops:HIGH_SPEED_STATIONS,
    sources:SOURCES, warnings:WARNINGS,
    at(timeS, date = BASE_DATE) {
      validateClock(timeS);
      const epoch = epochFor(date), vehicles = [];
      for (let day = Math.floor((timeS-maxDurationS)/DAY); day <= Math.floor(timeS/DAY); day++) {
        for (const {pattern, row, date:serviceDate} of rowsForDay(epoch,day)) {
          const startS = row.departureS + day*DAY;
          if (timeS < startS || timeS >= row.arrivalS + day*DAY) continue;
          const progress = (timeS-startS)/row.durationS;
          const [from,to] = pattern.shape;
          const position = from.map((coordinate,index) => coordinate+(to[index]-coordinate)*progress);
          vehicles.push({...describe(pattern,row,serviceDate,day*DAY), position,
            coordinates:[...position], bearing:heading(from,to), state:'moving',
            currentStopId:null, progress, segmentProgress:progress});
        }
      }
      return vehicles.sort((a,b) => a.departureS-b.departureS || a.id.localeCompare(b.id));
    },
    departures(stopId, timeS, date = BASE_DATE, options = {}) {
      validateStopId(stopId); validateClock(timeS);
      const epoch = epochFor(date);
      if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Invalid departure options');
      const {limit=3,horizonS=DAY} = options;
      if (!Number.isInteger(limit) || limit < 0 || limit > 1000 || !finite(horizonS) || horizonS < 0 || horizonS > MAX_HORIZON_S) {
        throw new RangeError('Invalid departure limit or horizon');
      }
      // Validate the full query even when the requested stop is not covered.
      dayDate(epoch,Math.floor(timeS/DAY));
      dayDate(epoch,Math.floor((timeS+horizonS)/DAY));
      if (!limit || !stationById.has(stopId)) return [];
      const result = [];
      for (let day = Math.floor(timeS/DAY); day <= Math.floor((timeS+horizonS)/DAY); day++) {
        for (const {pattern,row,date:serviceDate} of rowsForDay(epoch,day)) {
          const departureS = row.departureS+day*DAY;
          if (pattern.fromId !== stopId || departureS < timeS || departureS > timeS+horizonS) continue;
          if (['patternId','mode','routeId','direction'].some(key => options[key] !== undefined && options[key] !== (key === 'patternId' ? pattern.id : pattern[key]))) continue;
          const trip = describe(pattern,row,serviceDate,day*DAY);
          result.push({...trip, stopId, stopName:stationById.get(stopId).name,
            // stopDepartures.arrivalS is the origin call, not terminal arrival.
            arrivalS:departureS, destinationArrivalS:trip.arrivalS,
            waitS:departureS-timeS, tripDepartureS:departureS,
            destinationStopId:pattern.toId, destinationName:stationById.get(pattern.toId).name});
        }
      }
      result.sort((a,b) => a.departureS-b.departureS || a.id.localeCompare(b.id));
      return result.slice(0,limit);
    }
  };
}

// Select by feasibility of the complete procedural timeline, not departure time
// alone. Absolute/continuous seconds retain the candidate's service-day hours.
function procedureTimes(readyS, departureS, arrivalS, northbound) {
  const day = Math.floor((northbound ? departureS : arrivalS)/DAY)*DAY;
  const stationOpenS = day+OPERATING_HOURS.westKowloonStation.opensS;
  const stationCloseS = day+OPERATING_HOURS.westKowloonStation.closesS;
  const controlOpenS = day+OPERATING_HOURS.westKowloonControlPoint.opensS;
  const controlCloseS = day+OPERATING_HOURS.westKowloonControlPoint.closesS;
  if (!northbound) {
    const immigrationStartS = Math.max(arrivalS,stationOpenS,controlOpenS);
    const immigrationEndS = immigrationStartS+45*MINUTE;
    return immigrationEndS <= controlCloseS && immigrationEndS <= stationCloseS
      ? {immigrationStartS,immigrationEndS,stationOpenS,stationCloseS,controlOpenS,controlCloseS} : null;
  }
  const verificationStartS = Math.max(readyS,departureS-90*MINUTE,stationOpenS);
  const verificationEndS = verificationStartS+5*MINUTE;
  const securityEndS = verificationEndS+15*MINUTE;
  const immigrationStartS = Math.max(securityEndS,controlOpenS);
  const immigrationEndS = immigrationStartS+15*MINUTE;
  const boardingStartS = Math.max(immigrationEndS,departureS-15*MINUTE);
  const boardingEndS = boardingStartS+5*MINUTE;
  if (verificationEndS > departureS-30*MINUTE || boardingEndS > departureS-5*MINUTE ||
      immigrationEndS > controlCloseS || departureS > stationCloseS) return null;
  return {verificationStartS,verificationEndS,securityEndS,immigrationStartS,immigrationEndS,
    boardingStartS,boardingEndS,stationOpenS,stationCloseS,controlOpenS,controlCloseS};
}

/**
 * Plan the earliest modeled eligible direct train from the supplied station.
 * Northbound needs 45 min before departure. Verification opens T−90/closes
 * T−30; boarding runs T−15..T−5. Modeled work: verification 5 min, security
 * 15 min, both immigration controls 15 min, boarding 5 min, plus explicit waits.
 * West Kowloon station opens 06:00; its control point operates 06:30–23:30.
 * Southbound uses an explicitly modeled 30 min Futian predeparture buffer and
 * 45 min for both immigration controls AFTER the train reaches West Kowloon.
 * waitS excludes processing and ride; processingS excludes all wait/ride parts.
 * arrivalS is rail arrival; endS includes any post-arrival immigration.
 */
export function planHighSpeedLeg({fromId,toId,readyS,departureDate=BASE_DATE} = {}) {
  validateStopId(fromId); validateStopId(toId); validateClock(readyS);
  const epoch = dateEpoch(departureDate);
  dayDate(epoch,Math.floor(readyS/DAY));
  const pattern = HIGH_SPEED_NETWORK.patterns.find(entry => entry.fromId === fromId && entry.toId === toId);
  if (!pattern) return null;
  const northbound = fromId === 'HSR:WEK';
  const requiredBufferS = (northbound ? 45 : 30)*MINUTE;
  const earliestDepartureS = readyS+requiredBufferS;
  let selected, procedures;
  // Recurrence is an explicit demo assumption; an eligible row always lies
  // within the next two service days. No searched date is called "available".
  const firstDay = Math.floor(earliestDepartureS/DAY);
  for (let day=firstDay; day<=firstDay+1 && !selected; day++) {
    for (const row of pattern.schedule.trips) {
      if (row.departureS+day*DAY < earliestDepartureS) continue;
      const candidate = describe(pattern,row,dayDate(epoch,day),day*DAY);
      const candidateProcedures = procedureTimes(readyS,candidate.departureS,candidate.arrivalS,northbound);
      if (!candidateProcedures) continue;
      selected = candidate; procedures = candidateProcedures; break;
    }
  }
  if (!selected) return null;
  const {departureS,arrivalS} = selected;
  const parts = [];
  const add = (kind,label,startS,endS,extra={}) => {
    if (endS > startS) parts.push({kind,label,startS,endS,durationS:endS-startS,...extra});
  };
  const stationPoint = stationById.get(fromId).coordinates;
  const overnightWait = Math.floor(departureS/DAY)>Math.floor(readyS/DAY);
  const outsideStationWait = northbound ? readyS<procedures.stationOpenS : overnightWait;
  if (northbound) {
    const {verificationStartS,verificationEndS,securityEndS,immigrationStartS,immigrationEndS,boardingStartS,boardingEndS} = procedures;
    add('wait',outsideStationWait ? '站外另行安排等候至西九龙06:00开站；闭站期间不可在站内等候'
      : '等候西九龙乘车手续开始（最早发车前90分钟）',readyS,verificationStartS,
      {stationId:fromId,outsideStation:outsideStationWait});
    add('verification','西九龙 B1 实名及车票核验（模型预留5分钟）',verificationStartS,verificationEndS,
      {stationId:fromId,opensS:Math.max(procedures.stationOpenS,departureS-90*MINUTE),cutoffS:departureS-30*MINUTE,modeled:true});
    add('security','西九龙安检（模型预留15分钟）',verificationEndS,securityEndS,
      {stationId:fromId,modeled:true});
    add('wait','等候西九龙口岸06:30开始办理出入境',securityEndS,immigrationStartS,{stationId:fromId});
    add('immigration','西九龙香港出境及内地入境（模型预留15分钟）',immigrationStartS,immigrationEndS,
      {stationId:fromId,opensS:procedures.controlOpenS,cutoffS:procedures.controlCloseS,modeled:true});
    add('wait','等候西九龙 B3 检票上车',immigrationEndS,boardingStartS);
    add('boarding','西九龙 B3 检票上车（模型预留5分钟）',boardingStartS,boardingEndS,
      {stationId:fromId,opensS:departureS-15*MINUTE,cutoffS:departureS-5*MINUTE,modeled:true});
    add('onboard-wait','车内等候发车',boardingEndS,departureS,{stationId:fromId});
  } else {
    const bufferStartS = departureS-requiredBufferS;
    add('wait',overnightWait ? '站外另行安排隔夜等候；福田站开放时间需另行确认'
      : '自行安排等候福田乘车手续；站内开放情况需另行确认',readyS,bufferStartS,
      {stationId:fromId,outsideStation:outsideStationWait,stationAccessUnverified:true});
    add('departure-buffer','福田站进站、安检及检票上车（模型预留30分钟）',bufferStartS,departureS,
      {stationId:fromId,modeled:true});
  }
  add('highspeed',`高铁 ${selected.trainCode} · ${pattern.direction}`,departureS,arrivalS,
    {mode:'highspeed',trainCode:selected.trainCode,tripId:selected.id,geometryMode:'schematic',
      coordinates:[stationPoint.slice(),stationById.get(toId).coordinates.slice()]});
  if (!northbound) {
    add('wait','等候西九龙口岸开始办理出入境',arrivalS,procedures.immigrationStartS,{stationId:toId});
    add('immigration','西九龙 B2 内地出境、香港入境及离站（模型预留45分钟）',procedures.immigrationStartS,procedures.immigrationEndS,
      {stationId:toId,opensS:procedures.controlOpenS,cutoffS:procedures.controlCloseS,modeled:true});
  }
  const waitKinds = new Set(['wait','onboard-wait']);
  const waitS = parts.filter(part => waitKinds.has(part.kind)).reduce((sum,part) => sum+part.durationS,0);
  const processingS = parts.filter(part => !waitKinds.has(part.kind) && part.kind !== 'highspeed').reduce((sum,part) => sum+part.durationS,0);
  return {
    fromId,toId,readyS,departureDate,departureS,arrivalS,endS:parts.at(-1).endS,
    waitS,processingS,requiredBufferS,durationS:parts.at(-1).endS-readyS,overnightWait,outsideStationWait,
    label:`高铁 ${selected.trainCode} · ${pattern.direction}`,trainCode:selected.trainCode,
    trip:selected,parts,sources:SOURCES,warnings:[...WARNINGS,
      ...(outsideStationWait ? ['本方案包含开站前或隔夜等候，须在站外另行安排；模型不提供住宿或保证站内可过夜。'] : []),
      northbound ? '模型要求至少提前45分钟到达西九龙；官方实名核验于发车前30分钟截止，上车检票为发车前15至5分钟。'
        : '福田发车前30分钟及西九龙抵达后45分钟均为模型预留；后者包含两地出入境手续，并非官方保证的办理时长。'],
    simulated:true,realtime:false,dateSpecific:false
  };
}
