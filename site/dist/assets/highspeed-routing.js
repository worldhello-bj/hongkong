import {planHighSpeedLeg} from './highspeed-service.js?v=80559fd92aa0';
const WEK='HSR:WEK',FUT='HSR:FUT',TRANSFER_S=600;
export const handlesHighSpeedRequest=request=>[request?.origin,request?.destination].some(point=>[WEK,FUT].includes(point?.id));
const unavailable=message=>({highSpeed:true,scenarioOnly:true,message,warnings:[message],lines:[],segments:[],failureStatus:'NO_ROUTE'});
const cancelled=signal=>{if(signal?.aborted)throw new DOMException('Aborted','AbortError');};
/** Reuse the ordinary planner's overlay and progressive-detail acceptance gates. */
export async function planHighSpeedLocalConnection({request,fastPlan,detailedPlan,isCompatible,requiresDetail,detailReady,signal}){
 cancelled(signal);let result=await fastPlan(request);cancelled(signal);
 if(!result?.journey?.complete||!isCompatible(result)){result=await detailedPlan(request);cancelled(signal);}
 if(result?.journey?.complete&&!detailReady&&requiresDetail(request,result))return {...result,journey:{...result.journey,complete:false},pendingDetail:true,message:'高铁的香港侧接续需要站内细图；加载后重新计算，当前不作为完整行程。'};
 return result;
}
/** A real local subroute plus an explicitly modeled station transfer, never invented C-exit geometry. */
export async function planHighSpeedJourney({request,anchor,planLocal,graph,signal}){
 cancelled(signal);
 if(!handlesHighSpeedRequest(request))return unavailable('此示范仅连接香港西九龙、深圳福田及香港侧已覆盖地点。');
 const from=request.origin,to=request.destination,start=request.departureS;
 if(!Number.isFinite(start)||start<0)throw new RangeError('Invalid departure time');
 if(from.id===to.id)return unavailable('起点与终点相同，无需乘车。');
 const fromRail=[WEK,FUT].includes(from.id),toRail=[WEK,FUT].includes(to.id);
 if((!fromRail||!toRail)&&(!anchor?.node_id||!planLocal))return unavailable('柯士甸的已核验月台接续节点尚未加载，不能补画接驳路线。');
 const phases=[],steps=[],lines=[],segments=[],timedLegs=[],warnings=[],resolvedEndpoints=[];let now=start,walkMinutes=0,waitMinutes=0,processingMinutes=0,trip,localGraph=graph,usedTransfer=false;
 const appendLocal=async(origin,destination,outerSide)=>{
  cancelled(signal);const part=await planLocal({...request,origin,destination,departureS:now,mode:'transit'});cancelled(signal);
  if(!part?.journey?.complete||!Number.isFinite(part.totalMinutes))return part;
  const offset=phases.length;phases.push(...part.journey.phases);steps.push(...part.journey.steps.map(step=>({...step,phase:step.phase+offset})));lines.push(...(part.lines??[]));segments.push(...(part.segments??[]));timedLegs.push(...(part.timedLegs??[]));warnings.push(...(part.warnings??[]));localGraph=part.journey.graph??localGraph;resolvedEndpoints.push(...(part.resolvedEndpoints??[]).filter(endpoint=>endpoint.side===outerSide).map(endpoint=>({...endpoint,coordinates:endpoint.coordinates?.slice()})));
  walkMinutes+=part.walkMinutes??0;waitMinutes+=part.waitMinutes??0;
  now=Number.isFinite(part.arrivalS)&&part.arrivalS>=now?part.arrivalS:now+part.totalMinutes*60;return true;
 };
 const add=(kind,label,startS,endS,coordinates,extra={})=>{
  if(endS<startS||!Number.isFinite(startS)||!Number.isFinite(endS))throw new RangeError('Invalid high-speed timeline');
  const phase=phases.length,id='hsr-journey:'+phase,minutes=(endS-startS)/60;
  phases.push(label);steps.push({id,phase,phaseLabel:label,target:label,kind,context:extra.context??'跨境高铁情景演练，依现场标志通行',highSpeedProcedure:extra.procedure,
   guidance:{id,type:'overview',maneuver:'overview',instruction:label,label,leg_index:phase,minutes,edge_ids:[],geometry_mode:coordinates?'schematic':'none',...(coordinates?{geometry:{type:'LineString',coordinates}}:{})}});
  segments.push({kind,label,minutes,distanceM:0,official:false,...extra});
  timedLegs.push({kind,label,departureS:startS,arrivalS:endS,...(coordinates?{geometry:coordinates}:{}),...extra});
  if(coordinates)lines.push({label,kind,coordinates,official:false});now=endS;
 };
 const transfer=reverse=>{usedTransfer=true;const label=reverse?'西九龙 → 柯士甸月台接续 · 10 分钟模型缓冲':'柯士甸月台 → 西九龙 · 10 分钟模型缓冲';
  add('transfer',label,now,now+TRANSFER_S,undefined,{context:'官方站图确认柯士甸 C 通道连接西九龙；此处仅为站际换乘概览，现有细图缺少 C 通道及高差，不提供逐转或无障碍保证。'});walkMinutes+=TRANSFER_S/60;};
 if(!fromRail){const local=await appendLocal(from,anchor,'origin');if(local!==true)return {...local,journey:local?.journey?{...local.journey,complete:false}:undefined,highSpeed:true,message:'香港侧至柯士甸的完整路线未算通，高铁接续未生成。'+(local?.message??''),warnings:[...(local?.warnings??[])],lines:local?.lines??[],segments:local?.segments??[]};transfer(false);}
 if(from.id===FUT||to.id===FUT){
  const plan=planHighSpeedLeg({fromId:from.id===FUT?FUT:WEK,toId:from.id===FUT?WEK:FUT,readyS:now,departureDate:request.departureDate});
  if(!plan)return unavailable('所选时刻没有已覆盖的高铁示范班次，请调整时间。');
  trip=plan.trip;warnings.push(...(plan.warnings??[]));waitMinutes+=(plan.waitS??0)/60;processingMinutes+=(plan.processingS??0)/60;
  for(const part of plan.parts){const kind=part.kind==='highspeed'?'highspeed':part.kind==='wait'||part.kind==='onboard-wait'?'wait':'procedure';add(kind,part.label,part.startS,part.endS,part.coordinates,{procedure:part.kind,context:part.kind==='highspeed'?'依据核验时刻表的模拟列车；轨迹仅为两站示意，不是实际轨道定位。':'手续顺序取自官方指南；耗时为演示缓冲，不保证实际过关或赶车。'});}
  now=plan.endS;
 }
 if(!toRail){transfer(true);const local=await appendLocal(anchor,to,'destination');if(local!==true)return {...local,journey:local?.journey?{...local.journey,complete:false}:undefined,highSpeed:true,message:'抵港后的香港侧完整接续未算通，不把高铁抵站当作整程到达。'+(local?.message??''),warnings:[...(local?.warnings??[])],lines:local?.lines??[],segments:local?.segments??[]};}
 warnings.push('高铁班次来自核验时的一般时刻表；重复到所选日期仅为演示，不保证该日开行、余票或实际到站。票务系统及现场安排为准。','未接入高铁票价与余票，不生成跨境车票，不核验旅客入境资格。');
 if(usedTransfer)warnings.push('柯士甸 C 通道与西九龙的连接有官方站图依据；官方现行指南给出的两站步行参考约 4 分钟，不含月台全程；月台至通道的精确几何/高差尚未建模，另加 6 分钟内部缓冲，共 10 分钟模型值。未冒用 D/B/F 出口，也未补画室内通道。');
 const total=(now-start)/60;
 return {highSpeed:true,highSpeedTrip:trip,scenarioOnly:true,simulationOnly:true,needsFacilityConfirmation:usedTransfer,pricingUnavailable:true,
  departureS:start,arrivalS:now,totalMinutes:Math.ceil(total),walkMinutes,waitMinutes,processingMinutes,
  transfers:Math.max(0,segments.filter(segment=>['rail','metro','bus','tram','highspeed'].includes(segment.kind)).length-1),
  message:trip?'跨境高铁联程：已按到站时刻检查后续班次，并计入手续与换乘缓冲。':'香港西九龙接续：香港侧实际计算路线 + 明确标注的站际换乘模型。',
  metric:Math.ceil(total)+' 分钟 · 跨境情景估算',warnings,lines,segments,timedLegs,resolvedEndpoints,
  journey:{title:from.name+' → '+to.name,destination:to.name,phases,steps,graph:localGraph??{nodes:[],edges:[],regions:[]},knownMinutes:total,complete:true}};
}
