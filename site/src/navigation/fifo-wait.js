/** Earliest feasible traversal with waiting; service/closure checks stay authoritative. */
export function earliestOpenWait({edge,destination,arrivalS,durationS,date,horizonS=14400,canTraverse,openingTimes}){
 const candidates=[0,...openingTimes(edge,arrivalS,date,horizonS)];
 if(destination)for(const delay of openingTimes(destination,arrivalS,date,horizonS+durationS))candidates.push(Math.max(0,delay-durationS));
 for(const wait of [...new Set(candidates)].sort((a,b)=>a-b)){
  if(wait<0||wait+durationS>horizonS)continue;
  if(canTraverse(edge,arrivalS+wait,durationS,date)&&(!destination||canTraverse(destination,arrivalS+wait+durationS,0,date)))return wait;
 }
 return null;
}
