import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseNavigationLocation,normalizeAppStage,navigationUrl,primaryAppTab,STATIONS} from '../../src/navigation/ui-navigation.js';
import {stationPanel,informationPanel} from '../../src/navigation/ui-content.js';
import {migrateNavigationEntrypoints,NAVIGATION_ENTRYPOINTS,RETIRED_UI_ASSETS} from '../../scripts/navigation-entrypoints.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));

test('historical URLs resolve inside one app, with safe standalone navigation states',()=>{
  for(const [pathname,search,hash,stage,station] of [
    ['/area.html','','','home','ADM'],['/metro.html','','','station','ADM'],['/research.html','','','info','ADM'],
    ['/area.html','?station=AUS','','station','AUS'],['/','#unused','#station?station=HUH','station','HUH'],
    ['/','','#metro','station','ADM'],['/','','#research','info','ADM'],['/','','#navigation','routes','ADM'],
    ['/','','#checkout','orders','ADM'],['/','','#arrival','home','ADM'],['/','','#bogus','home','ADM'],
    ['/metro.html','?station=<script>','','station','ADM'],['/metro','','','station','ADM'],['/metro/','','','station','ADM'],['/research','','','info','ADM']
  ])assert.deepEqual(parseNavigationLocation({pathname,search,hash}),{stage,station});
  assert.equal(navigationUrl({stage:'station',station:'KOW'}),'/#station?station=KOW');
  assert.equal(navigationUrl({stage:'unexpected'}),'/#home');
  assert.equal(normalizeAppStage('navigation',{hasJourney:true}),'navigation');
  assert.equal(primaryAppTab('checkout'),'orders');assert.equal(primaryAppTab('info'),'services');
});

test('all historical HTML is replaced, retired UI physically removed, shared 3D retained',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'hk-entrypoints-'));
  try{
    await mkdir(join(folder,'src/navigation'),{recursive:true});await mkdir(join(folder,'dist/assets'),{recursive:true});
    const html=await readFile(join(root,'src/navigation/index.html'),'utf8');await writeFile(join(folder,'src/navigation/index.html'),html);
    for(const name of NAVIGATION_ENTRYPOINTS)await writeFile(join(folder,'dist',name),'<div id="legacy-app">old</div>');
    for(const name of RETIRED_UI_ASSETS)await writeFile(join(folder,'dist/assets',name),'old ui');
    for(const name of ['mobile-navigation-DfEsS_7b.js','mobile-navigation-Czoj-V-L.css','metro-worker-BDEusPKL.js','tram-model-DNfzveeh.js'])await writeFile(join(folder,'dist/assets',name),'preserve');
    await migrateNavigationEntrypoints(folder);await migrateNavigationEntrypoints(folder);
    for(const name of NAVIGATION_ENTRYPOINTS){const output=await readFile(join(folder,'dist',name),'utf8');assert.equal(output,html);assert.match(output,/id="navigation-app"/);assert.match(output,/main-integrated.js/);assert.doesNotMatch(output,/legacy-app|id="area-app"|id="metro-app"|research-CfFgT8e-/)}
    for(const name of RETIRED_UI_ASSETS)assert.equal(existsSync(join(folder,'dist/assets',name)),false,name);
    for(const name of ['mobile-navigation-DfEsS_7b.js','mobile-navigation-Czoj-V-L.css','metro-worker-BDEusPKL.js','tram-model-DNfzveeh.js'])assert.equal(await readFile(join(folder,'dist/assets',name),'utf8'),'preserve');
  }finally{await rm(folder,{recursive:true,force:true})}
});

test('station and information screens expose unified actions and evidence boundaries',()=>{
  const panel=stationPanel({station:'KOW'},true,String);
  for(const station of STATIONS)assert.ok(panel.includes(`data-station="${station.id}"`));
  assert.match(panel,/九龙站部分站体为示意/);assert.match(panel,/data-action="close-secondary"/);
  const info=informationPanel();assert.match(info,/共四种偏好/);assert.doesNotMatch(info,/严格无障碍|共五种偏好/);assert.match(info,/无真实售票、调度或扣款/);assert.doesNotMatch(info,/href="\.\/(area|metro|research)\.html"/);
});

test('full source shell: tabs, repeated open/close, hash and back/forward stay unified',async()=>{
  const els=new Map(),listeners=new Map(),frames=[];let modelCreates=0,modelResizes=0;const modelRegions=[];let navigationCallbacks,navigationSetCount=0;const navigationState={journey:null,index:0,progress:0};
  function el(id){if(els.has(id))return els.get(id);const classes=new Set();const value={id,innerHTML:'',textContent:'',style:{},dataset:{},clientWidth:390,clientHeight:844,childElementCount:0,hidden:false,value:'',open:false,relList:{supports:()=>true},focus(){},matches(){return false},closest(){return null},classList:{add:v=>classes.add(v),remove:v=>classes.delete(v),toggle(v){if(classes.has(v)){classes.delete(v);return false}classes.add(v);return true}},querySelector:el,querySelectorAll:()=>[],setAttribute(){},getAttribute(){return null},toggleAttribute(){},getBoundingClientRect:()=>({height:235,width:390,top:0,left:0}),addEventListener:(event,fn)=>listeners.set(id+':'+event,fn),insertAdjacentHTML(_,html){this.innerHTML+=html}};els.set(id,value);return value}
  globalThis.document={createElement:()=>el('created'),querySelector:el,querySelectorAll:()=>[]};
  globalThis.window={innerWidth:390,addEventListener:(event,fn)=>listeners.set('window:'+event,fn)};
  globalThis.location={pathname:'/research.html',search:'',hash:''};
  const entries=[];let index=-1;
  const setLocation=url=>{const next=new URL(url,'https://example.test');Object.assign(location,{pathname:next.pathname,search:next.search,hash:next.hash})};
  globalThis.history={state:null,pushState(state,_,url){entries.splice(index+1);entries.push({state,url});index++;this.state=state;setLocation(url)},replaceState(state,_,url){if(index<0){entries.push({state,url});index=0}else entries[index]={state,url};this.state=state;setLocation(url)}};
  globalThis.requestAnimationFrame=fn=>(frames.push(fn),frames.length);
  globalThis.cancelAnimationFrame=()=>{};
  Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});
  const stored=new Map();globalThis.localStorage={getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)};window.localStorage=localStorage;
  globalThis.fetch=()=>new Promise(()=>{});
  globalThis.__createStationModel=host=>{host.innerHTML='<svg data-test-station></svg>';modelCreates++;return{focusRegion:value=>modelRegions.push(value),resize:()=>modelResizes++,dispose(){},focusStep(){}}};
  globalThis.__createMobileNavigation=(_host,callbacks)=>{navigationCallbacks=callbacks;return{setJourney(journey){navigationSetCount++;Object.assign(navigationState,{journey,index:0,progress:0})},getSnapshot:()=>navigationState,resume(){navigationState.suspended=false},suspend(){navigationState.suspended=true},dispose(){}}};
  let source=await readFile(join(root,'src/navigation/main.recovered.js'),'utf8');
  source=source.replace('import {c as createStationModel} from "./mobile-navigation-DfEsS_7b.js";','const createStationModel=globalThis.__createStationModel;');
  assert.ok(source.includes('m as S2,'));source=source.replace('m as S2,','m as originalMobileNavigation,')+'\nconst S2=globalThis.__createMobileNavigation;';
  source=source.replace(/from\s*["'](\.\/[^"']+)["']/g,(_,path)=>{const own=new URL(path,new URL('../../src/navigation/main.recovered.js',import.meta.url));const target=existsSync(fileURLToPath(own))?own:new URL(path,new URL('../../dist/assets/main-integrated.js',import.meta.url));return 'from '+JSON.stringify(target.href)});
  source=source.replaceAll('import.meta.url',JSON.stringify(new URL('../../dist/assets/main-integrated.js',import.meta.url).href));
  source+='\nexport {r,x,H,writeAppHistory,O,activeScoreWeights,z2,P2,H2,u2,currentUiSnapshot};export function uiTestLegacyHistory(need){Q1.get(history.state.navigationApp).need=need;restoreAppLocation({state:history.state})} export function uiTestRememberOrder(id,value){_1.set(id,value)}export function uiTestGraph(graph){L1=graph} export function uiTestPreference(value){r.need=value;x()} export function uiTestBlock(graph){z=graph;V=j1({id:"pacific-place"},graph)} export function uiTestJourney(journey){$={journey,lines:[]};H("navigation")} ';
  const app=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const panel=()=>el('[data-app="panel"]').innerHTML;
  const click=dataset=>listeners.get('#navigation-app:click')({target:{closest:()=>({dataset})}});
  const travel=delta=>{index+=delta;history.state=entries[index].state;setLocation(entries[index].url);listeners.get('window:popstate')({state:history.state});listeners.get('window:hashchange')()};
  assert.equal(location.pathname,'/');assert.equal(location.hash,'#info');assert.equal(app.r.stage,'info');assert.match(panel(),/数据与使用说明/);
  assert.doesNotMatch(el('#navigation-app').innerHTML,/href="\.\/(?:area|metro|research)\.html"/);
  click({tab:'home'});assert.match(panel(),/普通出行/);assert.match(panel(),/综合推荐/);
  app.uiTestPreference('lift');click({tab:'station'});assert.equal(app.r.returnStage,'home');assert.match(panel(),/站内 3D/);
  const entryCount=entries.length;click({tab:'station'});assert.equal(entries.length,entryCount,'repeated tab click replaces current history');
  click({station:'HUH'});assert.equal(location.hash,'#station?station=HUH');assert.equal(app.r.need,'lift');
  app.uiTestGraph({regions:[{id:'ADM',name:'金钟',center:[114.1658,22.2791]}],nodes:[],edges:[],portals:[]});app.x();
  assert.equal(modelCreates,1);assert.deepEqual(modelRegions,['HUH']);
  click({station:'AUS'});assert.deepEqual(modelRegions,['HUH','AUS']);assert.equal(modelCreates,1,'station switch reuses viewer');
  click({action:'close-secondary'});assert.equal(app.r.stage,'home');assert.equal(app.r.need,'lift');
  travel(-1);assert.equal(app.r.stage,'station');assert.equal(app.r.station,'AUS');
  travel(-1);assert.equal(app.r.stage,'home');assert.equal(app.r.need,'lift','history preserves edited preference');
  travel(1);assert.equal(app.r.stage,'station');
  for(const tab of ['orders','account','services','info']){click({tab});assert.equal(app.r.stage,tab);assert.ok(panel().length>50)}
  location.hash='#settings';listeners.get('window:hashchange')();assert.equal(app.r.stage,'account');assert.equal(location.hash,'#account');
  location.hash='#navigation';listeners.get('window:hashchange')();assert.equal(app.r.stage,'routes');assert.equal(location.hash,'#routes');
  for(const frame of frames.splice(0))frame();
  assert.equal(el('[data-app="station-workspace"]').hidden,true);
  click({tab:'home'});assert.match(panel(),/规划公式与权重/);assert.match(panel(),/data-score-weight="cost"/);
  const changeWeight=value=>listeners.get('#navigation-app:change')({target:{dataset:{scoreWeight:'cost'},value,matches:()=>false}});
  changeWeight('1.25');assert.equal(app.activeScoreWeights().cost,1.25);assert.equal(stored.size,0,'weights stay memory-only by default');
  app.O.setPrivacy({rememberOnDevice:true});changeWeight('2.5');assert.equal(app.activeScoreWeights().cost,2.5);assert.ok([...stored.values()].some(value=>JSON.parse(value).preferences.scoreWeights.time.cost===2.5));
  changeWeight('Infinity');assert.equal(app.activeScoreWeights().cost,2.5,'invalid changes cannot poison persisted ranking');
  click({action:'reset-score-weights'});assert.equal(app.activeScoreWeights().cost,.75);assert.equal(app.O.snapshot().preferences.scoreWeights.time,undefined);
  app.O.setPrivacy({rememberOnDevice:false});assert.equal(stored.size,0,'privacy clear includes score parameters');
  changeWeight('3');click({action:'reset-data'});click({action:'confirm-reset'});assert.equal(app.activeScoreWeights().cost,.75,'delete local data restores weight defaults');
  const mall={version:'fixture',nodes:[{id:'a',coordinates:[114.165,22.278,12]},{id:'b',coordinates:[114.1652,22.2781,12]}],edges:[{id:'e',physical_id:'e',from_id:'a',to_id:'b',kind:'walk',floor_name:'L2',floor_id:'floor',building_id:1103118159,coordinates:[[114.165,22.278,12],[114.1652,22.2781,12]],geometry_mode:'official'}],portals:[{id:'entry',name:'来源入口',node_id:'a',coordinates:[114.165,22.278,12],level_name:'L2'}],places:[{id:'pacific-place',name:'太古广场商场',coordinates:[114.165,22.278],entrance_ids:['entry'],floors:[{id:'floor',name:'L2',entrance_ids:['entry']}],access_schedule:{kind:'daily',windows:[{start_s:36000,end_s:79200}]}}]};
  click({tab:'home'});app.uiTestBlock(mall);app.r.origin={id:'pacific-place',namedPlaceId:'pacific-place',name:'太古广场商场',coordinates:[114.165,22.278]};const preservedDestination={id:'park',name:'添马公园',coordinates:[114.165,22.284]};app.r.destination=preservedDestination;app.x();assert.match(panel(),/不在已载入内部通道/);
  click({action:'pacific-model',mallTarget:'origin'});assert.equal(app.r.stage,'mall');assert.equal(location.hash,'#mall');assert.match(panel(),/太古广场 3D/);assert.equal(el('[data-app="station-workspace"]').hidden,false);
  listeners.get('[data-app="station-model"]:change')({target:{matches:()=>true,value:'L2'}});
  assert.match(el('[data-app="station-model"]').innerHTML,/选择太古广场 L2 为起点/);
  listeners.get('[data-app="station-model"]:click')({target:{closest:()=>({dataset:{ppAction:'select-floor'}})}});
  assert.equal(app.r.stage,'home');assert.equal(app.r.origin.floorId,'floor');assert.equal(app.r.origin.namedPlaceId,'pacific-place');assert.equal(app.r.destination,preservedDestination);
  click({tab:'station'});assert.match(panel(),/站内 3D/);assert.doesNotMatch(el('[data-app="station-model"]').innerHTML,/pp-model/);

  const inspectedStep={guidance:{edge_ids:['e'],geometry_mode:'official',geometry:{type:'LineString',coordinates:mall.edges[0].coordinates}}};
  const inspectedJourney={graph:{edges:[]},steps:Array.from({length:12},()=>inspectedStep),complete:true};
  app.uiTestJourney(inspectedJourney);Object.assign(navigationState,{index:8,progress:.35});const setCount=navigationSetCount;
  navigationCallbacks.onStepChange(inspectedStep,8);assert.match(el('[data-nav="inspect"]').textContent,/查看太古广场模型/);
  navigationCallbacks.onInspectModel(inspectedStep);
  assert.equal(app.r.stage,'mall');assert.equal(app.r.returnStage,'navigation');assert.equal(location.hash,'#mall');
  assert.match(el('[data-app="station-model"]').innerHTML,/<polyline[^>]+stroke="#fff"/,'instruction source edge is highlighted in the actual mall SVG');
  assert.equal(navigationState.suspended,true);assert.equal(navigationState.index,8);assert.equal(navigationState.progress,.35);
  click({action:'close-secondary'});assert.equal(app.r.stage,'navigation');assert.equal(location.hash,'#navigation');
  assert.equal(navigationState.index,8);assert.equal(navigationState.progress,.35);assert.equal(navigationSetCount,setCount,'return resumes rather than resets the navigation journey');
  navigationCallbacks.onInspectModel(inspectedStep);travel(-1);
  assert.equal(app.r.stage,'navigation');assert.equal(navigationState.index,8);assert.equal(navigationState.progress,.35);assert.equal(navigationSetCount,setCount,'browser Back also retains the instruction position');
  const stationStep={guidance:{edge_ids:['HUH:indoor'],geometry_mode:'official',geometry:{type:'LineString',coordinates:[[114.182,22.303,4.6],[114.1821,22.3031,4.6]]}}};
  inspectedJourney.graph.edges=[{id:'HUH:indoor',region_id:'HUH',source_id:'CSDI-INDOOR',geometry_mode:'official'}];
  navigationCallbacks.onStepChange(stationStep,8);assert.match(el('[data-nav="inspect"]').textContent,/查看红磡站模型/);
  navigationCallbacks.onInspectModel(stationStep);assert.equal(app.r.stage,'station');assert.equal(app.r.station,'HUH');assert.equal(modelRegions.at(-1),'HUH');
  click({action:'close-secondary'});assert.equal(app.r.stage,'navigation');assert.equal(navigationState.index,8);assert.equal(navigationSetCount,setCount);
  const historyCount=entries.length;
  navigationCallbacks.onInspectModel({guidance:{edge_ids:['unknown'],geometry_mode:'official'}});
  assert.equal(app.r.stage,'navigation');assert.equal(entries.length,historyCount,'unknown geometry never opens an unrelated ADM model');

  // Source-shell migration coverage uses only tiny fixtures; never starts a road search.
  click({tab:'home'});
  const options=panel().match(/<select data-app="need">([\s\S]*?)<\/select>/)[1];
  assert.deepEqual([...options.matchAll(/value="([^"]+)"/g)].map(match=>match[1]),['ordinary','luggage','escalator','lift']);
  click({tab:'account'});assert.doesNotMatch(panel(),/value="accessible"|严格无障碍/);click({tab:'home'});
  const oldNeeds=['accessible','strict_accessibility','strict-accessibility','wheelchair','strict','step-free'];
  for(const need of oldNeeds){
    listeners.get('#navigation-app:change')({target:{dataset:{},value:need,matches:selector=>selector==='[data-app="need"]'}});
    assert.equal(app.r.need,'ordinary');assert.match(panel(),/旧版出行偏好已重置为普通出行/);
    app.uiTestPreference('lift');location.hash='#home?need='+need;listeners.get('window:hashchange')();
    assert.equal(app.r.need,'ordinary');assert.equal(location.hash,'#home');assert.match(panel(),/旧版出行偏好已重置为普通出行/);
    app.uiTestJourney(inspectedJourney);app.uiTestLegacyHistory(need);
    assert.equal(app.r.need,'ordinary');assert.equal(app.r.stage,'routes','retired history invalidates cached route before restoring navigation');
    click({tab:'home'});app.r.need=need;
    assert.equal(app.currentUiSnapshot().need,'ordinary');app.x();assert.equal(app.r.need,'ordinary');
  }
  listeners.get('#navigation-app:change')({target:{dataset:{},value:'lift',matches:selector=>selector==='[data-app="need"]'}});
  assert.equal(app.r.need,'lift');assert.doesNotMatch(panel(),/旧版出行偏好已重置为普通出行/);
  for(const hash of ['#accessible','#strict','#home?profile=accessible','#home?preference=strict','#home?mode=wheelchair','#home?accessibility=true']){
    app.uiTestPreference('lift');location.hash=hash;listeners.get('window:hashchange')();
    assert.equal(app.r.need,'ordinary');assert.equal(app.r.stage,'home');assert.equal(location.hash,'#home');assert.match(panel(),/旧版出行偏好已重置为普通出行/);
  }
  location.hash='#home?need=lift';listeners.get('window:hashchange')();
  assert.equal(app.r.need,'lift');assert.doesNotMatch(panel(),/旧版出行偏好已重置为普通出行/);
  app.O.setPreferences({priority:'accessible'});
  listeners.get('#navigation-app:change')({target:{dataset:{},value:'luggage',matches:selector=>selector==='[data-app="need"]'}});
  assert.equal(app.O.snapshot().preferences.passengerNeedMigrated,false,'explicit passenger choice clears stored migration notice');
  app.O.setPreferences({priority:'accessible'});click({tab:'account'});
  listeners.get('#navigation-app:change')({target:{dataset:{},value:'budget',matches:selector=>selector==='[data-app="account-priority"]'}});
  assert.equal(app.O.snapshot().preferences.passengerNeedMigrated,false);assert.doesNotMatch(panel(),/旧版出行偏好已重置为普通出行/);click({tab:'home'});
  assert.ok(app.P2.every(persona=>persona.id!=='accessible'));
  assert.equal(app.H2([{id:'walk',available:true,minutes:5,cost:0,walkMinutes:5,transfers:0,modes:['walk']}],'accessible').persona.id,'commuter');

  const seedEngine=new app.z2({now:()=>1000});
  const seedQuote=seedEngine.createQuote({title:'保留订单',origin:'原起点',destination:'原终点',segments:[{mode:'bus',label:'演示公交',durationMinutes:5,distanceM:1000}]});
  const seedOrder=seedEngine.reserve(seedQuote.id,'reserve-seed');seedEngine.pay(seedOrder.id,'pay-seed');
  seedEngine.state.privacy.rememberOnDevice=true;seedEngine.state.account.name='保留昵称';
  for(const need of oldNeeds){
    const saved=structuredClone(seedEngine.state);saved.preferences.priority=need;saved.preferences.stepFree=true;saved.orders[0].quote.need=need;
    let serialized=JSON.stringify(saved);
    const engine=new app.z2({now:()=>1001,storage:{getItem:()=>serialized,setItem:(_key,value)=>{serialized=value},removeItem(){throw Error('must not delete a valid legacy account')}}});
    assert.equal(engine.snapshot().account.name,'保留昵称');assert.equal(engine.snapshot().preferences.priority,'fast');assert.equal(engine.snapshot().preferences.stepFree,false);
    assert.equal(engine.snapshot().orders[0].status,'paid');assert.equal(engine.snapshot().orders[0].quote.need,'ordinary');
    assert.equal(JSON.parse(serialized).preferences.priority,'fast');assert.equal(JSON.parse(serialized).orders[0].paidCents,seedEngine.state.orders[0].paidCents);
    engine.setPreferences({priority:need,stepFree:true});assert.equal(engine.snapshot().preferences.priority,'fast');assert.equal(engine.snapshot().preferences.stepFree,false);
    assert.throws(()=>engine.setPreferences({priority:'bad-priority'}),/出行偏好无效/);
  }
  const appQuote=app.O.createQuote({title:'缓存订单',origin:'原起点',destination:'原终点',segments:[{mode:'walk',label:'步行',durationMinutes:1,distanceM:20}]});
  const appOrder=app.O.reserve(appQuote.id,'reserve-cache');app.O.pay(appOrder.id,'pay-cache');
  for(const need of oldNeeds){
    const origin={id:'old-origin',name:'原起点',coordinates:[114.165,22.278]},destination={id:'old-destination',name:'原终点',coordinates:[114.166,22.279]};
    app.uiTestRememberOrder(appOrder.id,{need,origin,destination,choice:{result:{journey:inspectedJourney}}});
    click({resume:appOrder.id});
    assert.equal(app.r.need,'ordinary');assert.equal(app.r.stage,'home');assert.equal(app.r.origin,origin);assert.equal(app.r.destination,destination);
    assert.equal(app.O.snapshot().orders.find(order=>order.id===appOrder.id).status,'paid');assert.match(el('[data-app="status"]').textContent,/旧订单不会再次扣款/);
  }
  const choice=app.u2('walk',{journey:{complete:true,phases:[],steps:[]},segments:[{kind:'walk',label:'来源步道',minutes:1,distanceM:20}],lines:[],warnings:[]});
  assert.equal(choice.accessibility,'unknown');assert.equal(choice.luggageCompatible,undefined,'absence of stairs does not verify luggage capability');
});
