/** Additive audits. All original point-matrix checks remain unchanged. */
import {auditCandidate as originalAuditCandidate,sourceIndex} from './point-matrix-audit.mjs';
import {PREFERENCES} from './four-preference-fixture.mjs';
const expectedEngine={ordinary:'fast',luggage:'luggage',escalator:'escalator_first',lift:'lift_first'};
const vehicle=new Set(['rail','metro','bus','tram','taxi','wait','station_overview']);
export function auditJourneyClock(result,request,index,canTraverse){
 const steps=result.journey?.steps??[],local=sourceIndex([result.journey?.graph]),records=[],violations=[];
 let clock=request.departureS;
 for(const [step,s] of steps.entries()){
  const g=s.guidance??{},durationS=(g.minutes??0)*60,startS=clock,endS=clock+durationS;
  if(!Number.isFinite(durationS)||durationS<0){violations.push({step,reason:'non-finite-or-negative-step-duration',durationS});continue;}
  clock=endS;
  const edges=(g.edge_ids??[]).map(id=>index.edges.get(id)??index.edges.get(id.replace(/:split:\d+$/,''))??local.edges.get(id)).filter(Boolean);
  const scheduled=edges.filter(e=>e.access_schedule||e.access_time_id!=null);
  const blocked=scheduled.filter(e=>!canTraverse(e,startS+.001,Math.max(0,durationS-.002),request.departureDate));
  if(blocked.length)violations.push({step,reason:'facility-closed-on-paid-journey-clock',edgeIds:blocked.map(e=>e.id),startS,endS});
  records.push({step,kind:s.kind,phase:s.phase,startS,endS,durationS,scheduledEdgeIds:scheduled.map(e=>e.id)});
 }
 const segmentMinutes=(result.segments??[]).reduce((n,s)=>n+(s.minutes??0),0),knownMinutes=result.journey?.knownMinutes;
 const durationMinutes=(clock-request.departureS)/60;
 const comparisons={
  finiteStepClock:Number.isFinite(clock),
  knownJourneyClock:!Number.isFinite(knownMinutes)||Math.abs(knownMinutes-durationMinutes)<.0002,
  segmentClock:!(result.segments?.length)||Math.abs(segmentMinutes-durationMinutes)<.0002,
  requestedDeparture:!Number.isFinite(result.departureS)||Math.abs(result.departureS-request.departureS)<.01,
  reportedArrival:!Number.isFinite(result.arrivalS)||Math.abs(result.arrivalS-clock)<.01,
  roundedDisplayedMinutes:!Number.isFinite(result.totalMinutes)||Math.abs(result.totalMinutes-durationMinutes)<1.0001,
  originOpening:canTraverse(request.origin,request.departureS+.001,0,request.departureDate),
  destinationOpening:canTraverse(request.destination,clock+.001,0,request.departureDate),
  scheduledFacilities:violations.length===0
 };
 return {departureDate:request.departureDate,departureTimezone:'Asia/Hong_Kong',departureS:request.departureS,arrivalS:clock,durationMinutes,knownMinutes,segmentMinutes,reportedDepartureS:result.departureS,reportedArrivalS:result.arrivalS,comparisons,records,violations,pass:Object.values(comparisons).every(Boolean)};
}
export function auditFourPreferenceCandidate(choice,context){
 const inherited=originalAuditCandidate(choice,context),result=choice.result??{},index=context.index,local=sourceIndex([result.journey?.graph]);
 const used=[...new Set((result.journey?.steps??[]).flatMap(s=>s.guidance?.edge_ids??[]))];
 const facilities=used.flatMap(id=>{const e=index.edges.get(id)??index.edges.get(id.replace(/:split:\d+$/,''))??local.edges.get(id);if(!e||vehicle.has(e.kind))return [];return [{id,physicalId:e.physical_id,kind:e.kind,sourceId:e.source_id,sourceUrl:e.source_url,geometryMode:e.geometry_mode,wheelchairBarrier:e.wheelchair_barrier??null,wheelchairAccess:e.wheelchair_access??null,accessibleEligible:e.accessible_eligible===true,explicitWheelchairEvidence:e.accessible_eligible===true&&e.wheelchair_barrier===2}];});
 const unknown=facilities.filter(e=>!e.explicitWheelchairEvidence);
 const clock=auditJourneyClock(result,context.request,index,context.canTraverse);
 const checks={...inherited.checks,fourPassengerPreference:PREFERENCES.includes(context.need),requestedPreference:result.requestedPreference===context.need,effectivePreference:result.effectivePreference===expectedEngine[context.need],paidJourneyClock:clock.pass,unknownWheelchairEvidenceNotPromoted:unknown.length===0||result.accessibilityVerified!==true};
 return {...inherited,checks,pass:Object.values(checks).every(Boolean),fourPreferenceAudit:{clock,facilities,unknownWheelchairEvidenceCount:unknown.length,accessibilityVerified:result.accessibilityVerified??null,qualification:'Legal ordinary/facility-preference use is separate from wheelchair suitability. Unknown suitability is retained as unknown; source lifts are not removed merely because strict mode is removed.'}};
}
