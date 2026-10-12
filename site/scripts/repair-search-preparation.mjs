import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
export const searchAssets=['mobile-navigation-DfEsS_7b.js','app-walk-worker-jk5g-BMr.js','metro-worker-BDEusPKL.js','app-transit-worker-CaCMeUxU.js'];
const helper=readFileSync(new URL('../src/navigation/search-timing.js',import.meta.url),'utf8').replace('export function searchTimingProfile','function __hkSearchTimingProfile');
export function patchSearchPreparation(source,{fifoAncestry=false,timingCache=true,fifoOpeningScan=true}={}){
 let changes=0;
 if(fifoAncestry&&!source.includes('HK_FIFO_ANCESTRY_GUARD_V1')){
  const pattern=/let [A-Za-z_$][\w$]*=[A-Za-z_$][\w$]*\.id,[A-Za-z_$][\w$]*=!1;for\(;[A-Za-z_$][\w$]*;\)\{.{0,200}?\}if\(([A-Za-z_$][\w$]*)&&!hkFifoWaiting\)continue;/g;
  const matches=[...source.matchAll(pattern)];if(matches.length!==1)throw Error('Expected exactly one unused FIFO ancestry scan, saw '+matches.length);
  source=source.replace(pattern,(match,flag)=>'if(!hkFifoWaiting){'+match.replace('if('+flag+'&&!hkFifoWaiting)','if('+flag+')')+'}');
  source='/* HK_FIFO_ANCESTRY_GUARD_V1 */\n'+source;changes++;
 }
 if(timingCache&&!source.includes('HK_FROZEN_GRAPH_TIMING_V1')){
  const pattern=/const hkFifoWaiting=([\w$]+)\.nodes\.every\(node=>node\.waiting_allowed!==false&&node\.wait_allowed!==false\)&&\1\.edges\.every\(edge=>edge\.waiting_allowed!==false&&edge\.wait_allowed!==false\);const ([\w$]+)=\[\.\.\.\1\.edges,([\w$]+)\.origin,\3\.destination\],([\w$]+)=\3\.departureS!==void 0&&\2\.some\(([\w$]+)=>([\w$]+)\(\5\)&&!([\w$]+)\(\5\)\)/g;
  const matches=[...source.matchAll(pattern)];if(matches.length!==1)throw Error('Expected exactly one static graph timing header, saw '+matches.length);
  const [full,graph,list,request,timed,item,hasSchedule,isAlwaysOpen]=matches[0];
  const indexMatches=[...source.matchAll(new RegExp('let ([\\w$]+)=([\\w$]+)\\?\\.get\\('+request.replaceAll('$','\\$')+'\\.preference\\);','g'))];
  if(indexMatches.length!==1)throw Error('Expected one prepared graph preference index, saw '+indexMatches.length);
  const [,index,prepared]=indexMatches[0];
  const replacement=`const hkTimingProfile=__hkSearchTimingProfile(${index},${graph},!!${prepared},${hasSchedule},${isAlwaysOpen});const hkFifoWaiting=hkTimingProfile.waitingAllowed;const ${list}=[...hkTimingProfile.scheduledEdges,${request}.origin,${request}.destination],${timed}=${request}.departureS!==void 0&&${list}.some(${item}=>${hasSchedule}(${item})&&!${isAlwaysOpen}(${item}))`;
  source='/* HK_FROZEN_GRAPH_TIMING_V1 */\n'+helper+'\n'+source.replace(full,replacement);changes++;
 }
 if(fifoOpeningScan&&!source.includes('HK_FIFO_OPENING_HORIZON_V1')){
  // Opening offsets are pure local arrays. In FIFO graphs this horizon is immediately
  // reset to zero, so calculating it cannot affect search states or opening checks.
  const pattern=/let ([\w$]+)=0;if\(([\w$]+)\)for\(const ([\w$]+) of ([\w$]+)\)for\(const ([\w$]+) of ([\w$]+)\(\3,([\w$]+)\.departureS,\7\.departureDate,([\w$]+)\)\)\1=Math\.max\(\1,\5\);if\(hkFifoWaiting\)\1=0;/g;
  const matches=[...source.matchAll(pattern)];if(matches.length!==1)throw Error('Expected exactly one discarded FIFO opening horizon, saw '+matches.length);
  source='/* HK_FIFO_OPENING_HORIZON_V1 */\n'+source.replace(pattern,(match,horizon,timed)=>match.replace('if('+timed+')','if('+timed+'&&!hkFifoWaiting)'));changes++;
 }
 return {source,changes};
}
/** Restore only this preparation transform for paired semantic-oracle tests. */
export function restoreSearchPreparation(source){
 if(source.includes('HK_FIFO_OPENING_HORIZON_V1')){
  const pattern=/let ([\w$]+)=0;if\(([\w$]+)&&!hkFifoWaiting\)for\(const ([\w$]+) of ([\w$]+)\)for\(const ([\w$]+) of ([\w$]+)\(\3,([\w$]+)\.departureS,\7\.departureDate,([\w$]+)\)\)\1=Math\.max\(\1,\5\);if\(hkFifoWaiting\)\1=0;/g;
  if([...source.matchAll(pattern)].length!==1)throw Error('Expected one FIFO opening horizon to restore');
  source=source.replace(pattern,(match,horizon,timed)=>match.replace('if('+timed+'&&!hkFifoWaiting)','if('+timed+')')).replace('/* HK_FIFO_OPENING_HORIZON_V1 */\n','');
 }
 if(!source.includes('HK_FROZEN_GRAPH_TIMING_V1'))return source;
 const pattern=/const hkTimingProfile=__hkSearchTimingProfile\(([\w$]+),([\w$]+),!!([\w$]+),([\w$]+),([\w$]+)\);const hkFifoWaiting=hkTimingProfile.waitingAllowed;const ([\w$]+)=\[\.\.\.hkTimingProfile.scheduledEdges,([\w$]+)\.origin,\7\.destination\]/g;
 const matches=[...source.matchAll(pattern)];if(matches.length!==1)throw Error('Expected one cache transform to restore');
 source=source.replace(pattern,(_full,index,graph,prepared,has,always,list,request)=>`const hkFifoWaiting=${graph}.nodes.every(node=>node.waiting_allowed!==false&&node.wait_allowed!==false)&&${graph}.edges.every(edge=>edge.waiting_allowed!==false&&edge.wait_allowed!==false);const ${list}=[...${graph}.edges,${request}.origin,${request}.destination]`);
 return source.replace('/* HK_FROZEN_GRAPH_TIMING_V1 */\n'+helper+'\n','');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const root=process.argv[2]??fileURLToPath(new URL('../',import.meta.url));
 for(const file of searchAssets){const path=root+'/dist/assets/'+file,old=readFileSync(path,'utf8'),result=patchSearchPreparation(old);if(result.changes)writeFileSync(path,result.source);console.log(file+': '+result.changes+' semantics-preserving preparation changes');}
}
