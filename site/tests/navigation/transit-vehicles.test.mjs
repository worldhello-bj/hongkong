import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createTransitVehicleModel, createMetroVehicleModel} from '../../src/navigation/transit-vehicles.js';

const stops = [
  {id:'A',name:'Alpha',coordinates:[114,22]},
  {id:'B',name:'Bravo',coordinates:[114.02,22.01]},
  {id:'C',name:'Charlie',coordinates:[114.04,22.01]}
];
const pattern = (extra={}) => ({
  id:'test:east', routeId:'TEST', label:'Test line', mode:'metro', direction:'A→C',
  shape:[[114,22],[114.02,22],[114.02,22.01],[114.04,22.01]],
  stops:[
    {stopId:'A',arrivalOffsetS:0,departureOffsetS:0,shapeIndex:0},
    {stopId:'B',arrivalOffsetS:100,departureOffsetS:120,shapeIndex:2},
    {stopId:'C',arrivalOffsetS:220,departureOffsetS:220,shapeIndex:3}
  ],
  schedule:{departuresS:[1000],windows:[]}, geometryMode:'schematic',
  provenance:{scheduleKind:'demo',timingNote:'Fixture simulation, not realtime.'},
  ...extra
});
const services = patterns => ({baseDate:'2026-10-12',timezone:'Asia/Hong_Kong',stops,patterns});
const modelFor = (extra, options) => createTransitVehicleModel(services([pattern(extra)]), options);
const close = (a,b,tolerance=1e-8) => assert.ok(Math.abs(a-b)<=tolerance, `${a} ≠ ${b}`);

test('active interval is departure-inclusive and terminal-arrival-exclusive',()=>{
  const model=modelFor();
  assert.deepEqual(model.at(999),[]);
  assert.equal(model.at(1000).length,1);
  assert.deepEqual(model.at(1000)[0].position,stops[0].coordinates);
  assert.equal(model.at(1219.9).length,1);
  assert.deepEqual(model.at(1220),[]);
  assert.deepEqual(model.at(9000),[]);
});
test('movement follows supplied multi-vertex geometry, never a direct endpoint chord',()=>{
  const vehicle=modelFor().at(1050)[0];
  assert.equal(vehicle.state,'moving');
  close(vehicle.position[1],22);
  assert.ok(vehicle.position[0]>114 && vehicle.position[0]<114.02);
  close(vehicle.bearing,89.996,0.01);
  assert.equal(vehicle.fromStopId,'A');assert.equal(vehicle.nextStopId,'B');
  assert.equal(vehicle.nextArrivalS,1100);
  assert.equal(vehicle.geometryMode,'schematic');
  assert.equal(vehicle.realtime,false);assert.equal(vehicle.simulated,true);
});
test('intermediate dwell freezes at shape vertex then departs at scheduled second',()=>{
  const model=modelFor();
  for (const time of [1100,1110,1119.999]) {
    const vehicle=model.at(time)[0];
    assert.equal(vehicle.state,'dwelling');assert.equal(vehicle.currentStopId,'B');
    assert.deepEqual(vehicle.position,stops[1].coordinates);
  }
  assert.equal(model.at(1120)[0].state,'moving');
  close(model.at(1170)[0].position[0],114.03);
  assert.equal(model.at(1170)[0].id,model.at(1000)[0].id);
});
test('reverse-direction pattern follows reversed shape and bearing',()=>{
  const reverse=pattern({id:'test:west',direction:'C→A',shape:pattern().shape.slice().reverse(),
    stops:[{stopId:'C',arrivalOffsetS:0,departureOffsetS:0,shapeIndex:0},{stopId:'B',arrivalOffsetS:100,departureOffsetS:120,shapeIndex:1},{stopId:'A',arrivalOffsetS:220,departureOffsetS:220,shapeIndex:3}]});
  const vehicle=createTransitVehicleModel(services([reverse])).at(1050)[0];
  close(vehicle.position[0],114.03);close(vehicle.position[1],22.01);
  close(vehicle.bearing,270.0037,0.01);assert.equal(vehicle.direction,'C→A');
});
test('frequency windows merge explicit departures and deduplicate boundaries',()=>{
  const model=modelFor({schedule:{windows:[{startS:1000,endS:1600,headwayS:200},{startS:1400,endS:1800,headwayS:200}],departuresS:[1000,1600,1800]}});
  assert.deepEqual(model.departures('A',900,undefined,{limit:10,horizonS:1000}).map(row=>row.departureS),[1000,1200,1400,1600,1800]);
  assert.equal(model.departures('A',1800,undefined,{horizonS:0})[0].waitS,0);
});
test('departures use stop offsets, retain still-dwelling trains and exclude termini',()=>{
  const model=modelFor();
  const [row]=model.departures('B',1110,undefined,{horizonS:100});
  assert.equal(row.arrivalS,1100);assert.equal(row.departureS,1120);assert.equal(row.waitS,10);
  assert.equal(row.tripDepartureS,1000);assert.equal(row.destinationStopId,'C');
  assert.equal(row.destinationName,'Charlie');assert.equal(row.toStopId,'C');
  assert.equal(row.tripId,model.at(1110)[0].tripId);
  assert.deepEqual(model.departures('C',1000),[]);
  assert.deepEqual(model.departures('unknown',1000),[]);
  assert.deepEqual(model.departures('B',1121,undefined,{horizonS:500}),[]);
});
test('daily service calendar honors weekdays, date range and exceptions',()=>{
  const model=modelFor({calendar:{baseDate:'2026-10-12',startDate:'2026-10-01',endDate:'2026-10-31',weekdays:[1,2,3,4,5],exceptions:[{date:'2026-10-12',active:false},{date:'2026-10-18',active:true}]}});
  assert.deepEqual(model.at(1050,'2026-10-12'),[]);
  assert.equal(model.at(1050,'2026-10-13').length,1);
  assert.deepEqual(model.at(1050,'2026-10-17'),[]);
  assert.equal(model.at(1050,'2026-10-18').length,1);
  assert.deepEqual(model.at(1050,'2026-11-02'),[]);
  assert.deepEqual(model.departures('A',0,'2026-10-12',{horizonS:86400}),[]);
});
test('midnight trips retain prior service date, stable identity and prior calendar',()=>{
  const model=modelFor({schedule:{departuresS:[86350],windows:[]},calendar:{startDate:'2026-10-12',endDate:'2026-10-12',weekdays:[1],exceptions:[]}});
  const before=model.at(86410,'2026-10-12')[0],after=model.at(10,'2026-10-13')[0];
  assert.equal(before.id,after.id);assert.equal(after.serviceDate,'2026-10-12');
  assert.deepEqual(before.position,after.position);
  assert.equal(after.departureS,-50);
  const row=model.departures('B',10,'2026-10-13',{horizonS:200})[0];
  assert.equal(row.arrivalS,50);assert.equal(row.departureS,70);assert.equal(row.waitS,60);
});
test('GTFS departures above 24:00 use previous service day even on inactive next day',()=>{
  const model=modelFor({schedule:{departuresS:[87000],windows:[]},calendar:{startDate:'2026-10-12',endDate:'2026-10-12',weekdays:[1],exceptions:[]}});
  const row=model.departures('A',500,'2026-10-13',{horizonS:100})[0];
  assert.equal(row.departureS,600);assert.equal(row.serviceDate,'2026-10-12');
  assert.equal(model.at(650,'2026-10-13')[0].id,row.id);
  assert.deepEqual(model.at(650,'2026-10-12'),[]);
});
test('direction filtering and display cap do not limit departure queries',()=>{
  const patterns=['bus','tram','metro'].map((mode,i)=>pattern({id:mode,mode,routeId:mode,direction:String(i),schedule:{windows:[{startS:1000,endS:3000,headwayS:10}],departuresS:[]}}));
  const model=createTransitVehicleModel(services(patterns),{maxVehicles:3});
  assert.deepEqual(new Set(model.at(1100).map(row=>row.mode)),new Set(['bus','tram','metro']));
  assert.equal(model.at(1100).length,3);
  assert.equal(model.departures('A',1100,undefined,{mode:'metro',direction:'2',limit:10,horizonS:100}).length,10);
  assert.equal(model.departures('A',1100,undefined,{routeId:'bus',patternId:'bus',horizonS:0})[0].mode,'bus');
  assert.deepEqual(model.departures('A',1100,undefined,{direction:'wrong'}),[]);
  assert.ok(createMetroVehicleModel(services(patterns)).at(1100).every(row=>row.mode==='metro'));
});
test('source shapes and service objects remain untouched and results deterministic',()=>{
  const input=services([pattern()]),original=JSON.stringify(input),model=createTransitVehicleModel(input);
  const rows=model.at(1050);rows[0].position[0]=0;
  assert.notEqual(model.at(1050)[0].position[0],0);
  assert.deepEqual(model.at(1050),model.at(1050));
  model.departures('A',1050);
  assert.equal(JSON.stringify(input),original);
});
test('repeated shape vertices stay finite and zero-time calls do not divide by zero',()=>{
  const model=modelFor({shape:[[114,22],[114,22],[114.02,22]],stops:[
    {stopId:'A',arrivalOffsetS:0,departureOffsetS:0,shapeIndex:0},
    {stopId:'B',arrivalOffsetS:0,departureOffsetS:10,shapeIndex:1},
    {stopId:'C',arrivalOffsetS:20,departureOffsetS:20,shapeIndex:2}
  ]});
  assert.equal(model.at(1000)[0].state,'dwelling');
  assert.ok(model.at(1015)[0].position.every(Number.isFinite));
});
test('invalid times, dates, windows and geometry fail explicitly; empty input is safe',()=>{
  const model=modelFor();
  for(const time of [NaN,Infinity,-Infinity,undefined]) {
    assert.throws(()=>model.at(time),/clock/);
    assert.throws(()=>model.departures('A',time),/clock/);
  }
  for(const date of ['2026-02-30','not-a-date',null]) {
    assert.throws(()=>model.at(1050,date),/date/);
    assert.throws(()=>model.departures('A',1050,date),/date/);
  }
  assert.throws(()=>model.departures('A',0,undefined,{limit:-1}),/limit/);
  assert.throws(()=>model.departures('A',0,undefined,{horizonS:Infinity}),/horizon/);
  assert.throws(()=>modelFor({schedule:{windows:[{startS:0,endS:200,headwayS:0}]}}),/window/);
  assert.throws(()=>modelFor({shape:[[NaN,22],[114,22]]}),/pattern/);
  assert.throws(()=>createTransitVehicleModel(services([pattern(),pattern()])),/Duplicate/);
  assert.deepEqual(createTransitVehicleModel().at(0),[]);
});

test('warm animation and stop queries reuse calendar work without caching sampled outputs',()=>{
  let calendarChecks=0;
  const exceptions=[];
  exceptions.find=function(predicate) {calendarChecks++;return Array.prototype.find.call(this,predicate)};
  const model=modelFor({calendar:{weekdays:[0,1,2,3,4,5,6],exceptions}});
  const first=model.at(1050);
  const coldChecks=calendarChecks;
  assert.equal(coldChecks,2,'the cold candidate band covers the preceding and selected service day');
  for(let frame=0;frame<180;frame++) {
    const time=1050+frame/60;
    const vehicles=model.at(time);
    const departures=model.departures('B',time,undefined,{horizonS:120});
    assert.equal(vehicles.length,1);
    assert.equal(vehicles[0].tripId,first[0].tripId);
    assert.equal(vehicles[0].progress,(time-1000)/220);
    assert.equal(departures[0].waitS,1120-time);
  }
  assert.equal(calendarChecks,coldChecks,'360 warm samples perform no calendar scans');
  assert.notDeepEqual(model.at(1052)[0].position,first[0].position);
});

test('service-date cache is bounded, date-specific and refreshes evicted bands',()=>{
  let calendarChecks=0;
  const exceptions=[{date:'2026-10-13',active:false}];
  exceptions.find=function(predicate) {calendarChecks++;return Array.prototype.find.call(this,predicate)};
  const model=modelFor({calendar:{weekdays:[0,1,2,3,4,5,6],exceptions}});
  assert.equal(model.at(1050,'2026-10-12').length,1);
  assert.deepEqual(model.at(1050,'2026-10-13'),[]);
  model.at(1050,'2026-10-14');
  model.at(1050,'2026-10-15');
  assert.equal(calendarChecks,8);
  assert.equal(model.at(1051,'2026-10-12')[0].serviceDate,'2026-10-12');
  assert.equal(calendarChecks,8,'recently used band is reused');
  model.at(1050,'2026-10-16');
  assert.equal(calendarChecks,10);
  assert.deepEqual(model.at(1050,'2026-10-13'),[]);
  assert.equal(calendarChecks,12,'the fifth band evicts the least recently used of four');
  assert.throws(()=>model.at(1050,'2026-02-30'),/date/);
  assert.throws(()=>model.departures('A',1050,null),/date/);
  assert.deepEqual(model.at(1050,'2026-10-13'),[]);
  assert.equal(calendarChecks,12,'invalid dates do not poison the last valid date');
});

test('wide service-day bands stream without retaining an oversized cache',()=>{
  let calendarChecks=0;
  const exceptions=[];
  exceptions.find=function(predicate) {calendarChecks++;return Array.prototype.find.call(this,predicate)};
  const model=modelFor({calendar:{weekdays:[0,1,2,3,4,5,6],exceptions},stops:[
    {stopId:'A',arrivalOffsetS:0,departureOffsetS:0,shapeIndex:0},
    {stopId:'C',arrivalOffsetS:20*86400,departureOffsetS:20*86400,shapeIndex:3}
  ]});
  const first=model.at(1050),coldChecks=calendarChecks;
  assert.equal(first.length,20);
  assert.equal(coldChecks,21);
  assert.deepEqual(model.at(1050),first);
  assert.equal(calendarChecks,coldChecks*2,'more than sixteen candidate days are streamed each time');
});

test('warm and cold samples stay exactly equal across negative clocks, dates, modes and overnight schedules',()=>{
  const calendar={startDate:'2026-10-10',endDate:'2026-10-20',weekdays:[1,2,3,4,5],exceptions:[
    {date:'2026-10-12',active:false},{date:'2026-10-18',active:true}
  ]};
  const input=services(['bus','tram','metro'].map((mode,index)=>pattern({
    id:`warm:${mode}`,mode,direction:String(index),calendar,
    schedule:{departuresS:[0,0.125,1000,86350,86400,87000,7*86400],windows:[{startS:900,endS:1800,headwayS:30}]}
  })));
  const options={maxVehicles:5},warm=createTransitVehicleModel(input,options);
  const dates=['2026-10-12','2026-10-13','2026-10-18','2026-10-11','2026-11-02','2026-10-13'];
  const times=[-86400,-220,-50,-0.125,0,0.125,10,650,999.5,1000,1050,1119.999,1120,1220,86399.999,86400,86410,87050,7*86400+50];
  for(const date of dates) for(const time of times) {
    const cold=createTransitVehicleModel(input,options);
    assert.deepEqual(warm.at(time,date),cold.at(time,date),`vehicles ${date} ${time}`);
    for(const query of [{limit:8,horizonS:0},{limit:8,horizonS:86400},{limit:8,horizonS:7*86400,mode:'metro',direction:'2'}]) {
      for(const stopId of ['A','B','C']) {
        assert.deepEqual(warm.departures(stopId,time,date,query),cold.departures(stopId,time,date,query),`${stopId} ${date} ${time}`);
      }
    }
  }
  const vehicles=warm.at(1050,'2026-10-13');
  assert.deepEqual(vehicles.map(row=>row.mode),['bus','tram','metro','bus','tram']);
});

// Use the actual built router as an oracle instead of manufacturing metro data.
globalThis.document={createElement:()=>({relList:{supports:()=>true}})};
const version=JSON.parse(readFileSync(new URL('../../dist/build-meta.json',import.meta.url),'utf8')).version;
const built=path=>new URL('../../dist/'+path,import.meta.url).href+'?v='+version;
const {b:buildRouter,g:sourceVehicles}=await import(built('assets/intermodal-routing-D8vKT-lN.js'));
const {p:prepare}=await import(built('assets/mobile-navigation-DfEsS_7b.js'));
const read=path=>{const bytes=readFileSync(new URL('../../dist/'+path,import.meta.url));return JSON.parse(path.endsWith('.gz')?gunzipSync(bytes):bytes)};
const source=read('transit/services.json');
const network=buildRouter(prepare(read('area/area-graph.json.gz')),source,read('transit/walk-links.json.gz'),prepare(read('area/station-graph.json.gz'))).network;
const actual=createTransitVehicleModel(network);

test('real network includes all existing modes with honest metro simulation provenance',()=>{
  assert.ok(!source.patterns.some(pattern=>pattern.mode==='metro'));
  assert.equal(actual.patterns.filter(pattern=>pattern.mode==='metro').length,4);
  assert.deepEqual(new Set(actual.at(28800,'2026-10-13').map(row=>row.mode)),new Set(['bus','tram','metro']));
  assert.ok(actual.at(28800,'2026-10-13').filter(row=>row.mode==='metro').every(row=>row.scheduleKind==='demo'&&row.geometryMode==='schematic'&&row.simulated&&!row.realtime));
});
test('real positions, dwell, directions and active counts match existing scheduled engine',()=>{
  for(const date of ['2026-10-10','2026-10-11','2026-10-13','2026-10-19']) {
    const dated={...network,patterns:network.patterns.map(pattern=>pattern.calendar?{...pattern,calendar:{...pattern.calendar,baseDate:date}}:pattern)};
    for(const time of [30,3600,19800,21840,28800,39600,60000,86399,88000,89500]) {
      const expected=sourceVehicles(dated,time),vehicles=actual.at(time,date);
      assert.equal(vehicles.length,expected.length,`${date} ${time}`);
      for(const row of vehicles) {
        const reference=expected.find(candidate=>candidate.patternId===row.patternId&&candidate.departureS===row.departureS);
        assert.ok(reference,row.id);assert.equal(row.state,reference.state);assert.equal(row.direction,reference.direction);
        close(row.position[0],reference.coordinates[0]);close(row.position[1],reference.coordinates[1]);
        assert.equal(row.arrivalS,reference.arrivalS);
      }
    }
  }
});
test('real metro first/last departures and selected date agree with service windows',()=>{
  const metro=actual.patterns.find(pattern=>pattern.id==='scheduled:RAIL:EAL');
  const start=metro.schedule.windows[0].startS,end=metro.schedule.departuresS[0];
  const options={patternId:metro.id,limit:10,horizonS:1000};
  assert.equal(actual.departures('RAIL:ADM:EAL',start-1,'2026-10-13',options)[0].departureS,start);
  assert.equal(actual.departures('RAIL:ADM:EAL',end,'2026-10-13',{...options,horizonS:0})[0].departureS,end);
  assert.deepEqual(actual.departures('RAIL:ADM:EAL',end+1,'2026-10-13',options),[]);
  const row=actual.departures('RAIL:ADM:EAL',28800,'2026-10-13',options)[0];
  assert.equal(row.waitS,row.departureS-28800);
  assert.equal(actual.at(row.departureS,'2026-10-13').find(vehicle=>vehicle.id===row.id)?.mode,'metro');
});
