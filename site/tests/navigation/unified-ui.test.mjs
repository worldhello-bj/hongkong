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
    ['/metro.html','?station=<script>','','station','ADM']
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
  const info=informationPanel();assert.match(info,/严格无障碍/);assert.match(info,/无真实售票、调度或扣款/);assert.doesNotMatch(info,/href="\.\/(area|metro|research)\.html"/);
});

test('full source shell: tabs, repeated open/close, hash and back/forward stay unified',async()=>{
  const els=new Map(),listeners=new Map(),frames=[];let modelCreates=0,modelResizes=0;const modelRegions=[];
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
  globalThis.__createStationModel=()=>{modelCreates++;return{focusRegion:value=>modelRegions.push(value),resize:()=>modelResizes++,dispose(){},focusStep(){}}};
  let source=await readFile(join(root,'src/navigation/main.recovered.js'),'utf8');
  source=source.replace('import {c as createStationModel} from "./mobile-navigation-DfEsS_7b.js";','const createStationModel=globalThis.__createStationModel;');
  source=source.replace(/from\s*["'](\.\/[^"']+)["']/g,(_,path)=>{const own=new URL(path,new URL('../../src/navigation/main.recovered.js',import.meta.url));const target=existsSync(fileURLToPath(own))?own:new URL(path,new URL('../../dist/assets/main-integrated.js',import.meta.url));return 'from '+JSON.stringify(target.href)});
  source=source.replaceAll('import.meta.url',JSON.stringify(new URL('../../dist/assets/main-integrated.js',import.meta.url).href));
  source+='\nexport {r,x,H,writeAppHistory,O,activeScoreWeights};export function uiTestGraph(graph){L1=graph} export function uiTestPreference(value){r.need=value;x()}';
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

});
