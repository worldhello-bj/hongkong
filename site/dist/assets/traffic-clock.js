/** The sole Hong Kong simulation date/time. Consumers read snapshots; controls seek it. */
const DAY_S=86400;
const hkToday=()=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Hong_Kong',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(type=>parts.find(part=>part.type===type).value).join('-');};
function dateEpoch(date){
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new RangeError('Invalid simulation date');
 const epoch=Date.parse(date+'T00:00:00Z');
 if(!Number.isFinite(epoch)||new Date(epoch).toISOString().slice(0,10)!==date)throw new RangeError('Invalid simulation date');
 return epoch;
}
export function createTrafficClock({date=hkToday(),timeS=28800,speed=10,playing=true,onSeek}={}){
 let epoch=dateEpoch(date),base=date,seconds=timeS,running=!!playing,last=null,revision=0;
 const validSeconds=value=>{if(!Number.isFinite(value)||value<0)throw new RangeError('Invalid simulation time');};
 validSeconds(timeS);if(!Number.isFinite(speed)||speed<=0)throw new RangeError('Invalid simulation speed');
 const calendar=()=>new Date(epoch+Math.floor(seconds/DAY_S)*DAY_S*1000).toISOString().slice(0,10);
 const timeOfDay=()=>seconds%DAY_S;
 const time=()=>{const value=Math.floor(timeOfDay());return [Math.floor(value/3600),Math.floor(value/60)%60,value%60].map(part=>String(part).padStart(2,'0')).join(':');};
 const instant=()=>epoch-8*3600000+seconds*1000;
 const snapshot=()=>Object.freeze({epochMs:instant(),departureDate:base,departureS:seconds,date:calendar(),time:time(),timeOfDayS:timeOfDay(),revision,playing:running,speed});
 return {get epochMs(){return instant()},get timeS(){return seconds},get baseDate(){return base},get date(){return calendar()},get time(){return time()},get revision(){return revision},get playing(){return running},get speed(){return speed},snapshot,
 seek({date:nextDate,timeS:nextTime}){const nextEpoch=dateEpoch(nextDate);validSeconds(nextTime);if(nextTime>=DAY_S)throw new RangeError('Select a time within the chosen day');epoch=nextEpoch;base=nextDate;seconds=nextTime;running=false;last=null;revision++;const selected=snapshot();onSeek?.(selected);return selected;},
 reset(value){validSeconds(value);seconds=value;last=null;},play(value){running=!!value;last=null;},
 tick(now,active=true){if(!active||!running){last=null;return seconds;}if(last!==null)seconds+=Math.max(0,Math.min(250,now-last))/1000*speed;last=now;return seconds;},
 step(value=60){validSeconds(seconds+value);seconds+=value;last=null;return seconds;}};
}
/** Reuse SVG nodes so animated vehicles do not rebuild hundreds of DOM nodes per second. */
export function renderVehicleMarkers(layer,vehicles,{project,scale,kind='taxi'}={}){
 if(!layer?.ownerDocument?.createElementNS)return;
 const existing=new Map([...layer.children].map(node=>[node.dataset.vehicleId,node]));
 for(const car of vehicles){let node=existing.get(car.id);existing.delete(car.id);const mode=car.mode??kind;
  if(!node){node=layer.ownerDocument.createElementNS('http://www.w3.org/2000/svg','g');node.dataset.vehicleId=car.id;node.innerHTML='<title></title><rect x="-6" y="-10" width="12" height="20" rx="4"/><path d="M-3,-5H3M-3,5H3"/>';layer.appendChild(node);}
  const [x,y]=project(car.position);node.setAttribute('transform',`translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale}) rotate(${Number.isFinite(car.bearing)?car.bearing:0})`);node.setAttribute('class',`na-moving-vehicle ${mode} ${car.state}`);
  const title=`${car.label??car.id} · ${['dwell','dwelling'].includes(car.state)?'停站':car.state==='roaming'?'游走':car.state==='existingorder'?'已有订单':car.state==='pickup'?'接驾':car.state==='passengertrip'?'载客':'运行'} · 模拟`;
  if(node.firstChild.textContent!==title)node.firstChild.textContent=title;
 }
 for(const node of existing.values())node.remove();
}
