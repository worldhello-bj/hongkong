/** Source-backed alternatives never silently replace the user's selected endpoint. */
export function stationEntranceCandidates(request,graph,manifest){
 if(!manifest||manifest.station_graph_version!==graph.version)return [];
 const profile=request.need==='ordinary'?'ordinary':'lift',out=[];
 for(const side of ['origin','destination']){
  const point=request[side],portal=graph.portals.find(p=>p.id===point.id&&p.node_id===point.node_id);
  if(!portal?.id.includes(':portal:'))continue;
  const other=request[side==='origin'?'destination':'origin'];
  const target=Object.entries(graph.station_targets?.[portal.station_id]??{}).find(([,t])=>t.node_id===other.node_id)?.[0];
  const rows=manifest.entries.filter(row=>row.portal_id===portal.id&&row.profile===profile&&(!target||row.target===target)&&!(side==='origin'?row.entry_to_target:row.target_to_entry));
  const choices=new Map();
  for(const row of rows)for(const candidate of row.alternatives){
   const p=graph.portals.find(p=>p.id===candidate.portal_id&&p.node_id===candidate.node_id);if(!p||p.id===portal.id)continue;
   choices.set(p.id,{id:side+':'+p.id,side,original:point,place:{...p,lon:p.coordinates[0],lat:p.coordinates[1]},separationM:candidate.straight_line_separation_m});
  }
  out.push(...[...choices.values()].sort((a,b)=>Number(b.place.facility_kind==='lift')-Number(a.place.facility_kind==='lift')||a.separationM-b.separationM).slice(0,2));
 }
 return out;
}
export function isVerifiedExactConnector(result,origin,destination){
 if(!result?.journey?.complete||result.scenarioOnly||result.simulationOnly||!origin.node_id||!destination.node_id)return false;
 const graph=result.journey.graph,edges=new Map(graph?.edges?.map(e=>[e.id,e])??[]);
 let cursor=origin.node_id,count=0,lastId;
 for(const step of result.journey.steps??[]){
  const guide=step.guidance;if(step.blocked||!guide||guide.geometry_mode!=='official'||!guide.edge_ids?.length)return false;
  for(const id of guide.edge_ids){if(id===lastId)continue;const e=edges.get(id);if(!e||e.from_id!==cursor||e.disabled||e.geometry_mode!=='official'||e.kind==='access_connector')return false;cursor=e.to_id;lastId=id;count++;}
 }
 return count>0&&cursor===destination.node_id;
}
const elapsed=result=>Number.isFinite(result.arrivalS)&&Number.isFinite(result.departureS)?(result.arrivalS-result.departureS)/60:result.journey?.knownMinutes??result.totalMinutes??0;
export function composeStationDetour(request,option,connector,alternate){
 const parts=option.side==='origin'?[connector,alternate]:[alternate,connector],phases=[],steps=[],lines=[],segments=[];
 const nodeMap=new Map(),edgeMap=new Map();
 for(const part of parts){
  const offset=phases.length;phases.push(...part.journey.phases);
  for(const step of part.journey.steps)steps.push({...step,id:'station-detour:'+steps.length,phase:step.phase+offset,guidance:{...step.guidance}});
  lines.push(...part.lines??[]);segments.push(...part.segments??[]);
  for(const n of part.journey.graph?.nodes??[])nodeMap.set(n.id,n);
  for(const e of part.journey.graph?.edges??[])edgeMap.set(e.id,e);
 }
 const minutes=parts.reduce((sum,p)=>sum+elapsed(p),0),connectorMinutes=elapsed(connector);
 return {...alternate,resolvedEndpoints:undefined,routedEndpoints:{origin:request.origin.coordinates,destination:request.destination.coordinates},stationDetour:{side:option.side,via:option.place.name,minutes:connectorMinutes},
  totalMinutes:Math.ceil(minutes),departureS:request.departureS,arrivalS:request.departureS+minutes*60,
  walkMinutes:(alternate.walkMinutes??0)+(connector.walkMinutes??connectorMinutes),lines,segments,
  message:`保留原${option.side==='origin'?'起点':'终点'}，沿已收录路径经 ${option.place.name} 绕行；接驳约 ${Math.ceil(connectorMinutes)} 分钟，已计入全程。`,
  warnings:[...new Set([...connector.warnings??[],...alternate.warnings??[],'升降机运行未实时核验，请以现场指示为准。'])],
  journey:{...alternate.journey,title:request.origin.name+' → '+request.destination.name,destination:request.destination.name,phases,steps,knownMinutes:minutes,complete:true,graph:{...alternate.journey.graph,nodes:[...nodeMap.values()],edges:[...edgeMap.values()]}}};
}
export async function evaluateStationEntrances({request,graph,manifest,plan,isStale=()=>false,onOption=()=>{},onDetour=()=>{}}){
 const options=[];
 for(const candidate of stationEntranceCandidates(request,graph,manifest)){
  if(isStale())break;
  const side=candidate.side,place=candidate.place;
  const mode=request.origin.id.split(':')[0]===request.destination.id.split(':')[0]?'walk':request.mode;
  let connector,alternate;
  try{
   if(side==='origin'){
    connector=await plan({...request,mode:'walk',destination:place});if(isStale())break;
    const verified=isVerifiedExactConnector(connector,request.origin,place);
    alternate=await plan({...request,mode,origin:place,departureS:request.departureS+(verified?elapsed(connector)*60:0)});
   }else{
    alternate=await plan({...request,mode,destination:place});if(isStale())break;
    connector=await plan({...request,mode:'walk',origin:place,departureS:alternate.journey?.complete?request.departureS+elapsed(alternate)*60:request.departureS});
   }
  }catch(error){if(isStale()||error.name==='AbortError')break;}
  if(isStale())break;
  const verified=isVerifiedExactConnector(connector,side==='origin'?request.origin:place,side==='origin'?place:request.destination);
  if(verified&&alternate?.journey?.complete){onDetour(composeStationDetour(request,candidate,connector,alternate));continue;}
  const option={...candidate,connectorVerified:false,routeReady:!!alternate?.journey?.complete,minutes:alternate?.journey?.complete?alternate.totalMinutes:undefined};
  options.push(option);onOption(option);
 }
 return options;
}
export function applyStationEntranceChoice(request,option){
 const current=request[option.side];
 if(!current||current.id!==option.original.id||current.node_id!==option.original.node_id||JSON.stringify(current.coordinates)!==JSON.stringify(option.original.coordinates))return null;
 return {...request,[option.side]:option.place};
}
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function stationEntrancePanel(options,loading=false){
 if(!options.length&&!loading)return '';
 return `<section class="na-station-alternatives" aria-label="可选车站入口"><h2>可选车站入口 · 接驳待核验</h2><p>原起终点保持不变。到以下入口的街面接驳尚未核验，不计作已完成绕行；你可以明确改选入口后重新计算。</p>${options.map(option=>`<div class="na-station-alternative"><b>${escape(option.place.name)}</b><p>${option.routeReady?`改用该${option.side==='origin'?'起点':'终点'}后的替代行程约 ${Math.ceil(option.minutes)} 分钟；不含原入口之间的未核验接驳。`:'此入口的站内连接有来源支持；改选后仍需重新计算完整行程。'}</p><button class="na-secondary" data-station-entrance-choice="${escape(option.id)}">将${option.side==='origin'?'起点':'终点'}改为 ${escape(option.place.name)} 并重算</button></div>`).join('')}${loading?'<p class="na-note">正在核对可选入口和接驳路径…</p>':''}</section>`;
}
/** Label an already-complete exact route that physically visits an alternative entry. */
export function annotateStationDetour(request,result,graph,manifest){
 if(!result?.journey?.complete||result.stationDetour)return result;
 const network=result.journey.graph,edges=new Map(network?.edges?.map(e=>[e.id,e])??[]),chain=[];let last;
 for(const step of result.journey.steps??[])for(const id of step.guidance?.edge_ids??[]){if(id!==last){const edge=edges.get(id);if(edge)chain.push(edge);last=id;}}
 if(!chain.length)return result;
 const options=stationEntranceCandidates(request,graph,manifest);
 for(const option of options){
  const index=chain.findIndex(edge=>edge.to_id===option.place.node_id||edge.from_id===option.place.node_id);if(index<0)continue;
  const portion=option.side==='origin'?chain.slice(0,index+(chain[index].to_id===option.place.node_id?1:0)):chain.slice(index+(chain[index].to_id===option.place.node_id?1:0));
  if(!portion.length||portion.some(edge=>edge.geometry_mode!=='official'||edge.disabled||edge.kind==='access_connector'))continue;
  const minutes=portion.reduce((sum,edge)=>sum+(edge.duration_s??0),0)/60;
  return {...result,stationDetour:{side:option.side,via:option.place.name,minutes},message:`保留原${option.side==='origin'?'起点':'终点'}，沿已收录路径经 ${option.place.name} 绕行；入口接驳约 ${Math.ceil(minutes)} 分钟，已计入全程。 ${result.message}`};
 }
 // Through-routes can pass a lobby junction beside a leaf entrance amenity.
 // Label the actual traversed lift, never invent a visit to that nearby point.
 if(options.length&&isVerifiedExactConnector(result,request.origin,request.destination)){
  for(const side of [...new Set(options.map(option=>option.side))]){
   const index=side==='origin'?chain.findIndex(edge=>edge.kind==='lift'):chain.findLastIndex(edge=>edge.kind==='lift');
   if(index<0)continue;
   const portion=side==='origin'?chain.slice(0,index):chain.slice(index+1);
   if(!portion.some(edge=>edge.source_id==='CSDI-PEDESTRIAN'))continue;
   const minutes=portion.reduce((sum,edge)=>sum+(edge.duration_s??0),0)/60;
   return {...result,stationDetour:{side,via:chain[index].name,minutes},message:`保留原${side==='origin'?'起点':'终点'}，沿已收录街面通道经 ${chain[index].name} 绕行；街面接驳约 ${Math.ceil(minutes)} 分钟，已计入全程。 ${result.message}`};
  }
 }
 return result;
}
