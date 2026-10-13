import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createTicketPageController,prepareTicketTrip,ticketPassId,isTicketContextCurrent,renderTicketPage,renderTicketPassList,focusTicketPage,TICKET_STORAGE_KEY} from '../../src/navigation/ticket-page.js';

const context = (extra={}) => ({departureDate:'2026-10-13',departureS:28800,trafficRevision:3,scenarioKey:'2026-10-13:28800',routeRevision:7,epochMs:Date.parse('2026-10-13T00:00:00Z'),...extra});
const choice = (extra={}) => ({id:'transit',title:'港铁联程',available:true,minutes:28,transfers:1,modes:['walk','metro'],warnings:['候车为模型估算'],quote:{id:'random-quote',totalCents:1400,segments:[{mode:'walk',label:'入口接驳',amountCents:0},{mode:'metro',label:'港铁荃湾线',amountCents:1400}]},result:{navigationSnapshot:context(),journey:{complete:true},segments:[{kind:'walk',label:'入口接驳',minutes:5},{kind:'metro',label:'港铁荃湾线',minutes:23}]},...extra});
const input = (selected=choice()) => ({choice:selected,origin:{id:'ADM',name:'金钟'},destination:{id:'MOK',name:'旺角'}});
function harness(options={}) {
  let current=context(), next=0;
  const timers=new Map(), storage=new Map(), notifications=[], callbacks=[];
  const controller=createTicketPageController({getContext:()=>current,onChange:state=>notifications.push(state),onBack:()=>callbacks.push('back'),onPlan:()=>callbacks.push('plan'),onNavigate:pass=>callbacks.push(pass.id),schedule:(fn,ms)=>{const id=++next;timers.set(id,{fn,ms});return id;},cancelSchedule:id=>timers.delete(id),storage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},...options});
  return {controller,timers,storage,notifications,callbacks,setCurrent:value=>current=value,flush:()=>{for(const [id,{fn}] of [...timers]){timers.delete(id);fn();}}};
}
function issue(h) {h.controller.open(input());h.controller.handleAction('confirm');h.controller.handleAction('issue');h.flush();return h.controller.snapshot();}

test('standalone flow confirms, summarizes, ceremonially issues and revisits a demo-only pass',()=>{
  const h=harness();
  assert.equal(h.controller.snapshot().phase,'empty');
  assert.equal(h.controller.open(input()),true);
  assert.equal(h.controller.snapshot().phase,'confirm');
  assert.match(h.controller.render(),/确认行程，查看摘要/);
  h.controller.handleAction('confirm');assert.equal(h.controller.snapshot().phase,'summary');
  assert.match(h.controller.render(),/HK\$ 14\.00/);
  h.controller.handleAction('issue');assert.equal(h.controller.snapshot().phase,'issuing');assert.equal(h.timers.size,1);
  h.flush();const state=h.controller.snapshot();assert.equal(state.phase,'issued');assert.equal(state.pass.status,'demo-issued');assert.equal(state.pass.demoOnly,true);assert.equal(state.pass.chargedCents,0);assert.equal(state.pass.issuedAt,context().epochMs);
  assert.match(h.controller.render(),/非车票 · 非预订 · 不能用于乘车、进站或出入境/);
  assert.equal(h.storage.size,0,'default never persists');
  h.controller.handleAction('wallet');assert.equal(h.controller.snapshot().phase,'empty');assert.match(h.controller.render(),/我的演示票夹/);
  h.controller.handleAction('open-pass',state.pass.id);assert.equal(h.controller.snapshot().pass.id,state.pass.id);
  h.controller.handleAction('navigate');assert.deepEqual(h.callbacks,[state.pass.id]);
  assert.match(h.controller.passListHtml(),new RegExp(state.pass.id));
});

test('HSR unknown fare stays unknown and never creates a paid order or reserved seat',()=>{
  const highspeed=choice({id:'highspeed',modes:['highspeed'],quote:{id:null,available:false,pricingUnavailable:true,totalCents:0,segments:[]},result:{navigationSnapshot:context(),highSpeed:true,journey:{complete:true},segments:[{kind:'walk',label:'办理手续',minutes:45},{kind:'highspeed',label:'G5602 · 西九龙 → 福田',minutes:14}]}});
  const h=harness();h.controller.open(input(highspeed));h.controller.handleAction('confirm');
  const summary=h.controller.render();assert.match(summary,/高铁票价与余票未接入/);assert.match(summary,/不会生成跨境车票、座位预订或已支付订单/);assert.match(summary,/全程价格/);assert.doesNotMatch(summary,/HK\$ 0\.00/);
  h.controller.handleAction('issue');h.flush();const {pass}=h.controller.snapshot();assert.equal(pass.trip.totalCents,null);assert.equal(pass.trip.segments[1].amountCents,null);assert.equal(pass.status,'demo-issued');assert.equal(pass.chargedCents,0);assert.equal('orderId' in pass,false);
});

test('incomplete, missing or unavailable routes never enter issuance',()=>{
  const h=harness();assert.equal(h.controller.open(input(choice({available:false}))),false);
  assert.equal(h.controller.open(input(choice({result:{journey:{complete:false}}}))),false);
  assert.equal(h.controller.open({}),false);h.controller.handleAction('confirm');h.controller.handleAction('issue');h.flush();assert.equal(h.controller.listPasses().length,0);
  assert.match(h.controller.render(),/去规划行程/);
});

test('all clock, scenario and route revision changes invalidate a summary, including subsecond ticks',()=>{
  for(const change of [{departureDate:'2026-10-14'},{departureS:28801},{departureS:28800.1},{trafficRevision:4},{scenarioKey:'new'},{routeRevision:8},{epochMs:context().epochMs+1}]){
    const h=harness();h.controller.open(input());h.controller.handleAction('confirm');h.setCurrent(context(change));
    assert.equal(h.controller.snapshot().stale,true,JSON.stringify(change));h.controller.handleAction('issue');h.flush();assert.equal(h.controller.listPasses().length,0);assert.match(h.controller.render(),/已过期/);
  }
  assert.equal(isTicketContextCurrent(context(),context()),true);
  assert.equal(isTicketContextCurrent({...context(),routeRevision:null},context()),false);
});

test('navigation snapshot is authoritative; opening an old result cannot refresh its time',()=>{
  const h=harness();h.setCurrent(context({trafficRevision:4,departureS:28900}));h.controller.open(input());
  assert.equal(h.controller.snapshot().stale,true);h.controller.handleAction('confirm');assert.equal(h.controller.snapshot().phase,'confirm');
});

test('a change during the ceremony is rechecked before any pass is committed',()=>{
  const h=harness();h.controller.open(input());h.controller.handleAction('confirm');h.controller.handleAction('issue');
  h.setCurrent(context({routeRevision:9}));h.flush();assert.equal(h.controller.snapshot().phase,'summary');assert.equal(h.controller.listPasses().length,0);assert.equal(h.storage.size,0);
});

test('double clicks and retries reuse one deterministic pass and one ceremony',()=>{
  const h=harness();h.controller.open(input());h.controller.handleAction('confirm');for(let i=0;i<5;i++)h.controller.handleAction('issue');assert.equal(h.timers.size,1);h.flush();
  const id=h.controller.snapshot().pass.id;assert.equal(h.controller.listPasses().length,1);
  h.controller.open(input(choice({quote:{...choice().quote,id:'another-random-quote'}})));h.controller.handleAction('confirm');h.controller.handleAction('issue');assert.equal(h.timers.size,0);assert.equal(h.controller.snapshot().pass.id,id);assert.equal(h.controller.listPasses().length,1);
  assert.equal(ticketPassId(prepareTicketTrip({...input(),context:context()})),id);
});

test('Back, suspend, dispose and replacing a trip cancel pending issuance',()=>{
  for(const operation of ['back','suspend','dispose','open']){
    const h=harness();h.controller.open(input());h.controller.handleAction('confirm');h.controller.handleAction('issue');
    const callback=[...h.timers.values()][0].fn;
    if(operation==='back')h.controller.handleAction('back');else if(operation==='open')h.controller.open(input());else h.controller[operation]();
    assert.equal(h.timers.size,0);callback();assert.equal(h.controller.listPasses().length,0,operation);
    if(['back','suspend'].includes(operation))assert.equal(h.controller.snapshot().phase,'summary');
  }
  const h=harness();h.controller.open(input());h.controller.handleAction('back');assert.deepEqual(h.callbacks,['back']);
});

test('synchronous host navigation inside onChange cannot leave an orphan timer',()=>{
  let controller;const timers=[];
  controller=createTicketPageController({getContext:context,schedule:fn=>timers.push(fn),onChange:state=>{if(state.phase==='issuing')controller.suspend();}});
  controller.open(input());controller.handleAction('confirm');controller.handleAction('issue');assert.equal(timers.length,0);assert.equal(controller.snapshot().phase,'summary');
});

test('issued historical credentials stay readable but cannot navigate a new scenario',()=>{
  const h=harness(),state=issue(h);h.setCurrent(context({routeRevision:99}));h.controller.openPass(state.pass.id);
  assert.match(h.controller.render(),/这是当时行程的演示记录/);assert.match(h.controller.render(),/按当前条件重新规划/);h.controller.handleAction('navigate');assert.equal(h.callbacks.length,0);
  h.controller.handleAction('plan');assert.deepEqual(h.callbacks,['plan']);
});

test('opt-in persistence survives reload, no opt-in never reads local history',()=>{
  const stored=new Map();let reads=0;const storage={getItem:key=>{reads++;return stored.get(key)??null;},setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)};
  const first=harness({storage,rememberOnDevice:true});const state=issue(first);assert.equal(stored.size,1);
  const restored=harness({storage,rememberOnDevice:true});assert.equal(restored.controller.listPasses().length,1);restored.controller.openPass(state.pass.id);assert.equal(restored.controller.snapshot().pass.id,state.pass.id);
  const before=reads,privatePage=harness({storage});assert.equal(reads,before);assert.equal(privatePage.controller.listPasses().length,0);
  restored.controller.setPersistence(false);assert.equal(stored.has(TICKET_STORAGE_KEY),false);assert.equal(restored.controller.listPasses().length,1,'current-session pass remains readable');
  restored.controller.clear();assert.equal(restored.controller.listPasses().length,0);assert.equal(restored.controller.snapshot().phase,'empty');
});

test('corrupt saved payloads and fake paid/HSR amounts are rejected',()=>{
  const h=harness();const state=issue(h);
  for(const saved of ['{oops}',JSON.stringify({version:1,passes:[{...state.pass,status:'paid'}]}),JSON.stringify({version:1,passes:[{...state.pass,id:'DEMO-forged'}]})]){
    const other=harness({rememberOnDevice:true,storage:{getItem:()=>saved}});assert.equal(other.controller.listPasses().length,0);assert.match(other.controller.snapshot().storageMessage,/无法读取/);
  }
});

test('storage failure is visible; it never converts local success into paid or persisted success',()=>{
  const h=harness({rememberOnDevice:true,storage:{getItem:()=>null,setItem:()=>{throw Error('quota');},removeItem:()=>{throw Error('denied');}}});const state=issue(h);
  assert.equal(state.phase,'issued');assert.match(state.storageMessage,/保存失败/);h.controller.setPersistence(false);assert.match(h.controller.snapshot().storageMessage,/旧票夹未能/);
});

test('renderer escapes all external strings, offers native buttons and never asks for credentials',async()=>{
  const h=harness();h.controller.open({...input(choice({title:'<img src=x onerror=bad>',warnings:['<script>bad</script>']})),origin:'<svg onload=bad>'});
  const html=h.controller.render();assert.match(html,/&lt;img/);assert.match(html,/&lt;svg/);assert.doesNotMatch(html,/<(?:img|svg|script|input|form|iframe)\b/);assert.match(html,/aria-current="step"/);assert.match(html,/type="button"/);assert.match(html,/tabindex="-1"/);
  h.controller.handleAction('confirm');assert.doesNotMatch(h.controller.render(),/<input|信用卡号|护照号码|身份证号|扫码支付/);
  const css=await readFile(new URL('../../src/navigation/ticket-page.css',import.meta.url),'utf8');assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);assert.match(css,/:focus-visible/);
});

test('reduced motion uses immediate deferred issuance and the focus helper is safe',()=>{
  const h=harness({reducedMotion:()=>true});h.controller.open(input());h.controller.handleAction('confirm');h.controller.handleAction('issue');assert.equal([...h.timers.values()][0].ms,0);h.flush();assert.equal(h.controller.snapshot().phase,'issued');
  let focused=0,scrolled=0;focusTicketPage({querySelector:()=>({focus:()=>focused++}),scrollTo:()=>scrolled++});focusTicketPage(null);assert.equal(focused,1);assert.equal(scrolled,1);
});

test('public snapshots and wallet lists cannot mutate issuance or saved passes',()=>{
  const h=harness();const state=issue(h);state.pass.status='paid';state.passes.length=0;const list=h.controller.listPasses();list[0].trip.destination='changed';
  assert.equal(h.controller.snapshot().pass.status,'demo-issued');assert.equal(h.controller.listPasses().length,1);assert.equal(h.controller.listPasses()[0].trip.destination,'旺角');
  assert.match(renderTicketPassList(h.controller.listPasses()),/data-ticket-action="open-pass"/);assert.match(renderTicketPage(),/把下一程/);
});

test('missing global epoch or route revision cannot silently use wall time',()=>{
  const h=harness();h.setCurrent({...context(),routeRevision:undefined});h.controller.open(input(choice({result:{...choice().result,navigationSnapshot:undefined}})));h.controller.handleAction('confirm');h.controller.handleAction('issue');h.flush();assert.equal(h.controller.listPasses().length,0);
  assert.throws(()=>createTicketPageController(),/global clock/);
});
