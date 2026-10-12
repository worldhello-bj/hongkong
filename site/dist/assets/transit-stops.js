/** Existing timetable stop coordinates only. No realtime or inferred stations. */
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function stopCatalog(services){
 const links=new Map;
 for(const p of services?.patterns??[]){if(!['bus','tram'].includes(p.mode))continue;for(const entry of p.stops??[]){const id=entry.stopId;let list=links.get(id);if(!list)links.set(id,list=[]);if(!list.some(x=>x.mode===p.mode&&x.label===p.label&&x.direction===p.direction))list.push({mode:p.mode,label:p.label,direction:p.direction});}}
 return (services?.stops??[]).filter(s=>links.has(s.id)&&s.coordinates?.slice(0,2).every(Number.isFinite)).map(s=>({...s,name:s.name.split(/<br\s*\/?>|\n/i)[0].replace(/<[^>]*>/g,'').trim(),routes:links.get(s.id),mode:links.get(s.id).some(p=>p.mode==='tram')?'tram':'bus'}));
}
export function layoutStops(stops,view,width,project){
 const scale=view.w/width,cell=44*scale,groups=new Map;
 for(const stop of stops){const [x,y]=project(stop.coordinates);if(x<view.x-cell||x>view.x+view.w+cell||y<view.y-cell||y>view.y+view.h+cell)continue;
 const key=view.w>1500?`${stop.mode}:${Math.floor(x/cell)}:${Math.floor(y/cell)}`:stop.id;
 let g=groups.get(key);if(!g)groups.set(key,g={key,mode:stop.mode,x:0,y:0,stops:[]});g.x+=x;g.y+=y;g.stops.push(stop);}
 return [...groups.values()].map(g=>({...g,x:g.x/g.stops.length,y:g.y/g.stops.length,scale}));
}
export function renderStopMarkers(groups,labels=false){return groups.map((g,index)=>`<g class="na-transit-stop ${g.mode}" data-transit-stop="${index}" role="button" tabindex="0" aria-label="${esc(g.stops.length>1?`${g.stops.length}个${g.mode==='tram'?'电车':'公交'}站，点击展开`:g.stops[0].name)}" transform="translate(${g.x} ${g.y}) scale(${g.scale})"><circle class="na-stop-hit" r="22"/><rect x="-13" y="-13" width="26" height="26" rx="${g.mode==='tram'?4:13}"/><text text-anchor="middle" y="5">${g.stops.length>1?g.stops.length:g.mode==='tram'?'电':'巴'}</text>${labels&&g.stops.length===1&&index<12?`<text class="na-stop-label" x="18" y="4">${esc(g.stops[0].name.slice(0,13))}</text>`:''}<title>${esc(g.stops.map(s=>s.name).join('、'))}</title></g>`).join('');}
export function stopCard(stop,sources={}){return `<button class="na-stop-close" data-stop-close aria-label="关闭站点详情">×</button><small>${stop.mode==='tram'?'电车站':'公交站'} · 已有资料覆盖</small><h3>${esc(stop.name)}</h3><div class="na-stop-lines">${stop.routes.map(p=>`<p><b>${esc(p.label)}</b> ${esc(p.direction)}</p>`).join('')}</div><p class="na-stop-source">来源：<a target="_blank" rel="noreferrer" href="https://static.data.gov.hk/td/pt-headway-sc/stops.txt">运输署站点资料</a> · 线路为当前演示数据，非实时到站</p><div class="na-stop-actions"><button data-stop-side="origin">设为起点</button><button data-stop-side="destination">设为终点</button></div>`;}
export function createTransitStopLayer({map,layer,card,project,onChoose,onExpand}){
 let data,stops=[],groups=[],selected,pending,frame,lastKey='',down;
 map.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY]});
 const activate=e=>{const hit=e.target.closest?.('[data-transit-stop]');if(!hit)return;if(e.type==='keydown'&&!['Enter',' '].includes(e.key))return;if(e.type==='click'&&down&&Math.hypot(e.clientX-down[0],e.clientY-down[1])>8)return;e.preventDefault();e.stopPropagation();const group=groups[Number(hit.dataset.transitStop)];if(!group)return;if(group.stops.length>1){card.hidden=true;onExpand(group.stops.map(s=>s.coordinates));return;}selected=group.stops[0];card.innerHTML=stopCard(selected,data?.sources);card.hidden=false;};
 map.addEventListener('click',activate);map.addEventListener('keydown',activate);
 card.addEventListener('click',e=>{const button=e.target.closest?.('button');if(!button)return;if(button.hasAttribute('data-stop-close'))card.hidden=true;if(button.dataset.stopSide&&selected){card.hidden=true;onChoose(selected,button.dataset.stopSide);}});
 return {render(services,view,width){if(data!==services){data=services;stops=stopCatalog(services);lastKey='';}pending={...view,width};if(frame)return;frame=requestAnimationFrame(()=>{frame=0;const v=pending,key=[v.x,v.y,v.w,v.h,v.width].join(':');if(lastKey===key)return;lastKey=key;groups=layoutStops(stops,v,v.width,project);layer.innerHTML=renderStopMarkers(groups,v.w<1500);});}};
}
