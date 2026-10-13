import test from 'node:test';
import assert from 'node:assert/strict';
import {HIGH_SPEED_NETWORK, HIGH_SPEED_STATIONS, createHighSpeedServiceModel, planHighSpeedLeg} from '../../src/navigation/highspeed-service.js';

const DAY = 86400;
const date = '2026-10-13';
const time = value => value.split(':').reduce((sum,number) => sum*60+Number(number),0)*60;
const north = (readyS, departureDate=date) => planHighSpeedLeg({fromId:'HSR:WEK',toId:'HSR:FUT',readyS,departureDate});
const south = (readyS, departureDate=date) => planHighSpeedLeg({fromId:'HSR:FUT',toId:'HSR:WEK',readyS,departureDate});
const close = (actual,expected) => assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);
const sumParts = parts => parts.reduce((sum,part) => sum+part.endS-part.startS,0);

function assertContiguous(plan) {
  assert.equal(plan.parts[0].startS,plan.readyS);
  assert.equal(plan.parts.at(-1).endS,plan.endS);
  for (const [index,part] of plan.parts.entries()) {
    assert.ok(part.endS>part.startS);
    assert.equal(part.durationS,part.endS-part.startS);
    if (index) assert.equal(part.startS,plan.parts[index-1].endS);
  }
  close(sumParts(plan.parts),plan.endS-plan.readyS);
  close(plan.waitS+plan.processingS+plan.trip.durationS,plan.durationS);
}

test('network retains all verified normal rows, exact irregular departures and provenance',()=>{
  const [northbound,southbound] = HIGH_SPEED_NETWORK.patterns;
  assert.equal(HIGH_SPEED_STATIONS.length,2);
  assert.equal(northbound.schedule.trips.length,52);
  assert.equal(southbound.schedule.trips.length,60);
  assert.deepEqual(northbound.schedule.trips.slice(0,5).map(row => [row.trainCode,row.departure,row.arrival]),[
    ['G5820','07:07','07:21'],['G388','07:20','07:34'],['G6390','07:26','07:40'],
    ['G5636','07:31','07:45'],['G5822','08:12','08:26']
  ]);
  assert.equal(northbound.schedule.trips.at(-1).departure,'23:00');
  assert.equal(southbound.schedule.trips[0].departure,'06:45');
  assert.equal(southbound.schedule.trips.at(-1).departure,'22:19');
  assert.equal(HIGH_SPEED_NETWORK.sources.effectiveFrom,'2026-10-11');
  assert.equal(HIGH_SPEED_NETWORK.sources.timetable,'https://www.highspeed.mtr.com.hk/res/pdf/short-haul-train-timetable.pdf');
  assert.equal(HIGH_SPEED_NETWORK.sources.stationHours,'https://www.highspeed.mtr.com.hk/en/about/wek.html');
  assert.match(HIGH_SPEED_NETWORK.sources.controlPointHours,/customs\.gov\.hk/);
  assert.deepEqual(HIGH_SPEED_NETWORK.operatingHours,{
    westKowloonStation:{opensS:time('06:00'),closesS:DAY},
    westKowloonControlPoint:{opensS:time('06:30'),closesS:time('23:30')}
  });
  for (const pattern of HIGH_SPEED_NETWORK.patterns) {
    assert.equal(pattern.mode,'highspeed');
    assert.equal(pattern.geometryMode,'schematic');
    assert.equal(pattern.provenance.dateSpecific,false);
    assert.equal(pattern.provenance.recurrence,'illustrative-daily');
    assert.equal(pattern.shape.length,2);
    assert.equal(pattern.schedule.windows,undefined);
    assert.equal(pattern.stops.at(-1).arrivalOffsetS,undefined,'variable ride times must not become a fixed terminal offset');
    for (const row of pattern.schedule.trips) {
      assert.equal(row.arrivalS-row.departureS,row.durationS);
      assert.ok([840,900,960].includes(row.durationS));
      assert.ok(!['G5680','G5866','G5865'].includes(row.trainCode));
    }
  }
  assert.match(HIGH_SPEED_NETWORK.warnings.join(' '),/不保证.*指定日期/);
  assert.match(HIGH_SPEED_NETWORK.warnings.join(' '),/示意.*不代表真实轨道/);
});

test('at returns only moving trains within the departure-inclusive arrival-exclusive interval',()=>{
  const model = createHighSpeedServiceModel();
  const dep = time('07:07'), arr = time('07:21');
  assert.ok(!model.at(dep-0.001,date).some(row => row.trainCode==='G5820'));
  const first = model.at(dep,date).find(row => row.trainCode==='G5820');
  assert.deepEqual(first.position,HIGH_SPEED_STATIONS[0].coordinates);
  assert.equal(first.departureS,dep);
  assert.equal(first.arrivalS,arr);
  assert.equal(first.nextArrivalS,arr);
  assert.equal(first.state,'moving');
  assert.equal(first.nextStopId,'HSR:FUT');
  assert.ok(model.at(arr-0.001,date).some(row => row.id===first.id));
  assert.ok(!model.at(arr,date).some(row => row.id===first.id));
  assert.deepEqual(model.at(time('03:00'),date),[]);
});

test('positions interpolate explicitly schematic endpoints deterministically in both directions',()=>{
  const model = createHighSpeedServiceModel();
  const forward = model.at(time('07:14'),date).find(row => row.trainCode==='G5820');
  const reverse = model.at(time('06:59'),date).find(row => row.trainCode==='G5801');
  for (const vehicle of [forward,reverse]) {
    assert.equal(vehicle.progress,0.5);
    close(vehicle.position[0],(114.1648+114.0557)/2);
    close(vehicle.position[1],(22.3049+22.5383)/2);
    assert.equal(vehicle.geometryMode,'schematic');
    assert.equal(vehicle.mode,'highspeed');
    assert.equal(vehicle.realtime,false);
    assert.equal(vehicle.simulated,true);
    assert.equal(vehicle.dateSpecific,false);
    assert.equal(vehicle.serviceDate,date);
    assert.equal(vehicle.date,date);
  }
  assert.ok(forward.bearing>270 && forward.bearing<360);
  assert.ok(reverse.bearing>90 && reverse.bearing<180);
  assert.deepEqual(model.at(time('07:14'),date),model.at(time('07:14'),date));
  assert.notDeepEqual(model.at(time('07:14')+1,date).find(row => row.id===forward.id).position,forward.position);
});

test('stop queries preserve origin-call and train-arrival semantics and exact 14/15/16 minute rides',()=>{
  const model = createHighSpeedServiceModel();
  const [row] = model.departures('HSR:FUT',time('08:45'),date,{horizonS:0});
  assert.equal(row.trainCode,'G5821');
  assert.equal(row.arrivalS,time('08:45'));
  assert.equal(row.departureS,time('08:45'));
  assert.equal(row.destinationArrivalS,time('09:01'));
  assert.equal(row.nextArrivalS,time('09:01'));
  assert.equal(row.durationS,16*60);
  assert.equal(row.waitS,0);
  assert.equal(row.destinationStopId,'HSR:WEK');
  assert.equal(row.tripId,model.at(time('08:50'),date).find(vehicle => vehicle.trainCode==='G5821').tripId);
  const [fifteen] = model.departures('HSR:WEK',time('13:32'),date,{horizonS:0});
  assert.equal(fifteen.trainCode,'G6536');
  assert.equal(fifteen.destinationArrivalS,time('13:47'));
  assert.equal(fifteen.durationS,900);
  const future = model.departures('HSR:WEK',time('07:07')+0.01,date,{limit:3,horizonS:3600});
  assert.deepEqual(future.map(trip => trip.trainCode),['G388','G6390','G5636']);
  assert.deepEqual(model.departures('not-covered',0,date),[]);
  assert.deepEqual(model.departures('HSR:WEK',0,date,{mode:'metro'}),[]);
  assert.equal(model.departures('HSR:WEK',0,date,{patternId:HIGH_SPEED_NETWORK.patterns[0].id})[0].trainCode,'G5820');
});

test('normal timetable repeats only as a disclosed demo and Saturday extras stay excluded',()=>{
  const model = createHighSpeedServiceModel();
  for (const day of ['2026-10-13','2026-10-17','2026-10-18']) {
    const forward = model.departures('HSR:WEK',0,day,{limit:100,horizonS:DAY-1});
    const reverse = model.departures('HSR:FUT',0,day,{limit:100,horizonS:DAY-1});
    assert.equal(forward.length,52);
    assert.equal(reverse.length,60);
    assert.ok([...forward,...reverse].every(row => row.dateSpecific===false));
    assert.ok([...forward,...reverse].every(row => !['G5680','G5866','G5865'].includes(row.trainCode)));
  }
});

test('continuous clocks retain actual service date and identity when rebased across midnight',()=>{
  const model = createHighSpeedServiceModel();
  const before = model.at(DAY+time('07:14'),date);
  const after = model.at(time('07:14'),'2026-10-14');
  assert.deepEqual(before.map(row => row.id),after.map(row => row.id));
  assert.deepEqual(before.map(row => row.position),after.map(row => row.position));
  for (let index=0;index<before.length;index++) {
    assert.equal(before[index].departureS,after[index].departureS+DAY);
    assert.equal(before[index].arrivalS,after[index].arrivalS+DAY);
    assert.equal(before[index].serviceDate,'2026-10-14');
  }
  const previous = model.at(time('07:14')-DAY,'2026-10-14');
  assert.deepEqual(previous.map(row => row.id),model.at(time('07:14'),date).map(row => row.id));
  const [tomorrow] = model.departures('HSR:WEK',time('23:01'),date);
  assert.equal(tomorrow.departureS,DAY+time('07:07'));
  assert.equal(tomorrow.serviceDate,'2026-10-14');
  const [far] = model.departures('HSR:WEK',DAY*32+time('07:07'),date,{horizonS:0});
  assert.equal(far.serviceDate,'2026-11-14');
});

test('northbound eligibility has an exact 45-minute boundary and skips a missed departure',()=>{
  const dep = time('07:07');
  const exact = north(dep-45*60);
  assert.equal(exact.trainCode,'G5820');
  assert.equal(exact.departureS,dep);
  assert.equal(exact.arrivalS,time('07:21'));
  assert.equal(exact.endS,exact.arrivalS);
  assert.equal(exact.processingS,40*60);
  assert.equal(exact.waitS,5*60);
  assert.equal(exact.requiredBufferS,45*60);
  assert.equal(exact.parts.find(part => part.kind==='verification').endS,dep-40*60);
  assert.equal(exact.parts.find(part => part.kind==='boarding').startS,dep-10*60);
  assert.equal(exact.parts.find(part => part.kind==='boarding').endS,dep-5*60);
  assertContiguous(exact);
  const late = north(dep-45*60+0.001);
  assert.equal(late.trainCode,'G388');
  assert.equal(late.departureS,time('07:20'));
  assert.ok(late.departureS-late.readyS>=45*60);
  assertContiguous(late);
});

test('early northbound arrival waits outside until 06:00 and for immigration opening at 06:30',()=>{
  const early = north(time('03:00'));
  assert.equal(early.trainCode,'G5820');
  const verification = early.parts.find(part => part.kind==='verification');
  const boarding = early.parts.find(part => part.kind==='boarding');
  const security = early.parts.find(part => part.kind==='security');
  const immigration = early.parts.find(part => part.kind==='immigration');
  assert.equal(verification.startS,time('06:00'));
  assert.ok(verification.startS>=early.departureS-90*60);
  assert.ok(verification.endS<=early.departureS-30*60);
  assert.equal(security.startS,time('06:05'));
  assert.equal(security.endS,time('06:20'));
  assert.equal(immigration.startS,time('06:30'));
  assert.equal(immigration.endS,time('06:45'));
  assert.ok(immigration.endS<=boarding.startS);
  assert.equal(boarding.startS,early.departureS-15*60);
  assert.ok(boarding.endS<=early.departureS-5*60);
  assert.equal(early.parts[0].kind,'wait');
  assert.equal(early.parts[0].outsideStation,true);
  assert.equal(early.parts[0].endS,time('06:00'));
  assert.match(early.parts[0].label,/站外.*闭站/);
  assert.ok(early.parts.some(part => part.kind==='wait' && part.startS===time('06:20') && part.endS===time('06:30')));
  assert.equal(early.processingS,40*60);
  assert.equal(early.parts.filter(part => part.kind==='immigration').length,1);
  assert.ok(immigration.endS<early.departureS,'northbound immigration is before departure');
  assert.equal(early.outsideStationWait,true);
  assert.equal(early.overnightWait,false);
  assert.match(early.warnings.join(' '),/开站前或隔夜等候.*站外/);
  assertContiguous(early);
});

test('late-night planners roll over continuously and retain next-day train identity',()=>{
  const exactLast = north(time('22:15'));
  assert.equal(exactLast.trainCode,'G5608');
  assert.equal(exactLast.departureS,time('23:00'));
  const missedLast = north(time('22:15')+0.001);
  assert.equal(missedLast.trainCode,'G5820');
  assert.equal(missedLast.departureS,DAY+time('07:07'));
  assert.equal(missedLast.trip.serviceDate,'2026-10-14');
  assert.equal(missedLast.parts.find(part => part.kind==='verification').startS,DAY+time('06:00'));
  assert.equal(missedLast.parts.find(part => part.kind==='immigration').startS,DAY+time('06:30'));
  assert.equal(missedLast.parts[0].outsideStation,true);
  assert.equal(missedLast.overnightWait,true);
  assert.match(missedLast.parts[0].label,/站外.*闭站/);
  assertContiguous(missedLast);
  const continuous = north(DAY+time('06:22'));
  const rebased = north(time('06:22'),'2026-10-14');
  assert.equal(continuous.trip.id,rebased.trip.id);
  assert.equal(continuous.durationS,rebased.durationS);
  assert.equal(continuous.departureS,rebased.departureS+DAY);
});

test('southbound keeps Futian security separate and both immigration controls after HK arrival',()=>{
  const exact = south(time('06:15'));
  assert.equal(exact.trainCode,'G5669');
  assert.equal(exact.departureS,time('06:45'));
  assert.equal(exact.arrivalS,time('07:00'));
  assert.equal(exact.endS,time('07:45'));
  assert.equal(exact.processingS,75*60);
  assert.equal(exact.waitS,0);
  assert.equal(exact.requiredBufferS,30*60);
  assert.deepEqual(exact.parts.map(part => part.kind),['departure-buffer','highspeed','immigration']);
  assert.equal(exact.parts[0].stationId,'HSR:FUT');
  assert.equal(exact.parts.at(-1).stationId,'HSR:WEK');
  assert.equal(exact.parts.at(-1).startS,exact.arrivalS);
  assert.equal(exact.parts.at(-1).durationS,45*60);
  assert.match(exact.warnings.at(-1),/并非官方保证/);
  assertContiguous(exact);
  assert.equal(south(time('06:15')+0.001).trainCode,'G5801');
  const overnight = south(time('21:49')+0.001);
  assert.equal(overnight.trip.serviceDate,'2026-10-14');
  assert.equal(overnight.departureS,DAY+time('06:45'));
  assert.equal(overnight.parts[0].outsideStation,true);
  assert.match(overnight.parts[0].label,/站外.*隔夜/);
  assertContiguous(overnight);
});

test('the final southbound arrival finishes modeled immigration before control-point closure',()=>{
  const last=south(time('21:49'));
  assert.equal(last.trainCode,'G6587');
  assert.equal(last.arrivalS,time('22:33'));
  assert.equal(last.endS,time('23:18'));
  assert.ok(last.endS<time('23:30'));
  assertContiguous(last);
});

test('all supported plans preserve global time and comply with station, control-point and boarding hours',()=>{
  for (let readyS=-3600;readyS<2*DAY;readyS+=137) {
    for (const plan of [north(readyS),south(readyS)]) {
      assertContiguous(plan);
      assert.ok(plan.departureS-plan.readyS>=plan.requiredBufferS);
      assert.equal(plan.trip.arrivalS,plan.arrivalS);
      const stationDay=Math.floor((plan.fromId==='HSR:WEK' ? plan.departureS : plan.arrivalS)/DAY)*DAY;
      const immigration=plan.parts.find(part => part.kind==='immigration');
      assert.ok(immigration.startS>=stationDay+time('06:30'));
      assert.ok(immigration.endS<=stationDay+time('23:30'));
      assert.ok(immigration.endS<=stationDay+DAY);
      if (plan.fromId==='HSR:WEK') {
        const verification=plan.parts.find(part => part.kind==='verification');
        const boarding=plan.parts.find(part => part.kind==='boarding');
        assert.equal(plan.processingS,40*60);
        assert.equal(plan.parts.find(part => part.kind==='security').durationS,15*60);
        assert.equal(immigration.durationS,15*60);
        assert.ok(verification.startS>=stationDay+time('06:00'));
        assert.ok(verification.startS>=plan.departureS-90*60);
        assert.ok(verification.endS<=plan.departureS-30*60);
        assert.ok(immigration.endS<=boarding.startS);
        assert.ok(boarding.startS>=plan.departureS-15*60);
        assert.ok(boarding.endS<=plan.departureS-5*60);
        assert.ok(plan.departureS<=stationDay+DAY);
        if (plan.readyS<stationDay+time('06:00')) {
          assert.equal(plan.parts[0].outsideStation,true);
          assert.equal(plan.outsideStationWait,true);
        }
      } else {
        assert.equal(plan.processingS,75*60);
        assert.equal(immigration.durationS,45*60);
        assert.ok(immigration.startS>=plan.arrivalS);
      }
    }
  }
});

test('each published normal departure remains eligible at its exact modeled buffer',()=>{
  for (const [index,pattern] of HIGH_SPEED_NETWORK.patterns.entries()) {
    for (const row of pattern.schedule.trips) {
      const plan=(index===0 ? north : south)(row.departureS-(index===0 ? 45 : 30)*60);
      assert.equal(plan.trainCode,row.trainCode);
      assert.equal(plan.departureS,row.departureS);
      assert.equal(plan.arrivalS,row.arrivalS);
      assertContiguous(plan);
    }
  }
});

test('per-model cached schedules never retain returned mutations or contaminate date/clock resets',()=>{
  const model=createHighSpeedServiceModel(),other=createHighSpeedServiceModel();
  const expected=model.at(time('07:14'),date);
  const mutated=model.at(time('07:14'),date);
  mutated[0].position[0]=0;
  mutated[0].coordinates[0]=0;
  mutated[0].departureS=0;
  const departure=model.departures('HSR:WEK',0,date)[0];
  departure.departureS=0;
  for (let day=0;day<50;day++) {
    model.at(day*DAY+time('07:14'),date);
    model.departures('HSR:FUT',day*DAY,date,{horizonS:7*DAY,limit:1000});
  }
  assert.deepEqual(model.at(time('07:14'),date),expected);
  assert.deepEqual(other.at(time('07:14'),date),expected);
  assert.equal(model.departures('HSR:WEK',0,date)[0].departureS,time('07:07'));
  const plan=north(time('06:22'));
  plan.parts.find(part => part.kind==='highspeed').coordinates[0][0]=0;
  plan.warnings.push('mutated');
  assert.deepEqual(north(time('06:22')),north(time('06:22')));
  assert.equal(HIGH_SPEED_STATIONS[0].coordinates[0],114.1648);
  assert.ok(Object.isFrozen(HIGH_SPEED_NETWORK.patterns[0].schedule.trips));
});

test('model and planner never read a wall clock',()=>{
  const original=Date.now;
  Date.now=()=>{throw new Error('Wall clock read');};
  try {
    const model=createHighSpeedServiceModel();
    assert.ok(model.at(time('07:14')).length);
    assert.equal(model.departures('HSR:WEK',0)[0].trainCode,'G5820');
    assert.equal(north(time('06:22')).trainCode,'G5820');
  } finally {Date.now=original;}
});

test('bad input fails explicitly; unsupported routes return null without inventing a leg',()=>{
  const model=createHighSpeedServiceModel();
  for (const clock of [NaN,Infinity,-Infinity,undefined,null,'100',Number.MAX_VALUE]) {
    assert.throws(()=>model.at(clock),/clock/);
    assert.throws(()=>model.departures('HSR:WEK',clock),/clock/);
    assert.throws(()=>north(clock),/clock/);
  }
  for (const badDate of [null,'','not-a-date','2026-02-30','2026-13-01']) {
    assert.throws(()=>model.at(0,badDate),/date/);
    assert.throws(()=>model.departures('HSR:WEK',0,badDate),/date/);
    assert.throws(()=>north(0,badDate),/date/);
  }
  for (const options of [{limit:-1},{limit:1.5},{limit:1001},{horizonS:-1},{horizonS:7*DAY+1},{horizonS:Infinity}]) {
    assert.throws(()=>model.departures('HSR:WEK',0,date,options),/limit|horizon/);
  }
  assert.throws(()=>model.departures('HSR:WEK',0,date,null),/options/);
  assert.throws(()=>model.departures(null,0,date),/station/);
  assert.throws(()=>planHighSpeedLeg(),/station/);
  assert.deepEqual(model.departures('HSR:WEK',0,date,{limit:0}),[]);
  assert.equal(planHighSpeedLeg({fromId:'HSR:WEK',toId:'HSR:WEK',readyS:0,departureDate:date}),null);
  assert.equal(planHighSpeedLeg({fromId:'HSR:WEK',toId:'uncovered',readyS:0,departureDate:date}),null);
  assert.equal(planHighSpeedLeg({fromId:'uncovered',toId:'HSR:FUT',readyS:0,departureDate:date}),null);
  assert.equal(model.at(time('07:14'),date).find(row=>row.trainCode==='G5820').serviceDate,date,'invalid date must not poison cached valid date');
});
