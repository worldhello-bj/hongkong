import{readFileSync,writeFileSync}from'node:fs';
import{fileURLToPath,pathToFileURL}from'node:url';

export const walkCacheClockAssets=['app-transit-worker-CaCMeUxU.js','intermodal-routing-D8vKT-lN.js'];
const marker='/* HK_WALK_CACHE_CLOCK_V1 */\n';
const configurations=[
 {anchor:'ee=(i,m,v,U,K,ne)=>{Ke(ne);',before:'JSON.stringify([i,m,v,..._e?[U,K]:[]])',after:'JSON.stringify([i,m,v,U,K])'},
 {anchor:'X=(e,i,m,R,E,Y)=>{_e(Y);',before:'JSON.stringify([e,i,m,...le?[R,E]:[]])',after:'JSON.stringify([e,i,m,R,E])'},
];
function configuration(source){
 const matches=configurations.filter(c=>source.includes(c.anchor));
 if(matches.length!==1)throw Error('Walk cache clock engine anchor drift');
 return matches[0];
}
function once(source,before,after){
 if(source.split(before).length!==2)throw Error('Walk cache clock key anchor drift: '+before);
 return source.replace(before,after);
}
/** Restore only this repair, retaining every other production transform. */
export function restoreWalkCacheClock(source){
 if(!source.includes(marker))return source;
 if(source.split(marker).length!==2)throw Error('Walk cache clock marker drift');
 const c=configuration(source);
 if(source.includes(c.before))throw Error('Walk cache clock mixed key anchors');
 return once(source,c.after,c.before).replace(marker,'');
}
/** The complete endpoints already form the key; always retain exact clock/date.
 * This owner-level 512-entry memo is distinct from the per-query connection memo.
 * Its old region-only timing test misses endpoint access schedules.
 */
export function patchWalkCacheClock(source){
 if(source.includes(marker)){restoreWalkCacheClock(source);return{source,changes:0};}
 const c=configuration(source);
 if(source.includes(c.after))throw Error('Walk cache clock unmarked repaired key');
 return{source:marker+once(source,c.before,c.after),changes:1};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const root=process.argv[2]??fileURLToPath(new URL('../',import.meta.url));
 for(const file of walkCacheClockAssets){
  const path=root+'/dist/assets/'+file,result=patchWalkCacheClock(readFileSync(path,'utf8'));
  if(result.changes)writeFileSync(path,result.source);
  console.log(file+': '+result.changes+' owner walk-cache clock changes');
 }
}
