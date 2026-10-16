// Read-only inspection of existing physical source edges, never new route links.
const kinds=Object.freeze({lift:'升降机',escalator:'扶梯',stairs:'楼梯',ramp:'坡道',stairlift:'楼梯升降平台',travelator:'自动步道'});
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const elevation=z=>`${Number(z.toFixed(2))} m`;
export function stationSourceConnectors(graph,station){
  const seen=new Set(),items=[];
  for(const edge of graph?.edges??[]){
    if(edge.region_id!==station||edge.source_id!=='CSDI-INDOOR'||edge.geometry_mode!=='official'||edge.disabled||!Object.hasOwn(kinds,edge.kind))continue;
    const points=edge.coordinates;
    if(!Array.isArray(points)||points.length<2||!points.every(p=>Array.isArray(p)&&p.length>=3&&p.slice(0,3).every(Number.isFinite)))continue;
    const from=points[0][2],to=points.at(-1)[2],id=edge.physical_id??edge.id;
    if(Math.abs(to-from)<.4||seen.has(id))continue;
    seen.add(id);items.push({id:edge.id,physicalId:id,station,kind:edge.kind,label:kinds[edge.kind],from,to,edge});
  }
  return items.sort((a,b)=>a.from-b.from||a.to-b.to||a.label.localeCompare(b.label)||a.id.localeCompare(b.id));
}
export function sourceConnectorPanel(graph,station,selection={}){
  const all=stationSourceConnectors(graph,station);if(!all.length)return '';
  const requestedFloor=Number(selection.floor),floor=selection.floor!==undefined&&selection.floor!=='all'&&Number.isFinite(requestedFloor)?requestedFloor:null;
  const filter=Object.hasOwn(kinds,selection.kind)?selection.kind:'all';
  const elevations=[...new Set(all.flatMap(item=>[item.from,item.to]))].sort((a,b)=>a-b);
  const items=all.filter(item=>(filter==='all'||filter===item.kind)&&(floor===null||Math.abs(item.from-floor)<.01||Math.abs(item.to-floor)<.01));
  const selected=items.find(item=>item.id===selection.edgeId)??items[0];
  return `<section class="na-source-connectors" aria-label="来源换层设施" data-source-station="${escape(station)}"><h2>查看换层设施</h2><p class="na-note">${all.length} 段官方 XYZ 换层线。按来源高程筛选，再在 3D 中查看原始位置。设施分段数量不等于设备台数。</p><div class="na-source-filters"><label>来源高程<select data-source-control="floor"><option value="all"${floor===null?' selected':''}>全部高程</option>${elevations.map(z=>`<option value="${z}"${floor===z?' selected':''}>${elevation(z)}</option>`).join('')}</select></label><label>设施<select data-source-control="kind"><option value="all"${filter==='all'?' selected':''}>全部设施</option>${Object.entries(kinds).filter(([kind])=>all.some(item=>item.kind===kind)).map(([kind,label])=>`<option value="${kind}"${kind===filter?' selected':''}>${label}</option>`).join('')}</select></label></div><label>来源路段<select data-source-control="edge"${items.length?'':' disabled'}>${items.length?items.map(item=>`<option value="${escape(item.id)}"${item===selected?' selected':''}>${item.label} · ${elevation(item.from)} → ${elevation(item.to)} · ${escape(item.id.split(':').at(-1))}</option>`).join(''):'<option>当前筛选无来源换层路段</option>'}</select></label><button class="na-secondary" data-action="inspect-source-connector"${selected?'':' disabled'}>在 3D 中查看此段</button><p class="na-source-selection" role="status">${selection.focusedId&&selection.focusedId===selected?.id?`已高亮 ${escape(selected.id)} · ${elevation(selected.from)} → ${elevation(selected.to)}`:'仅查看来源几何；不会设置行程或建立新的通行连接。'}</p><p class="na-note">米数为来源高程，不是楼层编号或层高。当前开放状态、完整接续及无障碍条件未核验；上下箭头只描述该记录坐标顺序。</p></section>`;
}
export function inspectSourceConnector(graph,station,edgeId,model){
  const item=stationSourceConnectors(graph,station).find(item=>item.id===edgeId);
  if(!item||typeof model?.focusSourceEdge!=='function')return false;
  return model.focusSourceEdge(item.id)===true;
}

export function renderSourceConnectorHost(host,graph,station,selection){
  if(!host)return;
  const active=host.ownerDocument?.activeElement;
  const owned=active&&host.contains?.(active);
  const control=owned&&active.dataset?.sourceControl;
  const inspect=owned&&active.dataset?.action==='inspect-source-connector';
  const selector=['floor','kind','edge'].includes(control)?`[data-source-control="${control}"]`:inspect?'[data-action="inspect-source-connector"]':null;
  host.innerHTML=sourceConnectorPanel(graph,station,selection);
  if(selector){
    const target=host.querySelector(selector);
    // An empty filter may disable the segment/button. Keep keyboard users on
    // the still-usable filter rather than dropping focus to the document body.
    const focus=target&&!target.disabled?target:host.querySelector('[data-source-control="floor"]');
    focus?.focus?.({preventScroll:true});
  }
}
