/** A source subset, not new geometry: retain both existing directed edge copies. */
export function projectPacificPlaceGraph(source,physicalIds){
 const allowed=new Set(physicalIds),edges=source.edges.filter(e=>allowed.has(e.physical_id)),nodeIds=new Set(edges.flatMap(e=>[e.from_id,e.to_id]));
 const nodes=source.nodes.filter(n=>nodeIds.has(n.id)),portals=source.portals.filter(p=>nodeIds.has(p.node_id));
 const places=source.places.filter(p=>p.id==='pacific-place').map(p=>({...p,entrance_ids:p.entrance_ids.filter(id=>portals.some(q=>q.id===id)),floors:p.floors.map(f=>({...f,entrance_ids:f.entrance_ids.filter(id=>portals.some(q=>q.id===id))}))}));
 return {...source,scope:'PACIFIC_PLACE_SOURCE_SUBGRAPH_ONLY',version:source.version+':point-source-physical-subset',nodes,edges,portals,places,station_targets:[],detailed_station_access:[],authoritative_physical_ids:[...allowed],closures:(source.closures??[]).map(c=>({...c,physical_ids:c.physical_ids.filter(id=>allowed.has(id))})).filter(c=>c.physical_ids.length)};
}
/** Reconstruct paid journey clocks, including explicit opening waits. */
export function auditTimedSourceRoute(route,request,index,canTraverse){
 if(route.status!=='CONDITIONAL')return {checked:false,reason:'No completed source route',pass:true};
 const toleranceS=.001,legs=[];let clock=request.departureS,waitS=0;
 for(const leg of route.legs??[]){const durationS=(leg.minutes??0)*60,startS=clock,endS=clock+durationS;clock=endS;if(leg.kind==='wait')waitS+=durationS;
  const scheduled=(leg.edge_ids??[]).map(id=>index.edges.get(id)).filter(e=>e?.access_schedule);
  // A merged leg interval is a conservative envelope for each contained scheduled edge.
  const violations=scheduled.filter(e=>!canTraverse(e,startS+toleranceS,Math.max(0,durationS-2*toleranceS),request.departureDate)).map(e=>e.id);
  if(scheduled.length||leg.kind==='wait')legs.push({kind:leg.kind,startS,endS,durationS,scheduledEdgeIds:scheduled.map(e=>e.id),violations});
 }
 const totalArrivalS=request.departureS+route.total_minutes*60,originOpen=canTraverse(request.origin,request.departureS+toleranceS,0,request.departureDate),destinationOpen=canTraverse(request.destination,totalArrivalS+toleranceS,0,request.departureDate),clockSumMatches=Math.abs(clock-totalArrivalS)<.01;
 return {checked:true,departureS:request.departureS,arrivalS:totalArrivalS,legArrivalS:clock,paidWaitS:waitS,originOpen,destinationOpen,clockSumMatches,roundingToleranceS:toleranceS,legs,pass:originOpen&&destinationOpen&&clockSumMatches&&legs.every(l=>l.violations.length===0)};
}
