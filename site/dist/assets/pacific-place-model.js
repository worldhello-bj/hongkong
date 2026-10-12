/** Read-only mall display derived from existing CSDI routes. It never creates route edges. */
export const PACIFIC_PLACE_ID='pacific-place';
export const PACIFIC_PLACE_F_PLACE_ID='pacific-place-f-passage';
export const PACIFIC_PLACE_BUILDING_ID=1103118159;
export const PACIFIC_PLACE_F={id:'ADM:block:pacific-place:F-connection',node_id:'ADM:N:f2f8015eb81bfd',coordinates:[114.16593711,22.27784825,1],physical_ids:['ADM:P:250019051','ADM:P:250019621'],name:'金钟站 F 通道 · 太古广场 LG1 接点'};
const FLOOR_ORDER=['LG1','L1','L2','L3','L4'];
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite3=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
const equal3=(a,b)=>finite3(a)&&finite3(b)&&a.every((n,i)=>Math.abs(n-b[i])<(i===2?.001:1e-8));
const unique=items=>[...new Set(items)];
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
export function pacificPlaceFPortal(graph){
 const node=graph?.nodes?.find(n=>n.id===PACIFIC_PLACE_F.node_id);
 const edges=graph?.edges??[],closed=new Set((graph?.closures??[]).flatMap(c=>c.physical_ids??[]));
 if(!equal3(node?.coordinates,PACIFIC_PLACE_F.coordinates)||!PACIFIC_PLACE_F.physical_ids.every(id=>edges.some(e=>e.physical_id===id&&!e.disabled&&!closed.has(e.physical_id)&&(e.from_id===node.id||e.to_id===node.id))))return null;
 const place=graph.places?.find(p=>p.id===PACIFIC_PLACE_ID);
 return {id:PACIFIC_PLACE_F.id,region_id:'ADM',name:PACIFIC_PLACE_F.name,node_id:node.id,coordinates:[...node.coordinates],source_coordinates:[...node.coordinates],offset_m:0,level:'LG1',level_name:'LG1',source_physical_ids:[...PACIFIC_PLACE_F.physical_ids],source_url:'https://portal.csdi.gov.hk/server/rest/services/common/landsd_rcd_1637222018065_52265/MapServer/0',operator_source_url:'https://www.pacificplace.com.hk/en/locationandparking',evidence:'EXACT_SOURCE_SHARED_ENDPOINT',access_time_id:null,access_schedule:null,warnings:['F 站侧来源段无独立开放时刻记录；不套用商场内部10:00–22:00规则，也不声称全天开放。','来源通道交点，不是实测门扇；到此点不代表已进入商场，实际开放及连续无障碍条件仍需核验。']};
}
export function addPacificPlaceSourceAnchor(graph){
 const portal=pacificPlaceFPortal(graph);
 if(!portal)return graph;
 const hasPortal=graph.portals?.some(p=>p.id===portal.id),hasPlace=graph.places?.some(p=>p.id===PACIFIC_PLACE_F_PLACE_ID);
 const mall=graph.places?.find(p=>p.id===PACIFIC_PLACE_ID);
 if(hasPortal&&hasPlace&&mall?.alternative_place_ids?.includes(PACIFIC_PLACE_F_PLACE_ID))return graph;
 const alternative={id:PACIFIC_PLACE_F_PLACE_ID,name:'太古广场外 · 金钟 F 通道接点',coordinates:[...portal.coordinates],region_id:'ADM',entrance_ids:[portal.id],floors:[],source_url:portal.source_url,detail:'F 站侧已有来源通道交点；到此处不代表进入商场。来源未附独立开放时段，实际开放现场核验。',warnings:[...portal.warnings]};
 const places=(graph.places??[]).map(p=>p.id===PACIFIC_PLACE_ID?{...p,alternative_place_ids:[PACIFIC_PLACE_F_PLACE_ID,...(p.alternative_place_ids??[]).filter(id=>id!==PACIFIC_PLACE_F_PLACE_ID)]}:p);
 if(!hasPlace)places.push(alternative);
 return {...graph,version:graph.version.includes(':pacific-f-anchor-v1')?graph.version:graph.version+':pacific-f-anchor-v1',portals:hasPortal?graph.portals:[...(graph.portals??[]),portal],places};
}
export function buildPacificPlaceModel(graph){
 const place=graph?.places?.find(p=>p.id===PACIFIC_PLACE_ID);
 if(!place)return null;
 const closed=new Set((graph.closures??[]).flatMap(c=>c.physical_ids??[]));
 const seen=new Set();
 const edges=(graph.edges??[]).filter(e=>{
  if(e.building_id!==PACIFIC_PLACE_BUILDING_ID&&!PACIFIC_PLACE_F.physical_ids.includes(e.physical_id))return false;
  if(seen.has(e.physical_id)||e.disabled||closed.has(e.physical_id)||!e.coordinates?.every(finite3))return false;
  seen.add(e.physical_id);return true;
 }).map(e=>({id:e.id,physical_id:e.physical_id,from_id:e.from_id,to_id:e.to_id,kind:e.kind,name:e.name,coordinates:e.coordinates.map(p=>[...p]),floor_id:e.floor_id,floor_name:e.floor_name,source_id:e.source_id,source_url:e.source_url,geometry_mode:e.geometry_mode,accessible_eligible:e.accessible_eligible,wheelchair_barrier:e.wheelchair_barrier,wheelchair_access:e.wheelchair_access,direction:e.direction,duration_s:e.duration_s,length_m:e.length_m,access_schedule:e.access_schedule}));
 const floors=FLOOR_ORDER.flatMap(name=>{
  const floor=place.floors.find(f=>f.name===name);if(!floor)return[];
  const routes=edges.filter(e=>e.floor_name===name),points=routes.flatMap(e=>e.coordinates);if(!points.length)return[];
  const elevation=median(points.map(p=>p[2]));
  const anchors=graph.portals.filter(p=>floor.entrance_ids.includes(p.id));
  return [{id:floor.id,name,elevation,edge_ids:routes.map(e=>e.id),anchor_ids:anchors.map(a=>a.id),points,plate_geometry_mode:'schematic-envelope',coverage:routes.length<4?'partial':'source-routes'}];
 });
 const endpointIds=new Set(edges.flatMap(e=>[e.from_id,e.to_id]));
 const nodes=graph.nodes.filter(n=>endpointIds.has(n.id)).map(n=>({id:n.id,coordinates:[...n.coordinates]}));
 const anchors=graph.portals.filter(p=>place.entrance_ids.includes(p.id)||place.floors.some(f=>f.entrance_ids.includes(p.id))).map(p=>({id:p.id,name:p.name,node_id:p.node_id,coordinates:[...p.coordinates],level:p.level_name??p.level,place_id:PACIFIC_PLACE_ID}));
 const f=pacificPlaceFPortal(graph);if(f)anchors.push(f);
 return {schema_version:'pacific-place-model-v1',id:PACIFIC_PLACE_ID,name:place.name,graph_version:graph.version,center:[114.1651,22.27755],floors,nodes,edges,anchors,f_connection:f,summary:{physicalEdges:edges.length,levels:floors.length,entrances:place.entrance_ids.length,lifts:edges.filter(e=>e.kind==='lift').length,escalators:edges.filter(e=>e.kind==='escalator').length,strictEligibleLifts:edges.filter(e=>e.kind==='lift'&&e.accessible_eligible&&e.wheelchair_barrier!==1).length},sources:{operator:'https://www.pacificplace.com.hk/en/locationandparking',map:'https://www.pacificplace.com.hk/en/directory',mtr:'https://www.mtr.com.hk/archive/en/services/layouts/adm.pdf'},warnings:['楼板轮廓为来源通道的示意包络，不代表可行走面积或实测店铺边界。','通道和设施沿用官方三维坐标；时间为模型估算，运行及无障碍状态未实时核验。','LG1 仅有局部来源通道，LG2 尚无导航节点。不得把缺失通道或未知升降机标成严格可达。']};
}
function hull(points){
 const p=unique(points.map(p=>p.slice(0,2).join(','))).map(p=>p.split(',').map(Number)).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 if(p.length<3)return p;
 const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
 const half=arr=>{const a=[];for(const point of arr){while(a.length>=2&&cross(a.at(-2),a.at(-1),point)<=0)a.pop();a.push(point)}return a.slice(0,-1)};
 return [...half(p),...half([...p].reverse())];
}
const COLORS={walk:'#aaddd6',footbridge:'#aaddd6',ramp:'#aaddd6',escalator:'#fbba64',stairs:'#f57c79',lift:'#b6a2ff'};
/** Static SVG helper is also used by tests and offline verification. */
export function pacificPlaceModelSvg(model,{floor='ALL',angle=-.2,exploded=true,highlight=[]}={}){
 if(!model?.floors?.length)return '<p>太古广场来源模型尚未加载。</p>';
 const selected=model.floors.filter(f=>floor==='ALL'||f.name===floor),activeLevels=new Set(selected.map(f=>f.name));
 const nearest=z=>model.floors.reduce((a,b)=>Math.abs(a.elevation-z)<Math.abs(b.elevation-z)?a:b);
 const project=p=>{const dx=(p[0]-model.center[0])*102900,dy=-(p[1]-model.center[1])*111320,cos=Math.cos(angle),sin=Math.sin(angle),x=dx*cos-dy*sin,y=dx*sin+dy*cos;return [x*2.8,y*1.35-(p[2]-1)*4.5-(exploded?model.floors.indexOf(nearest(p[2]))*35:0)]};
 const records=[];
 for(const f of selected){const outline=hull(f.points).map(p=>[...p,f.elevation]);if(outline.length>=3)records.push({type:'plate',f,points:outline.map(project)});}
 for(const e of model.edges){const levels=unique(e.coordinates.map(p=>nearest(p[2]).name));if(floor!=='ALL'&&!levels.includes(floor))continue;records.push({type:'edge',e,points:e.coordinates.map(project)});}
 const anchors=model.anchors.filter(a=>a.id===PACIFIC_PLACE_F.id||(!a.id.includes(':floor:')&&(!a.level||activeLevels.has(a.level))));
 for(const a of anchors)if(floor==='ALL'||nearest(a.coordinates[2]).name===floor)records.push({type:'anchor',a,points:[project(a.coordinates)]});
 const points=records.flatMap(r=>r.points),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 const minX=Math.min(...xs)-80,minY=Math.min(...ys)-40,width=Math.max(...xs)-minX+140,height=Math.max(...ys)-minY+75;
 const fmt=p=>p.map(v=>v.toFixed(2)).join(','),highlighted=new Set(highlight);
 return `<svg class="pp-model-svg" viewBox="${minX} ${minY} ${width} ${height}" role="img" aria-label="太古广场五层通道和换层设施模型"><title>太古广场来源通道模型：楼板是示意包络，通行以来源路网为准</title>${records.map(r=>r.type==='plate'?`<g><polygon points="${r.points.map(fmt).join(' ')}" fill="#173946" fill-opacity=".55" stroke="#376274" stroke-dasharray="5 4"/><text x="${minX+12}" y="${minY+25+(selected.length-1-selected.indexOf(r.f))*23}" fill="#d7ecef" font-size="14">${esc(r.f.name)} · ${r.f.elevation.toFixed(1)}m${r.f.coverage==='partial'?' 局部':''}</text></g>`:r.type==='edge'?`<polyline points="${r.points.map(fmt).join(' ')}" fill="none" stroke="${highlighted.has(r.e.id)||highlighted.has(r.e.physical_id)?'#fff':COLORS[r.e.kind]??'#aaddd6'}" stroke-width="${['lift','escalator','stairs'].includes(r.e.kind)?4:2.4}" stroke-linecap="round"><title>${esc(r.e.name)} · ${esc(r.e.kind)}${r.e.kind==='lift'&&!r.e.accessible_eligible?' · 严格无障碍条件未核验':''} · ${esc(r.e.physical_id)}</title></polyline>`:`<g><circle cx="${r.points[0][0]}" cy="${r.points[0][1]}" r="${r.a.id===PACIFIC_PLACE_F.id?7:4}" fill="${r.a.id===PACIFIC_PLACE_F.id?'#e65f56':'#f5f2d9'}" stroke="#173946" stroke-width="1.5"/><title>${esc(r.a.name)} · ${esc(r.a.level??'来源高程')}</title>${r.a.id===PACIFIC_PLACE_F.id?`<text x="${r.points[0][0]+11}" y="${r.points[0][1]+5}" fill="#fff" font-size="14">F 通道 / LG1</text>`:''}</g>`).join('')}</svg>`;
}
export function createPacificPlaceModel(container,model,{onSelectFloor,targetLabel='目的地'}={}){
 if(!container||!model)throw Error('Pacific Place model requires a host and loaded source model.');
 let state={floor:'ALL',angle:-.2,exploded:true,highlight:[]},disposed=false,drag;
 const controller=new AbortController();
 function render(){if(disposed)return;container.innerHTML=`<section class="pp-model"><div class="pp-model-toolbar"><label>太古广场 <select data-pp-floor aria-label="选择太古广场楼层"><option value="ALL">全部楼层</option>${model.floors.map(f=>`<option ${state.floor===f.name?'selected':''}>${esc(f.name)}</option>`).join('')}</select></label><button data-pp-action="rotate-left" aria-label="向左旋转">↶</button><button data-pp-action="rotate-right" aria-label="向右旋转">↷</button><button data-pp-action="explode" aria-pressed="${state.exploded}">${state.exploded?'合并楼层':'分层展开'}</button></div><div class="pp-model-canvas">${pacificPlaceModelSvg(model,state)}</div><p class="pp-model-legend">浅绿 通道 · 橙 扶梯 · 紫 升降机 · 红 楼梯 · 白 入口</p><p class="pp-model-note">${model.summary.levels} 层 · ${model.summary.entrances} 个来源入口 · ${model.summary.lifts} 条升降机来源段。${model.summary.strictEligibleLifts===0?'升降机严格无障碍条件待核验。':''}</p><p class="pp-model-note">楼板为示意包络；LG1 仅局部通道，LG2 未建导航节点。拖动旋转，按楼层查看。<a href="${model.sources.map}" target="_blank" rel="noreferrer">商场官方楼层图 ↗</a></p>${state.floor==='ALL'||!onSelectFloor?'':`<button data-pp-action="select-floor">选择太古广场 ${esc(state.floor)} 为${esc(targetLabel==='起点'?'起点':'目的地')}</button>`}</section>`;}
 container.addEventListener('click',event=>{const action=event.target.closest?.('[data-pp-action]')?.dataset.ppAction;if(action==='rotate-left')state.angle-=.25;if(action==='rotate-right')state.angle+=.25;if(action==='explode')state.exploded=!state.exploded;if(action==='select-floor'){onSelectFloor?.(model.floors.find(f=>f.name===state.floor));return}if(action)render();},{signal:controller.signal});
 container.addEventListener('change',event=>{if(event.target.matches?.('[data-pp-floor]')){state.floor=event.target.value;render();}},{signal:controller.signal});
 container.addEventListener('pointerdown',event=>{if(!event.target.closest?.('.pp-model-canvas'))return;drag={x:event.clientX,angle:state.angle};container.setPointerCapture?.(event.pointerId)},{signal:controller.signal});
 container.addEventListener('pointermove',event=>{if(drag){state.angle=drag.angle+(event.clientX-drag.x)/200;render()}},{signal:controller.signal});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])container.addEventListener(type,()=>{drag=null},{signal:controller.signal});
 render();return {resize(){},focusFloor(name){if(name==='ALL'||model.floors.some(f=>f.name===name)){state.floor=name;render()}},focusStep(_geometry,ids=[]){state.highlight=ids;render()},dispose(){disposed=true;controller.abort();container.innerHTML=''}};
}
