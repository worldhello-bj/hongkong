import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stopCatalog,layoutStops,renderStopMarkers,stopCard,stopDepartures,formatStopTime,createTransitStopLayer} from '../../src/navigation/transit-stops.js';
const services=JSON.parse(readFileSync(new URL('../../dist/transit/services.json',import.meta.url)));
const project=([x,y])=>[(x-114.165)*102900,-(y-22.279)*111320];
const catalog=stopCatalog(services);
test('only existing bus/tram stops, exact coordinate identity and deduplicated route directions',()=>{assert.ok(catalog.length>50);assert.ok(catalog.some(s=>s.mode==='tram'));assert.ok(catalog.some(s=>s.mode==='bus'));for(const s of catalog){assert.deepEqual(s.coordinates,services.stops.find(x=>x.id===s.id).coordinates);assert.equal(new Set(s.routes.map(x=>JSON.stringify(x))).size,s.routes.length);}});
test('wide view clusters without losing stops; zoom gives individual exact positions',()=>{const view={x:-5000,y:-8000,w:15000,h:15000};const wide=layoutStops(catalog,view,390,project);assert.equal(wide.reduce((n,g)=>n+g.stops.length,0),catalog.length);assert.ok(wide.length<catalog.length);const s=catalog[0],[x,y]=project(s.coordinates);const close=layoutStops(catalog,{x:x-200,y:y-200,w:1000,h:1000},390,project);assert.ok(close.every(g=>g.stops.length===1));assert.deepEqual([close.find(g=>g.stops[0].id===s.id).x,close.find(g=>g.stops[0].id===s.id).y],[x,y]);});
test('card shows existing route, source, actions and escapes untrusted names',()=>{const card=stopCard({...catalog[0],name:'<script>x</script>'});assert.ok(card.includes('&lt;script&gt;'));assert.ok(card.includes('data-stop-side="origin"'));assert.ok(card.includes('data-stop-side="destination"'));assert.ok(card.includes('非实时到站'));assert.ok(card.includes(catalog[0].routes[0].label));});
test('controller single stop, keyboard, endpoint actions, close, clustering and cached redraw',()=>{const listeners={},cardListeners={};let queued,writes=0,selected,expanded;globalThis.requestAnimationFrame=fn=>(queued=fn,1);const map={addEventListener:(k,fn)=>listeners[k]=fn},layer={set innerHTML(s){this.html=s;writes++}},card={hidden:true,innerHTML:'',addEventListener:(k,fn)=>cardListeners[k]=fn};const controller=createTransitStopLayer({map,layer,card,project,onChoose:(s,side)=>selected=[s,side],onExpand:p=>expanded=p});const [x,y]=project(catalog[0].coordinates),view={x:x-50,y:y-50,w:1000,h:1000};controller.render(services,view,390);queued();const before=writes;controller.render(services,view,390);queued();assert.equal(writes,before);const event={type:'click',clientX:0,clientY:0,target:{closest:()=>({dataset:{transitStop:'0'}})},preventDefault(){},stopPropagation(){}};listeners.click(event);assert.equal(card.hidden,false);for(const side of ['origin','destination']){cardListeners.click({target:{closest:()=>({dataset:{stopSide:side},hasAttribute:()=>false})}});assert.equal(selected[1],side);assert.deepEqual(selected[0].coordinates,catalog.find(s=>s.id===selected[0].id).coordinates);}listeners.keydown({...event,type:'keydown',key:'Enter'});assert.equal(card.hidden,false);cardListeners.click({target:{closest:()=>({dataset:{},hasAttribute:()=>true})}});assert.equal(card.hidden,true);controller.render(services,{x:-5000,y:-8000,w:15000,h:15000},390);queued();const groups=layoutStops(catalog,{x:-5000,y:-8000,w:15000,h:15000},390,project),index=groups.findIndex(g=>g.stops.length>1);listeners.click({...event,target:{closest:()=>({dataset:{transitStop:String(index)}})}});assert.ok(expanded.length>1);assert.equal(card.hidden,true);});
test('large touch targets, distinct icon shapes, limited labels and source integration',()=>{const groups=layoutStops(catalog,{x:-5000,y:-8000,w:15000,h:15000},390,project);const svg=renderStopMarkers(groups,true);assert.match(svg,/r="22"/);assert.match(svg,/tabindex="0"/);assert.ok((svg.match(/class="na-stop-label"/g)||[]).length<=12);const main=readFileSync(new URL('../../src/navigation/main.recovered.js',import.meta.url),'utf8');assert.match(main,/onChoose:\(stop,side\)=>\{r.target=side;D1/);assert.match(main,/L.target.closest\?\.\("\[data-transit-stop\]"\)\)return/);});

const metroStop={id:'test:metro',name:'测试站<br>Test station',coordinates:[114.165,22.279]};
const metroPattern={id:'test:line',mode:'metro',label:'测试线',direction:'往 测试总站',stops:[{stopId:metroStop.id}]};
const metroServices={stops:[metroStop],patterns:[metroPattern]};
const metro=stopCatalog(metroServices)[0];
const departure=(arrivalS,extra={})=>({mode:'metro',label:'测试线',direction:'往 测试总站',arrivalS,departureS:arrivalS+15,...extra});

test('metro catalog uses supplied station coordinates and excludes unsupported or invalid stops',()=>{
  const input={stops:[metroStop,{id:'missing',name:'missing',coordinates:[114]},{id:'ferry',name:'ferry',coordinates:[114,22]}],
    patterns:[metroPattern,{...metroPattern,id:'duplicate'}, {...metroPattern,id:'bad',stops:[{stopId:'missing'}]},
      {mode:'ferry',label:'ferry',stops:[{stopId:'ferry'}]}]};
  const stations=stopCatalog(input);
  assert.equal(stations.length,1);
  assert.equal(stations[0].name,'测试站');assert.equal(stations[0].mode,'metro');
  assert.equal(stations[0].routes.length,1);assert.deepEqual(stations[0].coordinates,metroStop.coordinates);
  const markers=renderStopMarkers(layoutStops(stations,{x:-100,y:-100,w:1000,h:1000},390,project));
  assert.match(markers,/na-transit-stop metro/);assert.match(markers,/港铁站，查看模拟下一班/);assert.match(markers,/>铁<\/text>/);
  assert.match(stopCard(stations[0]),/现有港铁站点与演示时刻表/);
  assert.doesNotMatch(stopCard(stations[0]),/运输署站点资料/);
});

test('card next arrival and subsequent departures use model times, date, direction and escaping',()=>{
  let called;
  const model={departures(...args){called=args;return [departure(3660),departure(3780,{direction:'往 <终点>'}),departure(3900)];}};
  const html=stopCard(metro,{}, {model,timeS:3630,departureDate:'2026-10-13'});
  assert.deepEqual(called,[metro.id,3630,'2026-10-13',{limit:3}]);
  assert.match(html,/30秒后到站/);assert.match(html,/2分30秒后到站/);assert.match(html,/4分30秒后到站/);
  assert.equal((html.match(/<li /g)||[]).length,3);
  assert.match(html,/模拟时间：2026-10-13 01:00（香港）/);
  assert.match(html,/模拟到站 01:01 · 发车 01:01/);
  assert.match(html,/往 &lt;终点&gt;/);assert.doesNotMatch(html,/往 <终点>/);
  assert.match(html,/role="timer" aria-live="off"/);assert.match(html,/模拟下一班 · 非实时到站/);
});

test('countdowns roll over correctly and never describe a dwell as a future arrival',()=>{
  assert.equal(formatStopTime(86399),'23:59');assert.equal(formatStopTime(86460),'次日 00:01');
  assert.equal(formatStopTime(172800),'+2日 00:00');assert.equal(formatStopTime(-60),'前日 23:59');
  assert.equal(formatStopTime(NaN),'—');
  const model={departures:()=>[departure(86390,{departureS:86410}),departure(86460),departure(90100)]};
  const html=stopDepartures(metro,{model,timeS:86400,departureDate:'2026-10-13'});
  assert.match(html,/已到站/);assert.match(html,/1分后到站/);assert.match(html,/次日 00:01/);
  assert.match(html,/1小时1分40秒后到站/);assert.doesNotMatch(html,/-10秒/);
  const immediate=stopDepartures(metro,{model:{departures:()=>[departure(86400)]},timeS:86400});
  assert.match(immediate,/即将到站/);
});

test('unready and out-of-service cards stay honest rather than inventing a countdown',()=>{
  assert.match(stopDepartures(metro),/模拟时刻表尚未就绪/);
  const html=stopDepartures(metro,{timeS:3600,model:{departures:()=>[]}});
  assert.match(html,/暂无可乘班次/);assert.doesNotMatch(html,/na-stop-countdown/);
  const past=stopDepartures(metro,{timeS:3600,model:{departures:()=>[departure(3000)]}});
  assert.match(past,/暂无可乘班次/);
});

test('clock updates only the open departure section, preserves controls, and caches within a second',()=>{
  const listeners={},cardListeners={},attributes={};let queued,markerWrites=0,cardWrites=0,contentWrites=0,closeFocus=0,markerFocus=0,calls=0;
  globalThis.requestAnimationFrame=fn=>(queued=fn,1);
  const content={set innerHTML(html){this.html=html;contentWrites++;}};
  const map={addEventListener:(type,fn)=>listeners[type]=fn};
  const layer={set innerHTML(html){this.html=html;markerWrites++;}};
  const card={hidden:true,set innerHTML(html){this.html=html;cardWrites++;},addEventListener:(type,fn)=>cardListeners[type]=fn,
    setAttribute:(key,value)=>attributes[key]=value,querySelector:selector=>selector==='[data-stop-departures]'?content:{focus:()=>closeFocus++}};
  const controller=createTransitStopLayer({map,layer,card,project,onChoose(){},onExpand(){}});
  const model={departures(){calls++;return [departure(3600)];}};
  controller.render(metroServices,{x:-100,y:-100,w:1000,h:1000},390,{timeS:3570,departureDate:'2026-10-13',model});queued();
  const hit={dataset:{transitStop:'0'},focus:()=>markerFocus++};
  listeners.keydown({type:'keydown',key:'Enter',target:{closest:()=>hit},preventDefault(){},stopPropagation(){}});
  assert.equal(closeFocus,1);assert.equal(card.hidden,false);assert.equal(attributes.role,'region');
  assert.equal(attributes['aria-labelledby'],'na-stop-card-title');
  const originalCardWrites=cardWrites;
  controller.updateClock({timeS:3571});assert.match(content.html,/29秒后到站/);
  const count=contentWrites;
  controller.updateClock({timeS:3571.9});assert.equal(contentWrites,count);
  controller.updateClock({departureDate:'2026-10-14'});assert.equal(contentWrites,count+1);
  assert.match(content.html,/2026-10-14/);assert.equal(cardWrites,originalCardWrites);assert.equal(markerWrites,1);
  cardListeners.keydown({key:'Escape',preventDefault(){},stopPropagation(){}});
  assert.equal(card.hidden,true);assert.equal(markerFocus,1);
  const callsAtClose=calls;controller.updateClock({timeS:3572});assert.equal(calls,callsAtClose);
});
test('metro card keeps readable direction without internal routing IDs',()=>{
 const stop={id:'RAIL:ADM:EAL',name:'金钟站',mode:'metro',routes:[{mode:'metro',label:'东铁线 金钟 → 红磡',direction:'RAIL:ADM:EAL→RAIL:HUH:EAL'}]};
 const model={departures:()=>[{mode:'metro',label:'东铁线 金钟 → 红磡',direction:'RAIL:ADM:EAL→RAIL:HUH:EAL',arrivalS:28860,departureS:28860}]};
 const html=stopCard(stop,{}, {timeS:28800,departureDate:'2026-10-13',model});assert.ok(html.includes('金钟 → 红磡'));assert.ok(!html.includes('RAIL:'));
});
