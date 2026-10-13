export const isPacificPlace=point=>point?.namedPlaceId==='pacific-place'||point?.id==='pacific-place';
export function pacificOpeningAdvice(request,date,time,graph){
 if(![request?.origin,request?.destination].some(isPacificPlace))return null;
 const place=graph?.places?.find(p=>p.id==='pacific-place'),schedule=place?.access_schedule;
 if(schedule?.kind!=='daily'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time))return null;
 const seconds=Number(time.slice(0,2))*3600+Number(time.slice(3))*60;
 if(seconds>=86400||Number(time.slice(3))>=60)return null;
 const windows=(schedule.windows??[]).filter(w=>Number.isFinite(w.start_s)&&Number.isFinite(w.end_s)&&w.start_s>=0&&w.end_s<=86400&&w.end_s>w.start_s).sort((a,b)=>a.start_s-b.start_s);
 if(!windows.length||windows.some(w=>seconds>=w.start_s&&seconds<w.end_s))return null;
 const next=windows.find(w=>w.start_s>seconds),day=new Date(date+'T12:00:00Z');if(!Number.isFinite(+day))return null;if(!next)day.setUTCDate(day.getUTCDate()+1);
 const start=(next??windows[0]).start_s,clock=String(Math.floor(start/3600)).padStart(2,'0')+':'+String(Math.floor(start%3600/60)).padStart(2,'0');
 return {date:day.toISOString().slice(0,10),time:clock,selectedTime:time,label:windows.map(w=>`${String(w.start_s/3600).padStart(2,'0')}:00–${String(w.end_s/3600).padStart(2,'0')}:00`).join('、')};
}
export function pacificPlaceControls(request,date,time,graph,escape=String){
 const side=isPacificPlace(request?.origin)?'origin':isPacificPlace(request?.destination)?'destination':null;if(!side)return '';
 const a=pacificOpeningAdvice(request,date,time,graph),e=escape;
 return `<section class="na-place-notice"><button class="na-secondary" data-action="pacific-model" data-mall-target="${side}">太古广场 · 楼层与金钟 F 接点 ↗</button>${a?`<p><b>${e(a.selectedTime)} 不在已载入内部通道的 ${e(a.label)} 时段。</b></p><button class="na-secondary" data-action="pacific-opening">改为 ${e(a.date===date?'当日':a.date)} ${e(a.time)} 并重算</button><details><summary>通道与时段说明</summary><p>这不是整座商场关闭的判断：部分店铺更早营业；F 外侧与 LG1 内部段来源规则不同。可在路线结果明确另选外部接点，原起终点不会自动移动。实际通道开放仍需现场核验。</p></details>`:''}</section>`;
}
export function pacificModelPanel(target='destination'){
 return `<div class="na-panel-heading"><button data-action="close-secondary" aria-label="返回上一页">‹</button><div><small>来源通道 · 示意楼板</small><h1>太古广场 3D</h1></div></div><p class="na-note">查看 LG1、L1–L4 的真实来源通道及金钟 F 接点。楼板是通道包络示意，不是实测店铺边界。</p><div class="na-station-picker" role="group" aria-label="楼层选为哪一端"><button data-mall-target="origin" aria-pressed="${target==='origin'}">选为起点</button><button data-mall-target="destination" aria-pressed="${target!=='origin'}">选为目的地</button></div><p class="na-note">升降机轮椅通行能力未核验时不计为可用能力；缺失连接仍保留，看到模型不表示该层已连通。</p><button class="na-secondary" data-tab="station">查看港铁站体</button>`;
}
