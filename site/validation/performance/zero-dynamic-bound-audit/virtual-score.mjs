const root=fileURLToPath(new URL('../../../',import.meta.url));
const runtime=fileURLToPath(new URL('../runtime-2e2fcf795897/',import.meta.url));
const out=fileURLToPath(new URL('./',import.meta.url));
import{fileURLToPath}from'node:url';
/** Passive-only observer arithmetic. Never controls admission, heap or expansion. */
export function virtualGoalScore(label,potential,score,incumbent=Infinity){
 if(!potential||!Number.isSafeInteger(potential.time)||potential.time<0||potential.time>2**30||!Number.isSafeInteger(potential.walk)||potential.walk<0||potential.walk>2**30)return{supported:false,reason:'missing-or-invalid-potential'};
 if(!Number.isFinite(label.time)||label.time<0||label.time>2**40||!Number.isFinite(label.walk)||label.walk<0||label.walk>=2**50||!Number.isSafeInteger(label.transfers)||label.transfers<0||label.transfers>2**30||label.facilityPenalty!==0)return{supported:false,reason:'outside-audited-resource-domain'};
 const virtualTime=Math.max(label.time,Math.floor(label.time)+potential.time);
 const virtualWalk=Math.max(label.walk,Math.floor(label.walk)+potential.walk);
 // Pass the ORIGINAL engine score closure. Do not replace this with M+T+1.5W.
 const originalScore=score(label),boundScore=score({time:virtualTime,walk:virtualWalk,transfers:label.transfers,facilityPenalty:label.facilityPenalty});
 if(!Number.isFinite(originalScore)||!Number.isFinite(boundScore))return{supported:false,reason:'nonfinite-score'};
 const incumbentFinite=Number.isFinite(incumbent);
 return{supported:true,originalScore,boundScore,virtualTime,virtualWalk,timePotential:potential.time,walkPotential:potential.walk,incumbentFinite,wouldPrune:incumbentFinite&&boundScore>incumbent,equal:incumbentFinite&&boundScore===incumbent,currentScoreAboveIncumbent:incumbentFinite&&originalScore>incumbent};
}
export function loadTopologyPotentials(topology){
 return new Map(topology.allBounds.map(({node,time,walk})=>[node,{time,walk}]));
}
export const rawWorkerHooks=Object.freeze({
 originalScore:'const M=h=>h.time-s+(r-1)*h.walk+d*h.transfers+h.facilityPenalty',
 acceptedGoal:'S.push(i)',
 rootGoal:'S.push(E);',
 eligibleSettledPop:'h.settled=!0;const I=h.node,k=h.time;',
 existingProfileSettledPop:'h.settled=!0;++__sdSettled;const I=h.node,k=h.time;',
 existingProfileIncumbent:'__sdBestGoalScore',
 outgoingConnections:'J.get(h.node)??[]',
});
