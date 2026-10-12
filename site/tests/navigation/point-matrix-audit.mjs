/** Assertions inspect production results; they do not repair or reroute them. */
import {strictSourceFailureReasons} from './point-source-eligibility.mjs';
const uniq=xs=>[...new Set(xs)];
export const samePoint=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length<=b.length&&a.every((v,i)=>Number.isFinite(v)&&Number.isFinite(b[i])&&Math.abs(v-b[i])<=(i===2?.005:1e-7));
export const identity=p=>p&&Object.fromEntries(['id','node_id','node_ids','namedPlaceId','floorId','floorName','coordinates'].filter(k=>p[k]!==undefined).map(k=>[k,p[k]]));
const xyGap=(a,b)=>Math.hypot((a[0]-b[0])*111320*Math.cos((a[1]+b[1])*Math.PI/360),(a[1]-b[1])*111320);
const mode=kind=>kind==='rail'?'metro':['metro','bus','tram','taxi'].includes(kind)?kind:'walk';
export function sourceIndex(graphs=[]){
 const edges=new Map(),nodes=new Map(),closed=new Set();
 for(const g of graphs.filter(Boolean)){for(const e of g.edges??[])edges.set(e.id,e);for(const n of g.nodes??[])nodes.set(n.id,n);for(const c of g.closures??[])for(const id of c.physical_ids??[])closed.add(id);}
 return {edges,nodes,closed};
}
export function endpointAudit(request,result,fixture,index){
 const lines=(result.journey?.steps??[]).filter(s=>s.guidance?.geometry?.type==='LineString'&&s.guidance.geometry.coordinates.length).map(s=>s.guidance.geometry.coordinates);
 return Object.fromEntries(['origin','destination'].map(side=>{
  const p=request[side],actual=side==='origin'?lines[0]?.[0]:lines.at(-1)?.at(-1),resolved=result.resolvedEndpoints?.find(r=>r.side===side);
  if(p.namedPlaceId&&p.floorId){
   const floor=fixture.floors.find(f=>f.id===p.floorId),portal=floor?.portals.find(q=>q.id===resolved?.entranceId);
   const expected=portal&&index.nodes.get(portal.node_id)?.coordinates||portal?.coordinates;
   return [side,{kind:'named-source-floor',requested:identity(p),resolved,allowedPortalCount:floor?.portals.length??0,sourceNodeId:portal?.node_id,actual,pass:!!portal&&resolved.placeId===p.namedPlaceId&&resolved.floorName===floor.name&&samePoint(expected,resolved.coordinates)&&samePoint(expected,actual)&&samePoint(expected,result.routedEndpoints?.[side])}];
  }
  const expectedNode=p.node_id?index.nodes.get(p.node_id):null,usedIds=(result.journey?.steps??[]).flatMap(s=>s.guidance?.edge_ids??[]),incident=p.node_id?usedIds.some(id=>{const e=index.edges.get(id)??index.edges.get(id.replace(/:split:\d+$/,''));return e&&(e.from_id===p.node_id||e.to_id===p.node_id);}):null;
  return [side,{kind:p.node_id?'exact-source-node':p.coordinates?.length===3?'exact-xyz':'exact-map-or-stop-xy',requested:identity(p),actual,routed:result.routedEndpoints?.[side],sourceNodeMatches:expectedNode?samePoint(p.coordinates,expectedNode.coordinates):null,nodeTraceable:incident,pass:samePoint(p.coordinates,actual)&&(!(p.node_id||p.coordinates?.length===3)||!result.routedEndpoints?.[side]||samePoint(p.coordinates,result.routedEndpoints[side]))&&(!p.node_id||!!expectedNode&&samePoint(p.coordinates,expectedNode.coordinates)&&incident)}];
 }));
}
export function fareAudit(choice){
 const q=choice.quote??{},result=choice.result??{},source=result.segments??(result.journey?.phases??[]).map((_,phase)=>({kind:(result.journey.steps??[]).find(s=>s.phase===phase&&['rail','metro','bus','tram','taxi'].includes(s.kind))?.kind??'walk'})),expected=[];
 for(const s of source){const m=mode(s.kind??s.mode);if(m==='walk'&&expected.at(-1)==='walk')continue;expected.push(m);}
 const legs=(q.segments??[]).map((s,i)=>({index:i,mode:s.mode,label:s.label,amountCents:s.amountCents,durationMinutes:s.durationMinutes,distanceM:s.distanceM,available:s.available}));
 const sum=legs.reduce((n,s)=>n+(Number.isSafeInteger(s.amountCents)?s.amountCents:NaN),0);
 const coverage=expected.length?JSON.stringify(expected)===JSON.stringify(legs.map(s=>s.mode)):null;
 return {basis:'Production illustrative quote, not official live tariffs',available:q.available,pricingUnavailable:!!q.pricingUnavailable,compacted:!!q.compacted,totalCents:q.totalCents,sumLegCents:sum,legs,expectedCompactedModes:expected,legCoverage:coverage,pass:!q.pricingUnavailable&&legs.length>0&&legs.every(s=>Number.isSafeInteger(s.amountCents)&&s.amountCents>=0)&&sum===q.totalCents&&Math.abs(choice.cost*100-q.totalCents)<.0001&&coverage!==false};
}
export function auditTransitRideBoundaries(result,services){
 if(!services)return [];
 const stops=new Map((services.stops??[]).map(s=>[s.id,s])),patterns=new Map((services.patterns??[]).map(p=>[p.id,p])),rows=[];
 for(const [index,leg] of (result.timedLegs??[]).entries()){
  if(!['bus','tram'].includes(leg.kind))continue;
  const from=stops.get(leg.fromId),to=stops.get(leg.toId),pattern=patterns.get(leg.patternId),phases=new Set(result.timedLegAreaIndices?.[index]??[]);
  const steps=(result.journey?.steps??[]).filter(s=>s.kind===leg.kind&&phases.has(s.phase)&&s.guidance?.geometry?.type==='LineString'),points=steps.flatMap(s=>s.guidance.geometry.coordinates),source=leg.geometry??[],xy=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);
  const eligible=pattern?.mode===leg.kind&&from&&to&&xy(from.coordinates)&&xy(to.coordinates)&&source.length>=2&&source.every(xy);
  const first=points[0],last=points.at(-1),start=source[0],end=source.at(-1),offset=first&&start&&!samePoint(start,first)?1:0;
  const shapePreserved=source.length>0&&source.every((p,i)=>samePoint(p,points[i+offset])),minutes=steps.reduce((n,s)=>n+(s.guidance?.minutes??0),0);
  rows.push({kind:leg.kind,patternId:leg.patternId,fromId:leg.fromId,toId:leg.toId,departureS:leg.departureS,arrivalS:leg.arrivalS,durationS:leg.durationS,renderedMinutes:minutes,sourceShape:{first:start,last:end,points:source.length,geometryMode:pattern?.geometryMode,sourceUrl:pattern?.provenance?.geometrySourceUrl??pattern?.provenance?.sourceUrl},renderedBoundary:{first,last},sourceStops:{from:from?.coordinates,to:to?.coordinates},associations:eligible?['boarding','alighting'].flatMap((role,i)=>{const stop=i?to:from,shape=i?end:start;if(samePoint(stop.coordinates,shape))return[];return[{role,sourceStopId:stop.id,stopCoordinates:stop.coordinates,shapeCoordinates:shape,distanceM:xyGap(stop.coordinates,shape),evidence:'unverified-vehicle-display-projection-not-pedestrian-access'}];}):[],sourceShapePreserved:shapePreserved,timingPreserved:Math.abs(minutes*60-leg.durationS)<.01,eligible2DSourceService:!!eligible,pass:!eligible||(samePoint(from.coordinates,first)&&samePoint(to.coordinates,last)&&shapePreserved&&Math.abs(minutes*60-leg.durationS)<.01),qualification:'Audit reconstruction from unchanged production timed-leg shape, source service stops and final guidance; does not establish a physical boarding or walking connection.'});
 }
 return rows;
}
export function auditCandidate(choice,{request,need,taxi,fixture,index,services,sourceEligibility}){
 const result=choice.result??{},steps=result.journey?.steps??[],local=sourceIndex([result.journey?.graph]);
 const usedEdges=uniq(steps.flatMap(s=>s.guidance?.edge_ids??[])),forbidden=[],unknownEdges=[],scheduledEdges=[],strictSourceFailures=[];
 for(const id of usedEdges){const e=index.edges.get(id)??index.edges.get(id.replace(/:split:\d+$/,''))??local.edges.get(id);if(!e){unknownEdges.push(id);continue;}
  const reasons=[];if(e.disabled)reasons.push('disabled');if(index.closed.has(e.physical_id)||local.closed.has(e.physical_id))reasons.push('closed-physical-id');
  if(need==='accessible'&&(e.wheelchair_barrier===1||['stairs','stairlift','escalator','travelator'].includes(e.kind)))reasons.push('strict-forbidden-facility');
  if(need==='accessible'){const strictReasons=strictSourceFailureReasons(e,sourceEligibility);if(strictReasons.length)strictSourceFailures.push({id,physicalId:e.physical_id,kind:e.kind,geometryMode:e.geometry_mode,accessibleEligible:e.accessible_eligible,wheelchairBarrier:e.wheelchair_barrier,reasons:strictReasons});}
  if(reasons.length)forbidden.push({id,physicalId:e.physical_id,kind:e.kind,reasons});
  if(e.access_schedule)scheduledEdges.push({id,physicalId:e.physical_id,ruleId:e.access_time_id,kind:e.access_schedule.kind,windows:e.access_schedule.windows});
 }
 if(need==='accessible')for(const [stepNumber,step] of steps.entries()){
  const g=step.guidance,physical=g?.geometry_mode==='official'&&!['rail','metro','bus','tram','taxi','wait','station_overview'].includes(step.kind);
  if(physical&&(!(g.edge_ids?.length)||g.edge_ids.some(id=>unknownEdges.includes(id))))strictSourceFailures.push({step:stepNumber,kind:step.kind,reasons:['strict-physical-step-source-unresolved']});
 }
 const geometry=steps.map((s,i)=>({step:i,kind:s.kind,blocked:!!s.blocked,mode:s.guidance?.geometry_mode,coordinates:s.guidance?.geometry?.type==='LineString'?s.guidance.geometry.coordinates:[]})).filter(s=>s.coordinates.length);
 const gaps=[];let maxGapM=0,maxHeightGapM=0;
 for(let i=1;i<geometry.length;i++){const before=geometry[i-1],after=geometry[i],a=before.coordinates.at(-1),b=after.coordinates[0],gapM=xyGap(a,b),heightGapM=Number.isFinite(a[2])&&Number.isFinite(b[2])?Math.abs(a[2]-b[2]):null;maxGapM=Math.max(maxGapM,gapM);maxHeightGapM=Math.max(maxHeightGapM,heightGapM??0);if(gapM>.5||(heightGapM??0)>.5)gaps.push({before:before.step,after:after.step,gapM,heightGapM,from:a,to:b});}
 const endpoints=endpointAudit(request,result,fixture,index),fare=fareAudit(choice),transitRideBoundaries=auditTransitRideBoundaries(result,services),taxiKind=result.taxiCandidateKind??'public';
 const modeled=geometry.filter(s=>s.mode!=='official'||s.blocked).map(s=>({step:s.step,kind:s.kind,geometryMode:s.mode,blocked:s.blocked}));
 const checks={complete:!!result.journey?.complete,endpoints:Object.values(endpoints).every(p=>p.pass),continuous:gaps.length===0,knownForbiddenEdges:forbidden.length===0,strictSourceEligibility:need!=='accessible'||!!sourceEligibility&&strictSourceFailures.length===0,fare:fare.pass,transitStopBoundaries:transitRideBoundaries.every(r=>r.pass),taxiPolicy:taxi||taxiKind==='public',strictTaxi:need!=='accessible'||taxiKind==='public',luggageTaxiConfirmation:need!=='luggage'||taxiKind==='public'||!!result.needsVehicleConfirmation};
 return {id:choice.id,kind:taxiKind,available:!!choice.available,scoringInput:{id:choice.id,available:!!choice.available,minutes:choice.minutes,cost:choice.cost,walkMinutes:choice.walkMinutes,transfers:choice.transfers,result:{waitMinutes:result.waitMinutes,segments:(result.segments??[]).map(s=>({kind:s.kind,minutes:s.minutes})),luggageCarryRequired:!!result.luggageCarryRequired}},minutes:choice.minutes,cost:choice.cost,walkMinutes:choice.walkMinutes,waitMinutes:result.waitMinutes,transfers:choice.transfers,modes:choice.modeChain,endpoints,continuity:{maxGapM,maxHeightGapM,gaps},evidence:{status:modeled.length||unknownEdges.length||result.simulationOnly||result.scenarioOnly||result.needsFacilityConfirmation?'modeled-or-unverified':'source-backed-not-live-verified',modeledSteps:modeled,unknownEdgeIds:unknownEdges,transitRideBoundaries,usedEdgeCount:usedEdges.length,scheduledEdges,needsFacilityConfirmation:!!result.needsFacilityConfirmation,simulationOnly:!!result.simulationOnly,scenarioOnly:!!result.scenarioOnly},forbidden,strictSourceAudit:need==='accessible'?{provenance:sourceEligibility?.provenance,failures:strictSourceFailures,pass:checks.strictSourceEligibility}:null,fare,checks,pass:Object.values(checks).every(Boolean),warnings:result.warnings??[],endpointAccess:result.endpointAccess,incompleteReason:result.incompleteReason,requestedPreference:result.requestedPreference,effectivePreference:result.effectivePreference};
}
export function auditUnavailable(choice){
 const r=choice.result??{};
 return {id:choice.id,kind:r.taxiCandidateKind??'public',available:!!choice.available,journeyComplete:!!r.journey?.complete,failureStatus:r.failureStatus,incompleteReason:r.incompleteReason,endpointAccess:r.endpointAccess,routedEndpoints:r.routedEndpoints,resolvedEndpoints:r.resolvedEndpoints,scenarioOnly:!!r.scenarioOnly,simulationOnly:!!r.simulationOnly,message:r.message,warnings:r.warnings,minutes:choice.minutes,cost:Number.isFinite(choice.cost)?choice.cost:null,modes:choice.modeChain,fareScenario:choice.quote?fareAudit(choice):null,alternatives:{endpoint:r.endpointAlternative,entrance:r.entranceAlternative,namedPlace:r.namedPlaceAlternative},qualification:'Unavailable journey; a retained fare estimate or preserved endpoint metadata does not establish a source-backed physical connection.'};
}
export function completionTiming(state,wallMs,performance={}, {planningStarted=true}={}){
 if(!planningStarted)return {state:'planning-not-started',comparisonStatus:null,failedStages:[],fullCandidateWallMs:null,stoppedWallMs:null};
 const failed=performance.comparisonStatus==='incomplete-error'||(performance.failedStages?.length??0)>0,stopped=state==='complete'||state==='stopped-incomplete-error';
 return {state:stopped&&failed?'stopped-incomplete-error':state,comparisonStatus:performance.comparisonStatus??null,failedStages:performance.failedStages??[],fullCandidateWallMs:stopped&&!failed?wallMs:null,stoppedWallMs:stopped?wallMs:null};
}
export function classifyObservation({state,candidates=[],workerErrors=[],requestChanged=false,cancel,comparisonStatus,failedStages=[]}={}){
 if(workerErrors.some(e=>e.code==='ERR_WORKER_OUT_OF_MEMORY'||/heap out of memory|memory limit/i.test(e.message??'')))return 'resource-failure-oom';
 if(comparisonStatus==='incomplete-error'||failedStages.length)return 'incomplete-routing-error';
 if(workerErrors.length)return 'worker-failure';
 if(state==='planning-not-started')return 'planning-not-started';
 if(requestChanged||candidates.some(c=>!c.pass)||cancel?.pass===false)return 'invariant-failure';
 if(state!=='complete')return 'pending-observation-window';
 return candidates.length?'completed-with-candidates':'completed-without-candidate-needs-diagnosis';
}
