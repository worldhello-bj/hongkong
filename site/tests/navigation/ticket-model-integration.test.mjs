import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createTicketPageController,TICKET_STORAGE_KEY} from '../../src/navigation/ticket-page.js';
import {createTrafficClock} from '../../src/navigation/traffic-clock.js';
import {normalizePassengerNeed} from '../../src/navigation/passenger-preferences.js';
import {normalizeNavigationState,normalizeAppStage,parseNavigationLocation,STATIONS,validStation} from '../../src/navigation/ui-navigation.js';
import {createJourney3DModel} from '../../src/navigation/journey-3d-model.js';

// Execute the actual host functions, isolated from routing/DOM boot. Dist stays
// untouched so this can run concurrently with audits of an older built bundle.
const source=readFileSync(new URL('../../src/navigation/main.recovered.js',import.meta.url),'utf8');
function between(start,end){const i=source.indexOf(start),j=source.indexOf(end,i+start.length);assert.ok(i>=0&&j>i,`${start} source boundary`);return source.slice(i,j);}
function harness({remember=false,stored=new Map(),deleteFails=false}={}){
  const timers=new Map(),messages=[];let next=0,privacy={rememberOnDevice:remember};
  const storage={getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value),removeItem:key=>{if(deleteFails&&key===TICKET_STORAGE_KEY)throw new Error('denied');stored.delete(key);}};
  const clock=createTrafficClock({date:'2026-10-13',timeS:28800,playing:false});
  const context=vm.createContext({
    console,Map,Set,JSON,Number,String,Date,Error,createTrafficClock,normalizePassengerNeed,
    normalizeNavigationState,normalizeAppStage,parseNavigationLocation,STATIONS,validStation,
    trafficClock:clock,M2:storage,window:{matchMedia:()=>({matches:true})},
    O:{snapshot:()=>({privacy:{...privacy}}),setPrivacy:value=>Object.assign(privacy,value),deleteLocalData:()=>{privacy={rememberOnDevice:false};}},
    createTicketPageController:options=>createTicketPageController({...options,schedule:fn=>{const id=++next;timers.set(id,fn);return id;},cancelSchedule:id=>timers.delete(id)}),
    requestAnimationFrame(){},focusTicketPage(){},syncTraffic(){},A:()=>({}),Z:message=>messages.push(message),
    P:{classList:{remove(){}},querySelector:()=>null},J:{suspend(){}},history:{state:null},location:{pathname:'/',search:'',hash:'#home'},
    u1(){},writeAppHistory(){},X1:()=> '2026-10-13',performance:{now:()=>100},clearInterval(){},cancelAnimationFrame(){},
    P1:{abort(){}},mapTiles:undefined,journeyModel:undefined,stationModel:undefined,pacificModel:undefined,
  });
  vm.runInContext(`
    var r={stage:'home',mode:'transit',need:'ordinary',target:'destination'},ticketPage,ticketRouteRevision=0;
    var C=[],_,$,A1,e1,a1=0,M1=0,x1=false,y1=false,l1=false,G='time',q1=false,t1=new Set(),Q1=new Map(),_1=new Map(),taxiTimer=null,mapFrame=0;
    function trafficScenarioKey(){return trafficClock.baseDate+':28800'}
    function N(){ticketRouteRevision++;ticketPage?.suspend();C=[];_=undefined;$=undefined;}
    function availableUiState(){return {hasJourney:!!$?.journey,hasCheckout:!!A1,hasDestination:!!r.destination}}
    ${between('function ticketContextNow(){','const N1=')}
    ${between('function t3(e){','// Separate road library')}
    ${between('function restoreAppLocation(event){','Y(window,"popstate"')}
    ${between('function H(e,L=!1){','function N(')}
    ${between('function x(){','mapTiles?.setActive(')}}
    var onPageHide=${between('Y(window,"pagehide",',');Y(window,"pageshow"').slice('Y(window,"pagehide",'.length)};
  `,context);
  const run=code=>vm.runInContext(code,context);
  const setChoice=()=>run(`r={...r,origin:{id:'ADM',name:'金钟'},destination:{id:'HUH',name:'红磡'}};
    _={id:'transit',title:'公共交通联程',available:true,minutes:28,transfers:0,modes:['metro'],warnings:[],quote:{totalCents:1400,segments:[{mode:'metro',label:'港铁',amountCents:1400}]},result:{journey:{complete:true},segments:[{kind:'metro',label:'港铁',minutes:28}]}};
    $=_.result;C=[_];`);
  const begin=()=>{setChoice();run('openTicketPage();ticketPage.handleAction("confirm");ticketPage.handleAction("issue")');assert.equal(run('ticketPage.snapshot().phase'),'issuing');};
  const flush=()=>{for(const [id,fn] of [...timers]){timers.delete(id);fn();}};
  return {context,run,clock,stored,timers,messages,setChoice,begin,flush};
}

test('privacy opt-out clears a saved ticket wallet before the lazy controller has been opened',()=>{
  const stored=new Map([[TICKET_STORAGE_KEY,JSON.stringify({version:1,passes:[]})]]),h=harness({remember:true,stored});
  assert.equal(h.run('ticketPage'),undefined);
  assert.equal(h.run('t3({dataset:{privacy:"rememberOnDevice"},checked:false})'),true);
  assert.equal(stored.has(TICKET_STORAGE_KEY),false);
  assert.equal(h.run('O.snapshot().privacy.rememberOnDevice'),false);
});

test('delete data clears lazy storage and keeps future passes memory-only after account privacy resets',()=>{
  for(const initialize of [false,true]){
    const h=harness({remember:true,stored:new Map([[TICKET_STORAGE_KEY,JSON.stringify({version:1,passes:[]})]])});
    if(initialize)h.run('getTicketPage()');
    assert.equal(h.run('a3({dataset:{action:"confirm-reset"}})'),true);
    assert.equal(h.stored.has(TICKET_STORAGE_KEY),false);
    assert.equal(h.run('O.snapshot().privacy.rememberOnDevice'),false);
    h.begin();h.flush();assert.equal(h.run('ticketPage.listPasses().length'),1);
    assert.equal(h.stored.has(TICKET_STORAGE_KEY),false,'new pass must not restore persistence after reset');
  }
});

test('browser history/hash leave and BFCache pagehide cancel ticket ceremony without later background issuance',()=>{
  for(const leave of ['restoreAppLocation({state:null})','onPageHide({persisted:true})']){
    const h=harness();h.begin();const oldCallback=[...h.timers.values()][0];
    h.run(leave);assert.equal(h.timers.size,0,leave);oldCallback();h.flush();
    assert.equal(h.run('ticketPage.listPasses().length'),0,leave);
    assert.equal(h.run('ticketPage.snapshot().phase'),'summary',leave);
  }
});

test('all ticket stage renders pause the sole clock, including hash/history entry',()=>{
  const h=harness();h.clock.play(true);h.run('location.hash="#tickets";restoreAppLocation({state:null})');
  assert.equal(h.run('r.stage'),'tickets');assert.equal(h.clock.playing,false);
  const before=h.clock.snapshot();h.clock.tick(100);h.clock.tick(300);assert.deepEqual(h.clock.snapshot(),before);
});

test('matching pass remains replayable but a changed selected route context cannot start navigation',()=>{
  const h=harness();h.begin();h.flush();assert.equal(h.run('ticketPage.snapshot().stale'),false);
  h.run('_.id="another-current-route"');assert.equal(h.run('ticketPage.snapshot().stale'),true);
  h.run('ticketPage.handleAction("navigate")');assert.equal(h.run('r.stage'),'tickets');
  assert.match(h.run('ticketPage.snapshot().error'),/路线已变化/);
});

test('stored passes cannot replay a different passenger preference after session revision counters collide',()=>{
  const stored=new Map(),first=harness({remember:true,stored});
  first.run('r.need="ordinary";ticketRouteRevision=1');first.begin();first.flush();
  const id=first.run('ticketPage.snapshot().pass.id');
  const restored=harness({remember:true,stored});restored.setChoice();
  restored.run('r.need="lift";ticketRouteRevision=1');
  restored.run(`getTicketPage().openPass(${JSON.stringify(id)})`);
  assert.equal(restored.run('ticketPage.snapshot().phase'),'issued','historical pass remains readable');
  assert.equal(restored.run('ticketPage.snapshot().stale'),true,'matching counters do not establish matching route conditions');
});

test('stored route identity includes taxi policy, coordinates, complete steps, lines and segment details',()=>{
  const stored=new Map(),first=harness({remember:true,stored});first.begin();first.flush();
  const id=first.run('ticketPage.snapshot().pass.id');
  for(const change of ['t1.add("taxi")','r.origin.coordinates=[114.16,22.28]','r.destination.floorId="L2"',
    '_.result.journey.steps=[{kind:"walk",guidance:{edge_ids:["different-edge"],geometry:{type:"LineString",coordinates:[[114.16,22.28],[114.17,22.29]]}}}]',
    '_.result.lines=[{kind:"walk",coordinates:[[114.16,22.28],[114.17,22.29]]}]','_.result.segments[0].label="另一条路线"']){
    const restored=harness({remember:true,stored});restored.setChoice();restored.run(change);
    restored.run(`getTicketPage().openPass(${JSON.stringify(id)})`);
    assert.equal(restored.run('ticketPage.snapshot().stale'),true,change);
  }
  const exact=harness({remember:true,stored});exact.setChoice();
  exact.run('_.quote.id="different-random-quote";_.quote.createdAt=99;_.result.journey.graph={opaque:"not a path identity input"};r.origin={name:"金钟",id:"ADM"}');
  exact.run(`getTicketPage().openPass(${JSON.stringify(id)})`);
  assert.equal(exact.run('ticketPage.snapshot().stale'),false,'equivalent itinerary survives reload and property order changes');
});

test('ticket Back returns to the actual entry page despite a retained route, including hash entry',()=>{
  for(const stage of ['orders','routes','navigation']){
    const h=harness();h.setChoice();h.run(`r.stage=${JSON.stringify(stage)};H("tickets");getTicketPage().showWallet();getTicketPage().handleAction("back")`);
    assert.equal(h.run('r.stage'),stage);
  }
  const h=harness();h.setChoice();h.run('r.stage="orders";r.ticketReturnStage="routes";location.hash="#tickets";restoreAppLocation({state:null});getTicketPage().showWallet();getTicketPage().handleAction("back")');
  assert.equal(h.run('r.stage'),'orders','hash entry replaces an old return target');
});

test('ticket-only deletion failures are exposed by privacy/reset notifications and account warning text',()=>{
  for(const action of ['t3({dataset:{privacy:"rememberOnDevice"},checked:false})','a3({dataset:{action:"confirm-reset"}})']){
    const stored=new Map([[TICKET_STORAGE_KEY,JSON.stringify({version:1,passes:[]})]]),h=harness({remember:true,stored,deleteFails:true});
    h.run(action);assert.equal(stored.has(TICKET_STORAGE_KEY),true,'failed removal cannot be reported as deletion');
    assert.match(h.messages.at(-1),/浏览器保存数据仍需确认/);
    assert.match(h.run('ticketStorageWarning()'),/未能|无法/);
    assert.doesNotMatch(h.messages.at(-1),/已删除此应用/);
  }
  assert.match(source,/M\(e\.storageMessage\)[\s\S]{0,100}ticketStorageWarning/,'account rendering surfaces ticket storage warning');
});

test('HSR viewers retain state on re-render and never inject schematic regions into official geometry',()=>{
  const host={innerHTML:'',dataset:{},addEventListener(){},querySelector:()=>null};
  const official={regions:[{id:'ADM',name:'金钟',center:[114.1658,22.2791]}],nodes:[],edges:[]};
  let received;
  const context=vm.createContext({STATIONS,validStation,createJourney3DModel,AbortController,A:()=>host,L1:official,
    r:{stage:'station',station:'HSR:WEK'},y1:false,journeyModel:undefined,stationModel:undefined,stationModelRegion:'',pacificModel:undefined,pacificModelTarget:'',
    createStationModel:(_host,graph)=>(received=graph,{focusRegion(){},resize(){},dispose(){}}),ensureFineMapContext(){},writeAppHistory(){},x(){},requestAnimationFrame(){},M:String,
  });
  vm.runInContext(between('function renderStationModel(){','function x(){'),context);
  vm.runInContext('renderStationModel();journeyModel.focusFloor("B4");journeyModel.setProgress(.5);journeyModel.focusFloor("B4");var original=journeyModel;var snapshot=journeyModel.getState();renderStationModel()',context);
  assert.equal(vm.runInContext('journeyModel===original',context),true);
  assert.deepEqual(vm.runInContext('journeyModel.getState()',context),vm.runInContext('snapshot',context));
  assert.equal(received,undefined,'HSR does not instantiate official model');
  vm.runInContext('r.station="ADM";renderStationModel()',context);
  assert.ok(received.regions.length>=5);assert.equal(received.regions.some(region=>region.id.startsWith('HSR:')),false);
  assert.equal(official.regions.length,1,'official region graph is not mutated');
});
