/** Passenger planning boundary. Road simulation and pedestrian evidence stay separate. */
export function nearestPedestrianNode(graph, coordinate) {
  const walkNodes = new Set(graph.edges.filter(edge => edge.geometry_mode === 'official' &&
    !['rail','station_access','transfer'].includes(edge.kind)).flatMap(edge=>[edge.from_id,edge.to_id]));
  let best, distanceM=Infinity;
  for (const node of graph.nodes) {
    if (!walkNodes.has(node.id)) continue;
    const d=Math.hypot((node.coordinates[0]-coordinate[0])*102900,(node.coordinates[1]-coordinate[1])*111320);
    if(d<distanceM){best=node;distanceM=d;}
  }
  if (!best || distanceM>50) return null;
  return {node:best,distanceM,point:{id:best.id,node_id:best.id,name:'已建模人行道接续点',
    coordinates:best.coordinates,lon:best.coordinates[0],lat:best.coordinates[1]}};
}
export function composeTaxiJourney({request,prefix,suffix,quote,pickupLink,dropoffLink,scene,graph}) {
  prefix??=emptyPublicJourney(graph,request.departureS);
  const phases=[],steps=[],lines=[],segments=[];
  const append = result => {
    if(!result)return;
    const offset=phases.length;
    phases.push(...result.journey.phases);
    steps.push(...result.journey.steps.map(step=>({...step,phase:step.phase+offset})));
    lines.push(...result.lines);segments.push(...result.segments);
  };
  const add=(kind,label,minutes,coordinates,extra={})=>{
    const phase=phases.length; phases.push(label);
    const id='taxi-bridge:'+phase;
    steps.push({id,phase,phaseLabel:label,target:label,kind,context:'按顺序接续下一程',
      guidance:{id,type:'overview',maneuver:'overview',instruction:label,label,leg_index:phase,minutes,
        edge_ids:[],geometry_mode:'schematic',...(coordinates?{geometry:{type:'LineString',coordinates}}:{})}});
    segments.push({kind,label,minutes,distanceM:extra.distanceM??0,official:false,...extra});
    if(coordinates)lines.push({label,kind,coordinates,official:false});
  };
  append(prefix);
  add('walk',`步行 ${Math.ceil(pickupLink.distanceM)} 米到预约上客点`,pickupLink.durationS/60,
    pickupLink.geometry??[pickupLink.node.coordinates.slice(0,2),scene.pickup.coordinate],{distanceM:pickupLink.distanceM});
  if(quote.passengerWaitS>0)add('wait',`等待 ${quote.carId} · ${Math.ceil(quote.passengerWaitS/60)} 分钟`,quote.passengerWaitS/60);
  add('taxi',`乘出租车 ${quote.carId} 前往 ${scene.destination.name??request.destination.name}${quote.harbourTunnel?"（经海底隧道）":""}`,quote.passengerRoute.durationS/60,
    quote.passengerRoute.geometry,{distanceM:quote.passengerRoute.lengthM,harbourTunnel:!!quote.harbourTunnel});
  for(const coordinates of quote.tunnelPaths??[])lines.push({label:"道路隧道",kind:"taxi-tunnel",coordinates,official:false});
  if(dropoffLink){
    add('walk',`步行 ${Math.ceil(dropoffLink.distanceM)} 米${suffix?"接续下一程":"到"+request.destination.name}`,dropoffLink.durationS/60,
      [scene.destination.coordinate,dropoffLink.node.coordinates.slice(0,2)],{distanceM:dropoffLink.distanceM});
    append(suffix);
  }
  const totalMinutes=(quote.dropoffS-request.departureS)/60+(dropoffLink?.durationS??0)/60+(suffix?.totalMinutes??0);
  const warnings=[...prefix.warnings,...suffix?.warnings??[],scene.disclaimer,
    '路缘连接显示为虚线模型：上客侧人行节点来源高度 '+(pickupLink.node.coordinates[2]??'未知')+' 米；车行侧高程与实际高差未核验。',
    '出租车行驶沿 OpenStreetMap 有向道路；车速、既有订单、候车均为演示数据，不是实时调度。',
    '本方案含未核验路缘连接，只可用于接续情景演练，不保证现实全程可通行或无障碍。'];
  if(suffix)warnings.push('落客侧人行节点来源高度 '+(dropoffLink.node.coordinates[2]??'未知')+' 米；与车行落客点的实际垂直连接未核验。');
  return {scenarioOnly:true,simulationOnly:true,taxiQuote:quote,totalMinutes:Math.ceil(totalMinutes),
    departureS:request.departureS,arrivalS:request.departureS+totalMinutes*60,
    walkMinutes:Math.ceil(prefix.walkMinutes+pickupLink.durationS/60+(suffix?.walkMinutes??0)+(dropoffLink?.durationS??0)/60),
    transfers:Math.max(0,segments.filter(segment=>["rail","metro","bus","tram","taxi"].includes(segment.kind)).length-1),message:'按到达时间接车，继续前往目的地',
    metric:Math.ceil(totalMinutes)+' 分钟 · 情景估算',warnings,segments,lines,
    waitMinutes:(prefix.waitMinutes??prefix.segments.filter(s=>s.kind==='wait').reduce((n,s)=>n+(s.minutes??0),0))+(suffix?.waitMinutes??suffix?.segments?.filter(s=>s.kind==='wait').reduce((n,s)=>n+(s.minutes??0),0)??0)+quote.passengerWaitS/60,
    journey:{title:request.origin.name+' → '+request.destination.name,destination:request.destination.name,
      phases,steps,graph:prefix.journey.graph??graph,knownMinutes:totalMinutes,complete:true}};
}

const roadNodeCache=new WeakMap();
export function nearestRoadPoint(roadGraph,point,maxDistanceM=650){
  let entries=roadNodeCache.get(roadGraph);
  if(!entries){entries=Object.entries(roadGraph.nodes);roadNodeCache.set(roadGraph,entries);}
  const coordinate=point.coordinates??point.coordinate??point;
  let best,distanceM=Infinity;
  for(const [id,c] of entries){const d=Math.hypot((c[0]-coordinate[0])*102900,(c[1]-coordinate[1])*111320);if(d<distanceM){best={id,coordinate:c};distanceM=d;}}
  return best&&distanceM<=maxDistanceM?{...best,distanceM}:null;
}
export function modeledRoadLink(point,roadPoint){
  const coordinate=(point.coordinates??point.coordinate).slice(0,2);
  const distanceM=Math.hypot((coordinate[0]-roadPoint.coordinate[0])*102900,(coordinate[1]-roadPoint.coordinate[1])*111320);
  return {node:{id:point.node_id??point.id,coordinates:point.coordinates??point.coordinate},point,distanceM,
    durationS:distanceM<1?0:Math.max(15,distanceM/1.2),geometry:[coordinate,roadPoint.coordinate],evidence:'demo-connector'};
}
export function nearestInterchanges(stationGraph,point,limit=2){
  const coordinate=point.coordinates??point.coordinate;
  const preferred={ADM:'ADM:portal:E2',AUS:'AUS:portal:B2'};
  const bestByRegion=new Map();
  for(const portal of stationGraph.portals??[]){
    if(!portal.id.includes(':portal:')||portal.id.endsWith('-lift'))continue;
    const distanceM=Math.hypot((coordinate[0]-portal.coordinates[0])*102900,(coordinate[1]-portal.coordinates[1])*111320);
    const previous=bestByRegion.get(portal.region_id);
    const isPreferred=preferred[portal.region_id]===portal.id;
    if(!previous||isPreferred||(!previous.preferred&&distanceM<previous.distanceM))bestByRegion.set(portal.region_id,{portal,distanceM,preferred:isPreferred});
  }
  return [...bestByRegion.values()].sort((a,b)=>a.distanceM-b.distanceM).slice(0,limit).map(({portal,distanceM})=>({
    id:portal.id,node_id:portal.node_id,name:portal.name,coordinates:portal.coordinates,lon:portal.coordinates[0],lat:portal.coordinates[1],distanceM,region:portal.region_id}));
}
export function emptyPublicJourney(graph,departureS){return {totalMinutes:0,walkMinutes:0,transfers:0,arrivalS:departureS,warnings:[],lines:[],segments:[],journey:{phases:[],steps:[],graph,complete:true}};}
