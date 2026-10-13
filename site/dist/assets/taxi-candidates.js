import {simulatedTaxiFareCents} from './route-quote.js?v=d13e16e39f47';
import {nearestInterchanges,modeledRoadLink,emptyPublicJourney,composeTaxiJourney} from './taxi-bridge.js?v=d13e16e39f47';
const publicModes=new Set(['metro','rail','bus','tram']);
const coordinate=point=>point.coordinates??point.coordinate;
const distance=(a,b)=>Math.hypot((coordinate(a)[0]-coordinate(b)[0])*102900,(coordinate(a)[1]-coordinate(b)[1])*111320);
/** Rail exits plus direction-aware real bus/tram stops. No invented transfer point.
 * The shortlist limits combinations, not search time or user-visible routing coverage.
 */
export function taxiInterchangeCandidates({station,services,request,side,limits={metro:2,bus:1,tram:1}}){
 const endpoint=side==='first'?request.origin:request.destination,other=side==='first'?request.destination:request.origin;
 const tripDistance=distance(endpoint,other),stops=new Map((services.stops??[]).map(stop=>[stop.id,stop]));
 const entries=nearestInterchanges(station,endpoint,100).map(point=>({...point,mode:'metro'}));
 const surface=new Map();
 for(const pattern of services.patterns??[]){
  if(!['bus','tram'].includes(pattern.mode))continue;
  const ordered=pattern.stops.map(row=>{const stop=stops.get(row.stopId);return stop?{...stop,offsetS:row.arrivalOffsetS??row.departureOffsetS}:null;}).filter(Boolean);
  for(let index=0;index<ordered.length;index++){
   const stop=ordered[index],next=side==='first'?ordered.slice(index+1):ordered.slice(0,index);
   // Consider the whole directed service: the nearest stop may leave a long bus loop.
   const onward=next.filter(point=>distance(point,other)+100<distance(stop,other));
   if(!onward.length)continue;
   const rideAndAccess=Math.min(...onward.map(point=>{
    const ride=Number.isFinite(stop.offsetS)&&Number.isFinite(point.offsetS)?Math.abs(point.offsetS-stop.offsetS)/60:distance(stop,point)/300;
    return ride+distance(point,other)/72;
   }));
   const feeder=distance(stop,endpoint),estimatedRoadMeters=feeder*1.25;
   const selectionScore=estimatedRoadMeters/420+simulatedTaxiFareCents({distanceM:estimatedRoadMeters})/100*.75+rideAndAccess;
   const key=pattern.mode+':'+stop.id,previous=surface.get(key);
   if(!previous||selectionScore<previous.selectionScore)surface.set(key,{...stop,lon:stop.coordinates[0],lat:stop.coordinates[1],mode:pattern.mode,region:stop.id,selectionScore});
  }
 }
 entries.push(...surface.values());
 const ranked=entries.filter(point=>{
  const feeder=distance(point,endpoint),onward=distance(point,other);
  return feeder>=180&&feeder<=Math.min(6500,tripDistance*.9+600)&&onward>250&&feeder+onward<=Math.max(1800,tripDistance*1.7);
 }).map(point=>({...point,distanceM:distance(point,endpoint),selectionScore:point.selectionScore??distance(point,endpoint)/420+distance(point,other)/600})).sort((a,b)=>a.selectionScore-b.selectionScore||a.id.localeCompare(b.id));
 const chosen=[];
 for(const mode of ['metro','bus','tram']){
  const group=[];for(const point of ranked.filter(point=>point.mode===mode)){
   if(group.some(previous=>distance(previous,point)<250))continue;
   group.push(point);if(group.length>=(limits[mode]??0))break;
  }chosen.push(...group);
 }
 return chosen;
}
export function taxiJourneyTitle(result,side){
 const modes=[...new Set(result.segments.filter(segment=>publicModes.has(segment.kind)).map(segment=>({rail:'地铁',metro:'地铁',bus:'公交',tram:'电车'}[segment.kind])))].join(' + ');
 return side==='first'?`出租车首程 + ${modes}`:`${modes} + 出租车末程`;
}
export async function planTaxiCandidates({request,station,services,graph,findRoad,ask,publicRoute,publish,isCurrent=()=>true,isLinkAllowed=()=>true,onDiagnostic=()=>{}}){
 const originRoad=findRoad(request.origin),destinationRoad=findRoad(request.destination);
 if(!originRoad||!destinationRoad)return {status:'outside-road-coverage',published:0};
 const disclosure='演示数据：车辆、订单、票价与接驳时间为模拟，路线沿公开路网生成。';
 const sceneFor=(pickup,destination,name)=>({pickup,destination:{...destination,name},disclaimer:disclosure});
 const makeLink=(point,road)=>{const link=modeledRoadLink(point,road);return isLinkAllowed(coordinate(point),coordinate(road))?link:null;};
 const directPickup=makeLink(request.origin,originRoad),directDropoff=makeLink(request.destination,destinationRoad);
 if(!directPickup||!directDropoff)return {status:'unsafe-road-connector',published:0};
 let published=0;
 const emit=(id,title,result,kind)=>{if(!isCurrent())return;result.taxiCandidateKind=kind;publish(id,title,result);published++;};
 const directQuote=ask(originRoad,destinationRoad,request.departureS+directPickup.durationS);
 if(directQuote)emit('taxi-direct',directQuote.harbourTunnel?'出租车直达 · 经海底隧道':'出租车直达',composeTaxiJourney({request,quote:directQuote,pickupLink:directPickup,dropoffLink:directDropoff,scene:sceneFor(originRoad,destinationRoad,request.destination.name),graph}),'direct');
 const candidates={last:taxiInterchangeCandidates({station,services,request,side:'last'}),first:taxiInterchangeCandidates({station,services,request,side:'first'})};
 for(const side of ['last','first'])for(const interchange of candidates[side]){
  if(!isCurrent())return {status:'cancelled',published};
  const road=findRoad(interchange),link=road&&makeLink(interchange,road);if(!link)continue;
  try{
   let prefix,suffix,quote;
   if(side==='last'){
    prefix=await publicRoute(request.origin,interchange,request.departureS,interchange.mode);
    if(!isCurrent())return {status:'cancelled',published};
    if(!prefix?.journey?.complete||!prefix.segments?.some(segment=>publicModes.has(segment.kind)))continue;
    quote=ask(road,destinationRoad,(prefix.arrivalS??request.departureS+prefix.totalMinutes*60)+link.durationS);
   }else{
    quote=ask(originRoad,road,request.departureS+directPickup.durationS);
    if(quote)suffix=await publicRoute(interchange,request.destination,quote.dropoffS+link.durationS,interchange.mode);
    if(!isCurrent())return {status:'cancelled',published};
    if(!suffix?.journey?.complete||!suffix.segments?.some(segment=>publicModes.has(segment.kind)))continue;
   }
   if(!quote)continue;
   // Reject loops where the supposed feeder drives farther than the entire direct road trip.
   if(directQuote&&quote.passengerRoute.lengthM>=directQuote.passengerRoute.lengthM*.95){onDiagnostic({side,id:interchange.id,status:'not-a-shorter-feeder'});continue;}
   const result=composeTaxiJourney({request,prefix:prefix??emptyPublicJourney(graph,request.departureS),suffix,quote,
    pickupLink:side==='last'?link:directPickup,dropoffLink:side==='last'?directDropoff:link,
    scene:side==='last'?sceneFor(road,destinationRoad,request.destination.name):sceneFor(originRoad,road,interchange.name),graph});
   result.transferAnchor={id:interchange.id,name:interchange.name,mode:interchange.mode,coordinates:interchange.coordinates};
   emit('taxi-'+side+'-'+interchange.mode+'-'+interchange.id,taxiJourneyTitle(result,side),result,side);
   onDiagnostic({side,id:interchange.id,status:'ready',minutes:result.totalMinutes});
  }catch(error){if(!isCurrent())return {status:'cancelled',published};onDiagnostic({side,id:interchange.id,status:'error',message:error.message});}
 }
 return {status:published?'ready':'no-road-route',published};
}
