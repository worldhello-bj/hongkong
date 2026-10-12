/**
 * EXPERIMENT ONLY. Not installed by build-navigation.
 * Exact generated-goal bounds for a deliberately certified STATIC subdomain.
 * An arbitrary resolver can change duration, throw or abort on a skipped call;
 * its presence therefore disables this experiment, rather than guessing purity.
 */
export function createGeneratedGoalBounds({connections,patterns,target,departureS,horizonEndS,walkPenalty,transferPenaltyS,score,resolveConnectionAt,validPoint}){
 const LIMIT=2**40,CAP=2**30;
 const finite=v=>Number.isFinite(v)&&Math.abs(v)<=LIMIT;
 const data=o=>o&&typeof o==='object'&&Object.values(Object.getOwnPropertyDescriptors(o)).every(d=>'value'in d);
 const array=a=>Array.isArray(a)&&data(a)&&Array.from({length:a.length},(_,i)=>Object.hasOwn(a,i)).every(Boolean);
 const points=a=>array(a)&&a.every(p=>array(p)&&p.every(Number.isFinite)&&validPoint(p));
 if(resolveConnectionAt||typeof target!=='string'||!finite(departureS)||!finite(horizonEndS)||horizonEndS<departureS||horizonEndS-departureS>604801||!finite(walkPenalty)||walkPenalty<1||!finite(transferPenaltyS)||transferPenaltyS<0)return null;
 const reverse=new Map();
 const arc=(from,to,seconds,walk)=>{const list=reverse.get(to)??[];list.push({from,seconds:Math.min(CAP,seconds),walk:Math.min(CAP,walk)});reverse.set(to,list);};
 for(const list of connections.values())for(const edge of list){
  if(!data(edge)||typeof edge.id!=='string'||typeof edge.fromId!=='string'||typeof edge.toId!=='string'||typeof edge.kind!=='string'||!finite(edge.durationS)||edge.durationS<0||!finite(edge.preferencePenaltyS??0)||(edge.preferencePenaltyS??0)<0||edge.geometry&&!points(edge.geometry))return null;
  // Positive resource-changing steps must advance floor(clock) by at least one.
  // This certifies finite accumulated walk/penalty/transfer scores globally.
  if(edge.durationS!==0&&edge.durationS<1||edge.durationS===0&&(edge.kind!=='walk'||(edge.preferencePenaltyS??0)!==0))return null;
  const seconds=Math.floor(edge.durationS);arc(edge.fromId,edge.toId,seconds,edge.kind==='walk'?seconds:0);
 }
 const seen=new Map();
 for(const entries of patterns.values())for(const entry of entries){
  const {p,trips}=entry;
  if(!data(p)||!array(p.stops)||p.stops.length<2||!points(p.shape)||!data(p.provenance)||typeof p.id!=='string'||typeof p.mode!=='string'||!array(trips))return null;
  let tripSets=seen.get(p);if(!tripSets){tripSets=new Set();seen.set(p,tripSets);}if(tripSets.has(trips))continue;tripSets.add(trips);
  for(const stop of p.stops)if(!data(stop)||typeof stop.stopId!=='string'||!finite(stop.arrivalOffsetS)||!finite(stop.departureOffsetS)||stop.arrivalOffsetS>stop.departureOffsetS||!Number.isInteger(stop.shapeIndex)||stop.shapeIndex<0||stop.shapeIndex>=p.shape.length)return null;
  const minimum=Array(p.stops.length-1).fill(CAP);
  for(const trip of trips){
   if(!data(trip)||typeof trip.id!=='string'||!finite(trip.startS))return null;
   const arrivals=p.stops.map(s=>trip.startS+s.arrivalOffsetS),departures=p.stops.map(s=>trip.startS+s.departureOffsetS);
   if(!arrivals.every(finite)||!departures.every(finite))return null;
   for(let i=0;i<minimum.length;i++){
    if(arrivals[i]>departures[i]||departures[i]>arrivals[i+1])return null;
    const duration=Math.floor(arrivals[i+1])-Math.floor(departures[i]);
    if(duration<1)return null;
    minimum[i]=Math.min(minimum[i],duration);
   }
  }
  if(trips.length)for(let i=0;i<minimum.length;i++)arc(p.stops[i].stopId,p.stops[i+1].stopId,minimum[i],0);
 }
 // Integer distances only; all sums are <= 2*CAP, hence exactly represented.
 function distances(field){
  const result=new Map([[target,0]]),heap=[];
  const push=value=>{let at=heap.length;heap.push(value);while(at){const parent=(at-1)>>1;if(heap[parent].distance<=value.distance)break;heap[at]=heap[parent];at=parent;}heap[at]=value;};
  const pop=()=>{const first=heap[0],last=heap.pop();if(heap.length){let at=0;while(at*2+1<heap.length){let child=at*2+1;if(child+1<heap.length&&heap[child+1].distance<heap[child].distance)child++;if(last.distance<=heap[child].distance)break;heap[at]=heap[child];at=child;}heap[at]=last;}return first;};
  push({node:target,distance:0});
  while(heap.length){const item=pop();if(item.distance!==result.get(item.node))continue;for(const edge of reverse.get(item.node)??[]){const distance=Math.min(CAP,item.distance+edge[field]);if(distance<(result.get(edge.from)??CAP)){result.set(edge.from,distance);push({node:edge.from,distance});}}}
  return result;
 }
 const time=distances('seconds'),walk=distances('walk');let incumbent=Infinity;
 function lowerScore(label){
  if(!finite(label.time)||!finite(label.walk)||label.walk<0||!Number.isFinite(label.facilityPenalty)||label.facilityPenalty<0||!Number.isFinite(label.transfers)||label.transfers<0)return undefined;
  const optimistic={...label,time:Math.max(label.time,Math.floor(label.time)+(time.get(label.node)??CAP)),walk:Math.max(label.walk,Math.floor(label.walk)+(walk.get(label.node)??CAP))};
  const value=score(optimistic);return Number.isFinite(value)?value:undefined;
 }
 return{
  lowerScore,
  observe(label){if(label.node===target){const value=score(label);if(Number.isFinite(value)&&value<incumbent)incumbent=value;}},
  reject(label){const value=lowerScore(label);return value!==undefined&&value>incumbent;}
 };
}
