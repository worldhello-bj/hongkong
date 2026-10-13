import {PREFERENCE_PROFILES, preferenceConnectionPenalty} from './preference-routing.js?v=80559fd92aa0';
/** Absolute generalized minutes. Stable when unrelated alternatives are added.
 * Fares, weights and waiting estimates are demonstration assumptions, not a valuation study.
 * Total clock time already includes walking/waiting; their terms are extra burden only.
 */
export const JOURNEY_WEIGHTS=Object.freeze({
 time:Object.freeze({label:'综合推荐',minutes:1,cost:.75,walkMinutes:.35,waitMinutes:.5,transfers:3}),
 cost:Object.freeze({label:'少花费',minutes:.65,cost:2,walkMinutes:.2,waitMinutes:.35,transfers:2}),
 walk:Object.freeze({label:'少步行',minutes:.75,cost:.25,walkMinutes:2.5,waitMinutes:.4,transfers:3})
});
export function validatedJourneyWeights(priority='time',overrides={}){
 const weights={...(JOURNEY_WEIGHTS[priority]??JOURNEY_WEIGHTS.time),...overrides};
 const keys=['minutes','cost','walkMinutes','waitMinutes','transfers'];
 if(keys.some(key=>!Number.isFinite(weights[key])||weights[key]<0||weights[key]>(key==='transfers'?60:10)))throw new RangeError('权重必须为范围内的非负有限数值');
 if(!keys.some(key=>weights[key]>0))throw new RangeError('至少一项权重必须大于 0');
 return Object.fromEntries(['label',...keys].map(key=>[key,weights[key]]));
}
const finite=value=>Number.isFinite(value)&&value>=0;
export function journeyWaitMinutes(choice){
 const result=choice.result??choice;
 if(finite(result.waitMinutes))return result.waitMinutes;
 return (result.segments??[]).filter(segment=>segment.kind==='wait').reduce((sum,segment)=>sum+(finite(segment.minutes)?segment.minutes:0),0);
}
export function journeyScore(choice,priority='time',need='ordinary',overrides={}){
 const weights=validatedJourneyWeights(priority,overrides);
 const metrics={minutes:choice.minutes,cost:choice.cost,walkMinutes:choice.walkMinutes,waitMinutes:journeyWaitMinutes(choice),transfers:choice.transfers};
 // A missing fare must never become a free ride. Keep the usable route as a pending-price option.
 if(!choice.available||Object.values(metrics).some(value=>!finite(value)))return {total:Infinity,terms:{},weights,metrics,pricingPending:!finite(choice.cost)};
 const terms=Object.fromEntries(Object.entries(metrics).map(([key,value])=>[key,value*weights[key]]));
 const profile=PREFERENCE_PROFILES[need]?.engine??'fast';
 terms.facilities=preferenceConnectionPenalty(choice.result?.segments,profile)/60;
 if(need==='luggage')terms.facilities+=metrics.transfers*3;
 return {total:Object.values(terms).reduce((sum,value)=>sum+value,0),terms,weights,metrics,pricingPending:false};
}
export function hasPublicAlternative(choices){return choices.some(choice=>choice.available&&!choice.result?.taxiQuote&&!choice.modes?.includes('taxi'));}
