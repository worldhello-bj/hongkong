/** One heavyweight graph query at a time per planner generation.
 * Direct road quotes and rendering remain independent. No search-time cutoff.
 * Switching graph owners releases the prior idle Worker index before allocating another.
 */
export function createRoutingQueue(signal){
 let tail=Promise.resolve(),owner,release;
 const aborted=()=>new DOMException('Aborted','AbortError');
 const dispose=()=>{release?.();release=undefined;owner=undefined;};
 const abort=()=>dispose();signal?.addEventListener('abort',abort,{once:true});
 return {
  run(task,key,onRelease){
   const result=tail.then(async()=>{
    if(signal?.aborted)throw aborted();
    if(owner!==key){dispose();owner=key;release=onRelease;}
    return task();
   });tail=result.catch(()=>{});return result;
  },
  dispose(){dispose();signal?.removeEventListener('abort',abort);}
 };
}

/** Keep one graph owner's dependent queries contiguous before changing graphs.
 * Direct taxi quotes can publish while base public routing runs. Detailed official,
 * modeled fallback and pure walking searches are retained after the base group.
 * Cancellation/newer requests stop later phases; failures do not hide alternatives.
 */
export async function runRoutingPhases({basePublic,taxi,refinePublic,walk,isCurrent=()=>true}){
 const settle=task=>Promise.resolve().then(task).then(value=>({status:'fulfilled',value}),reason=>({status:'rejected',reason}));
 const results=await Promise.all([settle(basePublic),settle(taxi)]);
 for(const task of [refinePublic,walk]){
  if(!isCurrent())break;
  results.push(await settle(task));
 }
 return results;
}
