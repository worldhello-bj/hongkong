import {normalizePassengerNeed,isRemovedPassengerNeed} from './passenger-preferences.js?v=0f6587f77445';
/** Four public preferences change cost, never clock time or known closures. */
export const PREFERENCE_PROFILES=Object.freeze({
 ordinary:{engine:'fast',label:'普通出行'},luggage:{engine:'luggage',label:'行李搬运负担低'},
 escalator:{engine:'escalator_first',label:'扶梯优先'},lift:{engine:'lift_first',label:'升降机优先'}
});
const kindOf=edge=>String(edge?.kind??'').toLowerCase().replace(/[\s_-]/g,'');
export function preferenceAllows(edge,preference){
 if(preference==='luggage'&&(edge.luggage_prohibited===true||edge.luggage_allowed===false||edge.baggage_prohibited===true))return false;
 return true;
}
export function preferenceCost(edge,duration,preference,{continuingLift=false,fraction=1}={}){
 const kind=kindOf(edge),stairs=['stairs','stairlift','steps','staircase'].includes(kind),moving=['escalator','travelator','movingwalkway'].includes(kind);
 if(preference==='luggage')return duration*(stairs?8:moving?4:['walk','crossing','footbridge','subway','ramp','accessconnector'].includes(kind)?2:1);
 if(preference==='lift_first')return duration*(stairs?4:moving?2:1);
 if(preference==='escalator_first')return duration*(stairs?3:1)+(kind==='lift'&&!continuingLift?90*fraction:0);
 if(preference==='few_stairs'&&stairs)return duration*3;
 return duration;
}
/** Earlier state can reproduce a later state by paid waiting (one cost unit/sec). */
export function waitingLabelDominates(a,b,compareTie=(x,y)=>String(x).localeCompare(String(y))){
 if(!a||!b)return false;const epsilon=1e-9,at=a.elapsed??0,bt=b.elapsed??0;
 if(at>bt+epsilon||a.access>b.access+epsilon)return false;
 const paidCost=a.cost+Math.max(0,bt-at);if(paidCost>b.cost+epsilon)return false;
 return a.access<b.access-epsilon||paidCost<b.cost-epsilon||at<bt-epsilon||compareTie(a.tie,b.tie)<=0;
}
export function annotatePreferenceResult(result,request={}){
 if(!result?.journey?.complete)return result;
 const removed=isRemovedPassengerNeed(request.need),originalNeed=request.need;
 request={...request,need:normalizePassengerNeed(request.need)};
 const carryKind=edge=>['stairs','stairlift','escalator','travelator','movingwalkway'].includes(kindOf(edge));
 const used=new Set(request.need==='luggage'?(result.journey.steps??[]).flatMap(step=>[...(step.guidance?.edge_ids??[]),...(step.edge_ids??[])]).map(id=>id.replace(/:split:\d+$/,'')):[]);
 const needsCarry=request.need==='luggage'&&((result.segments??[]).some(carryKind)||(result.journey.steps??[]).some(step=>carryKind(step)||carryKind(step.guidance))||(result.journey.graph?.edges??[]).some(edge=>used.has(edge.id)&&carryKind(edge)));
 return {...result,requestedPreference:request.need,effectivePreference:PREFERENCE_PROFILES[request.need].engine,accessibility:'unknown',accessibilityVerified:false,...(removed?{preferenceMigration:{from:originalNeed,to:'ordinary'}}:{}),...(needsCarry?{luggageCarryRequired:true,needsConfirmation:true,needsFacilityConfirmation:true,message:'此备选含楼梯或扶梯，需搬运行李；大件行李优先改用升降机，设施与通行条件待确认。'}:{})};
}
export function preferenceConnectionPenalty(legs,preference){return (legs??[]).reduce((sum,leg)=>{const duration=Number(leg.minutes??0)*60;return sum+Math.max(0,preferenceCost(leg,duration,preference)-duration);},0)}
export function preferenceJourneyScore(choice,need){const profile=PREFERENCE_PROFILES[need]?.engine??'fast';return (choice.minutes??Infinity)*60+preferenceConnectionPenalty(choice.result?.segments,profile)+(need==='luggage'?(choice.transfers??0)*180:0)}
