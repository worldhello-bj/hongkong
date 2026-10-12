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
