import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Worker as NodeWorker} from 'node:worker_threads';
const base=fileURLToPath(new URL('../../dist',import.meta.url));
const workers=[];
const passengerNeeds=['ordinary','luggage','escalator','lift'];
const retiredPreference=process.env.HK_BOOT_CASE==='retired-preference';
globalThis.requestAnimationFrame=callback=>setTimeout(callback,0);
const els=new Map(),listeners=new Map();
function el(id){if(els.has(id))return els.get(id);const e={id,focus(){},innerHTML:'',textContent:'',style:{},dataset:{},clientWidth:1000,clientHeight:800,childElementCount:0,hidden:false,relList:{supports:()=>true},classList:{add(){},remove(){},toggle(){return false}},querySelector:s=>el(s),querySelectorAll:()=>[],setAttribute(){},getAttribute(){return null},toggleAttribute(){},getBoundingClientRect:()=>({height:200,width:1000,top:0,left:0}),addEventListener:(t,fn)=>listeners.set(id+':'+t,fn),insertAdjacentHTML(_,s){this.innerHTML+=s},matches:()=>false};els.set(id,e);return e}
globalThis.document={createElement:()=>el('created'),querySelector:el,querySelectorAll:()=>[]};
globalThis.window={innerWidth:1000,addEventListener(){}};globalThis.history={replaceState(){},pushState(){}};globalThis.location={hash:'#navigation'};Object.defineProperty(globalThis,"navigator",{value:{},configurable:true});globalThis.localStorage={getItem:()=>JSON.stringify({version:1,account:{id:"old-user",name:"演示旅客",kind:"local-demo",createdAt:1},preferences:{priority:"fast",stepFree:false,avoidCrowds:false,allowedModes:["taxi"]},privacy:{rememberOnDevice:true,serviceCreditOptIn:false},orders:[],providerAvailability:{},bookingKeys:{},paymentKeys:{},creditOrderIds:[]}),setItem(){},removeItem(){}};window.localStorage=globalThis.localStorage;
globalThis.fetch=async url=>{const path=new URL(url,'http://localhost').pathname;if(path.endsWith(process.env.HK_BOOT_CASE==='block'?'admiralty-block-graph.json.gz':'station-access-alternatives.json'))return new Promise(()=>{});try{return new Response(readFileSync(base+path),{status:200})}catch(e){return new Response('',{status:404})}};
globalThis.Worker=class {constructor(url){const path=base+new URL(url).pathname.replace(base,'');workers.push(this);this.w=new NodeWorker(`const {parentPort}=require('node:worker_threads');globalThis.self=globalThis;globalThis.postMessage=x=>parentPort.postMessage(x);parentPort.on('message',x=>globalThis.onmessage({data:x}));require(${JSON.stringify(path)});`,{eval:true,resourceLimits:{maxOldGenerationSizeMb:384}});this.w.on('message',data=>this.onmessage?.({data}));this.w.on('error',e=>{console.error('WORKER ERROR',e);this.onerror?.(e)});}postMessage(x){this.w.postMessage(x)}terminate(){this.w.terminate()}};
const version=JSON.parse(readFileSync(base+'/build-meta.json')).version;
console.log('TEST_RUNTIME',version);
let api;try{let source=readFileSync(base+'/assets/main-integrated.js','utf8').replace(/from\s*["'](\.\/[^"']+)["']/g,(_,p)=>'from '+JSON.stringify(new URL(p,'file://'+base+'/assets/main-integrated.js').href)).replace(/import\("(\.\.?\/[^"]+)"\)/g,(_,p)=>'import('+JSON.stringify(new URL(p,'file://'+base+'/assets/main-integrated.js').href)+')').replaceAll('import.meta.url',JSON.stringify('file://'+base+'/assets/main-integrated.js'));if(process.env.HK_DEBUG)source=source.replace('const accept=raw=>compatibleWithOverlay(raw,demoArea,demoBlock)?annotateDemoFallback(annotatePreferenceResult(raw,request),request):null;','const accept=raw=>{console.log("RAW_DEMO",JSON.stringify({message:raw.message,complete:raw.journey?.complete,blocked:raw.journey?.steps?.filter(s=>s.blocked),connectors:raw.journey?.steps?.filter(s=>s.kind==="access_connector"||s.guidance?.geometry_mode==="schematic"),routedEndpoints:raw.routedEndpoints}));return compatibleWithOverlay(raw,demoArea,demoBlock)?annotateDemoFallback(annotatePreferenceResult(raw,request),request):null;};');api=await import('data:text/javascript;base64,'+Buffer.from(source+'\nexport {r,S1,C,d1,V,f,D1,n1,publicDataPromise,f2,L1,Q,b2,z,O,t1,trafficClock,trafficModel,taxiSimulation,trafficLayers,renderTraffic,syncTraffic,selectDeparture,ensureTaxi,routeSnapshot,taxiOffers,taxiSelectedQuote};').toString('base64'));console.log('IMPORT OK')}catch(e){console.error('BOOT ERROR',e.stack);process.exitCode=1}
await api.publicDataPromise;
assert.equal(window.__navigationLoad.status,'ready');
assert.ok(el('[data-app="panel"]').innerHTML.includes('公交'));
assert.ok(el('[data-app="panel"]').innerHTML.includes('电车'));
if(process.env.HK_STOPS_ONLY){
 await new Promise(resolve=>setTimeout(resolve,10));
 assert.match(el('[data-app="transit-stops"]').innerHTML,/data-transit-stop/);
 const services=JSON.parse(readFileSync(base+'/transit/services.json')),stop=services.stops[0];
 api.f.x=(stop.coordinates[0]-114.165)*102900-100;api.f.y=-(stop.coordinates[1]-22.279)*111320-100;api.f.w=1000;api.n1();await new Promise(resolve=>setTimeout(resolve,10));
 listeners.get('[data-app="map"]:click')({type:'click',clientX:0,clientY:0,target:{closest:()=>({dataset:{transitStop:'0'}})},preventDefault(){},stopPropagation(){}});
 assert.equal(el('[data-app="stop-card"]').hidden,false);assert.match(el('[data-app="stop-card"]').innerHTML,/设为起点/);
 for(const side of ['origin','destination']){listeners.get('[data-app="stop-card"]:click')({target:{closest:()=>({dataset:{stopSide:side},hasAttribute:()=>false})}});assert.equal(api.r[side].id,stop.id);assert.deepEqual(api.r[side].coordinates,stop.coordinates);}
 assert.equal(api.r.need,'ordinary');assert.equal(api.t1.has('taxi'),false);
 console.log('STOP ENTRY PASS: default markers, card, both exact stop endpoints, preference/taxi unchanged');process.exit(0);
}
if(process.env.HK_BOOT_CASE==='traffic'){
 await api.publicDataPromise;
 for(let i=0;i<100&&!api.taxiSimulation;i++)await new Promise(resolve=>setTimeout(resolve,20));
 assert.ok(api.taxiSimulation,'default fleet loads without enabling taxi route policy');assert.equal(api.t1.has('taxi'),false);
 const modes=new Set(api.trafficModel.at(api.trafficClock.timeS,'2026-10-13').filter(v=>v.mode!=='highspeed').map(v=>v.mode));assert.deepEqual([...modes].sort(),['bus','metro','tram']);
 const click=dataset=>listeners.get('#navigation-app:click')({target:{closest:()=>({dataset})}});
 click({action:'traffic-play'});assert.equal(api.trafficClock.playing,false);const before=api.trafficClock.timeS;await new Promise(resolve=>setTimeout(resolve,220));assert.equal(api.trafficClock.timeS,before);
 click({action:'traffic-step'});assert.equal(api.trafficClock.timeS,before+60);
 const vehicle=api.trafficModel.at(before,'2026-10-13')[0],later=api.trafficModel.at(before+60,'2026-10-13').find(v=>v.id===vehicle.id);if(later)assert.notDeepEqual(vehicle.position,later.position);
 const frozenClock=api.trafficClock.timeS,frozenView={...api.f},frozenFleet=api.taxiSimulation;
 click({taxiPolicy:'with'});await new Promise(resolve=>setTimeout(resolve,30));assert.ok(api.taxiSimulation);assert.equal(api.t1.has('taxi'),true);
 click({taxiPolicy:'without'});await new Promise(resolve=>setTimeout(resolve,30));assert.ok(api.taxiSimulation);assert.equal(api.t1.has('taxi'),false);assert.equal(api.trafficClock.timeS,frozenClock);assert.deepEqual(api.f,frozenView);assert.equal(api.taxiSimulation,frozenFleet);
 for(const mode of ['metro','bus','tram','taxi']){click({trafficLayer:mode});assert.equal(api.trafficLayers[mode],false);assert.equal(api.t1.has('taxi'),false);assert.equal(api.trafficClock.timeS,frozenClock);assert.deepEqual(api.f,frozenView);click({trafficLayer:mode});assert.equal(api.trafficLayers[mode],true);}
 click({action:'traffic-play'});api.r.stage='station';const hiddenTime=api.trafficClock.timeS;await new Promise(resolve=>setTimeout(resolve,250));assert.equal(api.trafficClock.timeS,hiddenTime);api.r.stage='home';const resumeDeadline=Date.now()+10000;while(api.trafficClock.timeS<=hiddenTime&&Date.now()<resumeDeadline)await new Promise(resolve=>setTimeout(resolve,50));assert.ok(api.trafficClock.timeS>hiddenTime,'foreground resume advances via the real interval');
 console.log('TRAFFIC ENTRY PASS: all public modes, default taxis, independent policy, pause/step, hidden view pause and condition-driven resume');process.exit(0);
}
if(process.env.HK_BOOT_CASE==='highspeed'){
 const click=dataset=>listeners.get('#navigation-app:click')({target:{closest:()=>({dataset})}});
 const waitFor=async(predicate,label)=>{const until=Date.now()+65000;while(!predicate()&&Date.now()<until)await new Promise(resolve=>setTimeout(resolve,40));assert.ok(predicate(),label+': '+el('[data-app="status"]').textContent);};
 await waitFor(()=>window.__navigationLoad.block==='ready','detail graph loaded for source-backed local transfers');
 const wek=api.V.find(p=>p.id==='HSR:WEK'),fut=api.V.find(p=>p.id==='HSR:FUT'),adm=api.V.find(p=>p.id==='ADM:portal:E2');
 assert.ok(wek&&fut&&adm);click({action:'home'});assert.match(el('[data-app="panel"]').innerHTML,/data-demo-preset="highspeed"/);
 const records=[];
 for(const time of ['08:00','08:03','08:00']){
  api.selectDeparture('2026-10-13',time);assert.equal(api.C.length,0);api.r.origin=wek;api.r.destination=fut;
  await api.S1();const choice=api.C.find(c=>c.id==='highspeed');assert.ok(choice?.available,choice?.result.message);assert.ok(choice.modeChain.includes('highspeed'));assert.equal(choice.quote.available,false);assert.equal(choice.quote.pricingUnavailable,true);assert.equal(api.routeSnapshot.departureS,api.trafficClock.timeS);
  assert.match(el('[data-app="panel"]').innerHTML,/高铁票价与余票未接入/);assert.match(el('[data-app="panel"]').innerHTML,/data-action="start"/);
  const result=choice.result,ride=result.timedLegs.find(leg=>leg.kind==='highspeed');assert.ok(ride.departureS>=api.trafficClock.timeS+2700);assert.equal(result.lines.filter(line=>line.kind==='highspeed').length,1);
  records.push({time,minutes:choice.minutes,waitMinutes:result.waitMinutes,processingMinutes:result.processingMinutes,train:result.highSpeedTrip.trainCode,departureS:ride.departureS,arrivalS:result.arrivalS});
 }
 assert.deepEqual(records[0],records[2]);assert.notEqual(records[0].waitMinutes,records[1].waitMinutes);assert.notEqual(records[0].minutes,records[1].minutes);
 const frozen=api.trafficClock.snapshot(),flags={...api.trafficLayers};click({trafficLayer:'highspeed'});assert.equal(api.trafficLayers.highspeed,false);for(const mode of ['metro','bus','tram','taxi'])assert.equal(api.trafficLayers[mode],flags[mode]);assert.deepEqual(api.trafficClock.snapshot(),frozen);click({trafficLayer:'highspeed'});
 click({region:'HSR'});await new Promise(resolve=>setTimeout(resolve,20));assert.match(el('[data-app="network"]').innerHTML,/na-network highspeed/);assert.match(el('[data-app="transit-stops"]').innerHTML,/highspeed/);
 const departures=api.trafficModel.departures('HSR:WEK',28800,'2026-10-13',{limit:3});assert.equal(departures.length,3);assert.ok(departures.every(d=>d.mode==='highspeed'&&d.departureS>=28800));
 const at=api.trafficModel.at(29520,'2026-10-13').filter(v=>v.mode==='highspeed'),later=api.trafficModel.at(29580,'2026-10-13').filter(v=>v.mode==='highspeed');assert.ok(at.length);assert.ok(at.some(vehicle=>later.some(next=>next.id===vehicle.id&&JSON.stringify(next.position)!==JSON.stringify(vehicle.position))));
 api.selectDeparture('2026-10-13','08:00');api.r.origin=adm;api.r.destination=fut;await api.S1();let choice=api.C.find(c=>c.id==='highspeed');assert.ok(choice?.available,choice?.result.message+' '+JSON.stringify(choice?.result.warnings));assert.ok(choice.result.needsFacilityConfirmation);assert.ok(choice.result.journey.steps.some(step=>step.guidance?.edge_ids?.length),'HK leg uses real source edges');assert.ok(choice.modeChain.includes('metro'));records.push({direction:'ADM→FUT',minutes:choice.minutes,train:choice.result.highSpeedTrip.trainCode,arrivalS:choice.result.arrivalS,departureS:choice.result.departureS});
 api.selectDeparture('2026-10-13','08:00');api.r.origin=fut;api.r.destination=adm;await api.S1();choice=api.C.find(c=>c.id==='highspeed');assert.ok(choice?.available,choice?.result.message+' '+JSON.stringify(choice?.result.warnings));const result=choice.result,ride=result.timedLegs.find(leg=>leg.kind==='highspeed'),immigration=result.timedLegs.find(leg=>leg.procedure==='immigration');assert.ok(immigration.departureS>=ride.arrivalS);assert.ok(result.arrivalS>immigration.arrivalS);records.push({direction:'FUT→ADM',minutes:choice.minutes,train:result.highSpeedTrip.trainCode,arrivalS:result.arrivalS,immigrationEndS:immigration.arrivalS});
 const pending=api.S1();api.selectDeparture('2026-10-13','10:00');await pending;assert.equal(api.C.length,0);assert.equal(api.routeSnapshot,undefined);
 console.log('HIGHSPEED_INTEGRATION_OBSERVATIONS',JSON.stringify(records));console.log('High-speed real Worker integration passed: global time, same-time replay, source-backed HK prefix/suffix, border procedures, map/stops and independent fifth layer');for(const worker of workers)worker.terminate();process.exit(0);
}
if(process.env.HK_BOOT_CASE==='departure-time'){
 const {journeyScore}=await import('../../src/navigation/journey-score.js');
 const click=dataset=>listeners.get('#navigation-app:click')({target:{closest:()=>({dataset})}});
 const change=(app,value)=>listeners.get('#navigation-app:change')({target:{dataset:{},value,matches:selector=>selector===`[data-app="${app}"]`}});
 const waitFor=async(predicate,label,timeout=65000)=>{const until=Date.now()+timeout;while(!predicate()&&Date.now()<until)await new Promise(resolve=>setTimeout(resolve,50));assert.ok(predicate(),label);};
 const defaultDate=api.trafficClock.date,selectedDate='2026-10-13';
 change('departure-date',selectedDate);change('departure','08:01');change('departure','08:03');
 await waitFor(()=>api.taxiSimulation?.inputKey===selectedDate+':28980','latest selection owns the asynchronous fleet');
 assert.equal(api.trafficClock.timeS,28980,'fleet loading never rewinds or advances chosen time');assert.equal(api.trafficClock.playing,false);
 api.renderTraffic();assert.equal(el('[data-app="departure"]').value,'08:03:00');assert.equal(el('[data-app="departure-date"]').value,selectedDate);assert.equal(el('[data-app="traffic-clock"]').textContent,'08:03:00');
 assert.equal(api.O.now(),api.trafficClock.epochMs,'simulated orders use the same global clock');
 assert.ok(!el('[data-app="panel"]').innerHTML.includes('data-action="taxi-play"'),'no second playback controls in taxi panel');
 click({action:'traffic-step'});assert.equal(api.trafficClock.timeS,29040);assert.equal(el('[data-app="departure"]').value,'08:04:00');assert.equal(el('[data-app="traffic-clock"]').textContent,'08:04:00');assert.equal(api.O.now(),api.trafficClock.epochMs);
 const playbackStartS=api.trafficClock.timeS;
 assert.ok(!document.hidden&&!['station','mall','navigation'].includes(api.r.stage),'playback check runs in an active foreground view');
 click({action:'traffic-play'});assert.equal(api.trafficClock.playing,true);
 // play() clears the tick anchor. Under CI load the first real interval callback
 // may arrive after 350 ms; wait for real progress, not a wall-time callback count.
 await waitFor(()=>api.trafficClock.playing&&api.trafficClock.timeS>playbackStartS,'global playback actually advances',10000);
 click({action:'traffic-play'});assert.equal(api.trafficClock.playing,false);api.renderTraffic();
 assert.ok(api.trafficClock.timeS>playbackStartS,'global playback actually advances');assert.equal(el('[data-app="departure"]').value,api.trafficClock.time);assert.equal(el('[data-app="traffic-clock"]').textContent,api.trafficClock.time);
 const focus={matches:selector=>selector==='[data-app="departure-date"], [data-app="departure"]'};click({action:'traffic-play'});listeners.get('#navigation-app:focusin')({target:focus});assert.equal(api.trafficClock.playing,false,'editing the sole clock pauses playback');
 const paused=api.trafficClock.snapshot(),pausedFleet=api.taxiSimulation.simulateAt(api.trafficClock.timeS),pausedTransit=api.trafficModel.at(api.trafficClock.timeS,api.trafficClock.baseDate);
 await new Promise(resolve=>setTimeout(resolve,250));assert.deepEqual(api.trafficClock.snapshot(),paused,'paused dates, inputs, orders and vehicles use an unchanged snapshot');assert.deepEqual(api.taxiSimulation.simulateAt(api.trafficClock.timeS),pausedFleet);assert.deepEqual(api.trafficModel.at(api.trafficClock.timeS,api.trafficClock.baseDate),pausedTransit);assert.equal(api.O.now(),paused.epochMs);
 const clockQuote=api.O.createQuote({title:'时钟回归',origin:'a',destination:'b',segments:[{mode:'walk',label:'walk',durationMinutes:1,distanceM:10}]});assert.equal(clockQuote.createdAt,paused.epochMs);
 const clockOrder=api.O.reserve(clockQuote.id,'clock-regression');api.trafficClock.step(300);api.renderTraffic();assert.equal(api.O.snapshot().orders.find(order=>order.id===clockOrder.id).status,'expired','global advance controls simulated order expiry');

 await waitFor(()=>window.__navigationLoad.block==='ready','detail data loads before repeated-time comparison');
 const panel=()=>el('[data-app="panel"]').innerHTML;
 assert.ok(panel().indexOf('data-app="departure"')<panel().indexOf('data-app="route-settings"'),'departure is visible outside collapsed preferences');
 api.r.origin=api.V.find(place=>place.id==='ADM:portal:E2');api.r.destination=api.V.find(place=>place.id==='AUS:portal:B2');
 const observations=[];
 for(const time of ['08:00','08:03','08:00']){
  change('departure',time);
  assert.equal(api.C.length,0);assert.equal(api.routeSnapshot,undefined);assert.equal(api.taxiOffers.length,0);assert.equal(api.taxiSelectedQuote,undefined);
  const seconds=Number(time.slice(0,2))*3600+Number(time.slice(3))*60;
  const sim=await api.ensureTaxi(seconds);const before=api.trafficClock.timeS;
  assert.equal(before,seconds);assert.equal(api.trafficClock.playing,false);
  const fleet=sim.simulateAt(seconds),quotes=sim.offerQuotes({passengerReadyS:seconds,nowS:seconds});
  assert.ok(quotes.length);for(const q of quotes.filter(q=>q.currentState==='existingorder'))assert.ok(q.availableAtS>=q.previousOrder.dropoffS-1e-7,'prior passenger must finish first');
  const vehicles=api.trafficModel.at(seconds,selectedDate),services=api.trafficModel.departures('RAIL:ADM:EAL',seconds,selectedDate,{limit:3});
  click({action:'plan'});await waitFor(()=>api.C.some(choice=>choice.available&&!choice.result.taxiQuote),'source-backed public route at '+time);
  click({action:'cancel-plan'});
  const choice=api.C.find(choice=>choice.available&&!choice.result.taxiQuote);
  assert.equal(api.trafficClock.timeS,seconds);assert.equal(api.O.now(),api.trafficClock.epochMs);assert.equal(api.routeSnapshot.departureDate,selectedDate);assert.equal(api.routeSnapshot.departureS,seconds);
  for(const result of api.C){assert.equal(result.result.navigationSnapshot.departureS,seconds);assert.equal(result.result.navigationSnapshot.departureDate,selectedDate);}
  assert.match(panel(),/data-action="start"/);assert.match(panel(),/班次/);assert.match(el('[data-app="planning-clock"]').textContent||panel(),new RegExp(time));
  const record={time,departureS:seconds,scenario:sim.scenario.id,busy:fleet.filter(car=>car.state==='existingorder').length,fleet:fleet.map(car=>({id:car.id,state:car.state,position:car.position})),vehicles:vehicles.map(vehicle=>({id:vehicle.id,position:vehicle.position})),nextServices:services.map(row=>({id:row.id,waitS:row.waitS})),taxi:{car:quotes[0].carId,waitS:quotes[0].passengerWaitS,availableAtS:quotes[0].availableAtS},route:{id:choice.id,minutes:choice.minutes,waitMinutes:choice.result.waitMinutes,score:journeyScore(choice).total}};
  observations.push(record);
  const choices=api.C;click({action:'home'});assert.equal(api.C,choices);click({action:'resume-route'});assert.equal(api.C,choices,'home retains unchanged snapshot');
  if(observations.length===3){
   click({action:'traffic-step'});assert.equal(api.C.length,0);assert.equal(api.routeSnapshot,undefined);assert.equal(api.taxiOffers.length,0);assert.equal(api.trafficClock.timeS,seconds+60);assert.equal(api.taxiSimulation,sim,'advancing invalidates results but retains the physical fleet');
  }else{
   click({taxiPolicy:'with'});assert.equal(api.taxiSimulation,sim);assert.equal(api.trafficClock.timeS,seconds);click({taxiPolicy:'without'});assert.equal(api.taxiSimulation,sim);
  }
 }
 assert.notDeepEqual(observations[0].fleet,observations[1].fleet,'time selection changes modeled taxi states/positions');
 assert.deepEqual(observations[0].fleet,observations[2].fleet,'same explicit selection replays deterministically');
 assert.notDeepEqual(observations[0].vehicles,observations[1].vehicles,'public vehicles follow selected time');
 assert.notDeepEqual(observations[0].nextServices,observations[1].nextServices,'next departures/countdown follow selected time');
 assert.notEqual(observations[0].route.score,observations[1].route.score,'route scoring includes changed wait/time');
 assert.deepEqual(observations[0].route,observations[2].route,'same OD/date/time result is reproducible');
 // In-flight old requests cannot restore results after a new time choice.
 click({action:'plan'});change('departure','08:05');await new Promise(resolve=>setTimeout(resolve,300));assert.equal(api.C.length,0);assert.equal(api.d1,false);assert.equal(api.routeSnapshot,undefined);
 // A fresh recomputation uses the map's stepped clock without resetting its fleet.
 const beforeStep=await api.ensureTaxi(29100);click({action:'traffic-step'});assert.equal(api.trafficClock.timeS,29160);assert.equal(api.taxiSimulation,beforeStep);
 change('departure','23:59');click({action:'traffic-step'});assert.match(el('[data-app="planning-clock"]').textContent,/2026-10-14 00:00:00/);assert.equal(el('[data-app="departure-date"]').value,'2026-10-14');assert.equal(el('[data-app="departure"]').value,'00:00:00');
 change('departure-date',defaultDate);change('departure','08:00');
 const resetFleet=await api.ensureTaxi(28800),resetQuote=resetFleet.offerQuotes({passengerReadyS:28800,nowS:28800})[0];resetFleet.reserveQuote(resetQuote.id);
 assert.ok(resetFleet.getCars().some(car=>car.reservation));click({action:'confirm-reset'});
 await waitFor(()=>api.taxiSimulation&&api.taxiSimulation!==resetFleet,'delete local data rebuilds even the unchanged default-time fleet');
 assert.ok(api.taxiSimulation.getCars().every(car=>!car.reservation),'delete local data clears simulated passenger reservations');
 console.log('DEPARTURE_TIME_OBSERVATIONS' ,JSON.stringify(observations.map(({fleet,vehicles,...row})=>({...row,taxiCount:fleet.length,publicVehicleCount:vehicles.length}))));
 console.log('DEPARTURE TIME PASS: exact paused selection, race isolation, same-OD waits/scores, source vehicles/services, deterministic fleet, prior-order eligibility, old snapshots cleared, policy/home preserved and midnight labeled');
 for(const worker of workers)worker.terminate();process.exit(0);
}
if(process.env.HK_BOOT_CASE==='quote-failure')api.O.createQuote=()=>{throw new Error('simulated pricing outage')};
const click=dataset=>listeners.get('#navigation-app:click')({target:{closest:()=>({dataset})}});
if(process.env.HK_BOOT_CASE==='land'||retiredPreference||process.env.HK_LAND_ID){
 const fallbackRequest=process.env.HK_LAND_ID?JSON.parse(readFileSync(new URL('./fixtures/fallback-cross-shore.json',import.meta.url))).find(row=>row.id===Number(process.env.HK_LAND_ID)).request:JSON.parse(readFileSync(new URL('./fixtures/demo-fallback-requests.json',import.meta.url)))[2];
 const coordinates=(retiredPreference||process.env.HK_LAND_ID)?[["origin",fallbackRequest.origin.coordinates],["destination",fallbackRequest.destination.coordinates]]:[['origin',[114.17405457978654,22.312218704929617]],['destination',[114.1750543331201,22.302091394706313]]];
 for(const [side,coordinate]of coordinates){
  api.r.target=side;api.f.x=(coordinate[0]-114.165)*102900-api.f.w/2;api.f.y=-(coordinate[1]-22.279)*111320-api.f.h/2;click({action:'confirm-map'});await new Promise(r=>setTimeout(r,2));
 }
 if(retiredPreference){assert.equal(fallbackRequest.need,'accessible','fixed legacy input is retained');api.r.need=fallbackRequest.need;}
 else if(process.env.HK_LAND_ID)api.r.need=process.env.HK_NEED??fallbackRequest.need;
 if(process.env.HK_LAND_ID)for(const side of ['origin','destination'])if(fallbackRequest[side].node_id)api.r[side]={...fallbackRequest[side]};
 if(process.env.HK_TAXI==='1')api.t1.add('taxi');else if(process.env.HK_TAXI==='0')api.t1.clear();
 click({action:'plan'});
}else click({demoPreset:process.env.HK_BOOT_CASE==='block'?'same-shore':'rail'});
try{
 // Canonical UI/API contract: a retired request cannot remain a fifth option.
 assert(passengerNeeds.includes(api.r.need),'planner request is a current passenger preference');
 const preferenceOptions=el('[data-app="panel"]').innerHTML.match(/<select data-app="need">([\s\S]*?)<\/select>/)?.[1];
 assert.ok(preferenceOptions,'passenger preference control remains visible');
 assert.deepEqual([...preferenceOptions.matchAll(/value="([^"]+)"/g)].map(match=>match[1]),passengerNeeds);
 if(retiredPreference){
  assert.equal(api.r.need,'ordinary');
  assert.equal(el('[data-app="need"]').value,'ordinary','ordinary is the displayed selection');
  assert.match(el('[data-app="panel"]').innerHTML,/旧版出行偏好已重置为普通出行/);
 }
 for(let i=0;i<(process.env.HK_FULL?180:90)&&api.d1&&(process.env.HK_FULL||!api.C.some(c=>c.available)||(process.env.HK_TAXI==='1'&&!api.C.some(c=>c.result.taxiQuote)));i++){await new Promise(r=>setTimeout(r,1000));if(i%10===0)console.log("PROGRESS",i,JSON.stringify(window.__navigationPerformance?.stages),api.C.map(c=>[c.id,c.available,c.result.message]));}
 for(const choice of api.C.filter(c=>c.available)){const pts=choice.result.journey?.steps?.flatMap(st=>st.guidance?.geometry?.type==='LineString'?st.guidance.geometry.coordinates:[])??[];if(pts.length){for(const [side,point] of [['origin',pts[0]],['destination',pts.at(-1)]]){assert.ok(Math.abs(point[0]-api.r[side].coordinates[0])<1e-7&&Math.abs(point[1]-api.r[side].coordinates[1])<1e-7,'original endpoint XY preserved: '+side);if(api.r[side].coordinates.length===3)assert.ok(Math.abs(point[2]-api.r[side].coordinates[2])<=1,'original endpoint height retained: '+side);}console.log('ENDPOINT_DIAGNOSTIC',JSON.stringify({id:choice.id,first:pts[0],last:pts.at(-1),totalMinutes:choice.result.totalMinutes}));}}
 for(const choice of api.C.filter(c=>c.available)){const result=choice.result,graph=result.journey?.graph;const ids=new Set((result.journey?.steps??[]).flatMap(st=>st.guidance?.edge_ids??[]));const used=(graph?.edges??[]).filter(e=>ids.has(e.id)),closed=new Set((graph?.closures??[]).flatMap(c=>c.physical_ids??[]));const forbidden=used.filter(e=>e.disabled||closed.has(e.physical_id));assert.equal(forbidden.length,0,'known forbidden source edges absent');console.log('EDGE_AUDIT',JSON.stringify({id:choice.id,usedCount:used.length,forbidden:forbidden.map(e=>e.id),modeled:used.filter(e=>e.source_id?.startsWith('MODELED')).map(e=>({id:e.id,length_m:e.length_m,duration_s:e.duration_s,coordinates:e.coordinates})),sourceIds:[...ids]}));}
 console.log('MEMORY_DIAGNOSTIC',JSON.stringify({memory:process.memoryUsage(),maxRSS:process.resourceUsage().maxRSS}));
 console.log('FINAL_DIAGNOSTIC',JSON.stringify(window.__navigationPerformance),api.C.map(c=>[c.id,c.available,c.result.message]),el('[data-app="status"]').textContent);
 // All remaining preferences describe ordinary passenger routing. Wheelchair
 // source barriers are still evidence, not blanket bans on ordinary walkways.
 for(const choice of api.C){
  assert.notEqual(choice.accessibility,'verified','a passenger preference is not a wheelchair certificate');
  assert.notEqual(choice.result.accessibilityVerified,true,'unknown capability is never promoted to verified');
 }
 if(retiredPreference){
  const retiredInput=JSON.parse(readFileSync(new URL('./fixtures/demo-fallback-requests.json',import.meta.url)))[2];
  assert.equal(api.r.need,'ordinary');
  for(const side of ['origin','destination'])assert(api.r[side].coordinates.every((value,index)=>Math.abs(value-retiredInput[side].coordinates[index])<1e-7),'retired request retains original coordinates: '+side);
  const availablePublic=api.C.filter(choice=>choice.available&&!choice.result.taxiQuote);
  assert(availablePublic.length>0,'migrated ordinary request yields a usable public route');
  for(const choice of availablePublic){
   assert.equal(choice.result.journey?.complete,true);
   const points=choice.result.journey.steps.flatMap(step=>step.guidance?.geometry?.type==='LineString'?step.guidance.geometry.coordinates:[]);
   assert(points.length>1,'migrated route has actual geometry for the endpoint audit');
   assert.notEqual(choice.result.accessibilityVerified,true);
  }
  assert.equal(el('[data-app="need"]').value,'ordinary');
  assert.match(el('[data-app="panel"]').innerHTML,/旧版出行偏好已重置为普通出行/);
 }
 assert.ok(/data-action="start"(?![^>]*disabled)/.test(el('[data-app="panel"]').innerHTML),'start button usable immediately');
 if(process.env.HK_TAXI!==undefined){const quotes=api.C.filter(c=>c.result.taxiQuote);assert.equal(quotes.length>0,process.env.HK_TAXI==='1','taxi policy matches selected profile/toggle');if(api.r.need==='luggage'&&quotes.length){assert.equal(quotes[0].result.needsVehicleConfirmation,true);assert.equal(quotes[0].result.luggageSpaceUnverified,true);assert.match(quotes[0].result.message,/后备厢容量/);assert.equal(quotes[0].luggageCompatible,undefined);}}
 const availableBeforeCancel=api.C.filter(choice=>choice.available).map(choice=>choice.id).sort();
 click({action:'cancel-plan'});
 assert.equal(api.d1,false,'programmatic cancellation stops routing');
 assert.ok(api.C.some(c=>(retiredPreference||process.env.HK_NEED||c.id.startsWith('transit'))&&c.available),'public route stays available with optional resource stalled and legacy taxi-only stored preferences');
 assert.ok(api.C.some(c=>c.available&&!c.result.taxiQuote&&el('[data-app="panel"]').innerHTML.includes('data-choice="'+c.id+'"')),'usable public result rendered by stable route identity');
 await new Promise(resolve=>setTimeout(resolve,25));
 assert.equal(api.d1,false,'stale worker completion does not restart cancelled planning');
 assert.deepEqual(api.C.filter(choice=>choice.available).map(choice=>choice.id).sort(),availableBeforeCancel,'cancellation preserves accepted choices without admitting stale results');
 if(retiredPreference){
  click({action:'cancel-plan'});assert.equal(api.d1,false,'repeated programmatic cancellation is safe');
  assert.equal(api.r.need,'ordinary');
  assert.ok(/data-action="start"(?![^>]*disabled)/.test(el('[data-app="panel"]').innerHTML),'complete migrated route remains startable after cancellation');
  console.log('Retired preference migration passed: four visible preferences, ordinary selected, original coordinates retained, usable unverified ordinary route, safe cancel and enabled Start');
 }
 const retained=api.C;click({action:'home'});assert.equal(api.r.stage,'home');assert.equal(api.C,retained);assert.match(el('[data-app="panel"]').innerHTML,/data-action="resume-route"/);click({action:'resume-route'});assert.equal(api.r.stage,'routes');assert.equal(api.C,retained);assert.equal(api.d1,false,'resuming a route does not rerun routing');
 console.log('Full entry + real Worker + rendered public route passed:',process.env.HK_BOOT_CASE??'metadata','stalled; legacy stored taxi-only policy and navigation hash');
}finally{for(const worker of workers)worker.terminate();}

process.exit(process.exitCode??0); // Dispose the demo fleet timer after a successful harness run.
