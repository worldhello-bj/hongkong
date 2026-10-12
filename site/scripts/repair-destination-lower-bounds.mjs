import{readFileSync,writeFileSync}from'node:fs';import{fileURLToPath,pathToFileURL}from'node:url';
export const destinationLowerBoundAssets=['mobile-navigation-DfEsS_7b.js','app-walk-worker-jk5g-BMr.js','metro-worker-BDEusPKL.js','app-transit-worker-CaCMeUxU.js'];
const helper=readFileSync(new URL('../src/navigation/destination-lower-bounds.js',import.meta.url),'utf8').replace('export function destinationLowerBounds','function __hkDestinationLowerBounds');
const prefix='/* HK_DESTINATION_LOWER_BOUNDS_V1 */\n'+helper+'\n/* END_HK_DESTINATION_LOWER_BOUNDS_V1 */\n';
const helperPattern=/\/\* HK_DESTINATION_LOWER_BOUNDS_V1 \*\/\n[\s\S]*?\/\* END_HK_DESTINATION_LOWER_BOUNDS_V1 \*\/\n/;
const queryPattern=/\/\* HK_DESTINATION_QUERY_BEGIN \*\/[\s\S]*?\/\* HK_DESTINATION_QUERY_END \*\//g;
const one=(source,pattern,label)=>{const matches=[...source.matchAll(pattern)];if(matches.length!==1)throw Error('Expected exactly one '+label+', saw '+matches.length);return matches[0];};
export function patchDestinationLowerBounds(source){
 if(source.includes('HK_DESTINATION_LOWER_BOUNDS_V1')){
  const prior=source.match(helperPattern)?.[0];if(!prior||[...source.matchAll(queryPattern)].length!==1)throw Error('Unrecognized destination lower-bound transform');
  return{source:source.replace(prior,prefix),changes:prior===prefix?0:1};
 }
 if(!source.includes('function __hkCompactLowerBounds('))throw Error('Compact lower-bound cache must be installed first');
 const [,index,graph,prepared]=one(source,/const hkTimingProfile=__hkSearchTimingProfile\(([\w$]+),([\w$]+),!!([\w$]+),[\w$]+,[\w$]+\)/g,'prepared graph timing profile');
 const [lookup,bounds,timed,lookupIndex,key]=one(source,/let ([\w$]+)=([\w$]+)\?([\w$]+)\.remainingCache\.get\(([\w$]+)\):void 0;/g,'reverse lower-bound lookup');
 if(lookupIndex!==index)throw Error('Mismatched reverse lower-bound index');
 const [,origin,allocator,destination,,overlay]=one(source,/([\w$]+)=([\w$]+)\("__area_origin__"\),([\w$]+)=([\w$]+)\?\1:\2\("__area_destination__"\),([\w$]+)=new Map/g,'endpoint overlay identities');
 const [,originCandidates]=one(source,/([\w$]+)=[\w$]+\.map\(\([\w$]+,([\w$]+)\)=>\(\{candidate:[\w$]+,id:[\w$]+\.node_id\?\?[\w$]+\(`__origin_candidate_\$\{\2\}__`\)\}\)\)/g,'origin candidate list');
 const [,destinationCandidates]=one(source,/([\w$]+)=[\w$]+\.map\(\([\w$]+,([\w$]+)\)=>\(\{candidate:[\w$]+,id:[\w$]+\.node_id\?\?[\w$]+\(`__destination_candidate_\$\{\2\}__`\)\}\)\)/g,'destination candidate list');
 const [,request,excluded,arc,weight,expression]=one(source,/if\(([\w$]+)\.mode==="walk"&&([\w$]+)\.has\(([\w$]+)\.edge\.kind\)\)continue;const ([\w$]+)=(\3\.accessSide\?0:__hkPreferenceCost\([\s\S]*?\{continuingLift:true,fraction:\3\.fraction\}\)),[\w$]+=[\w$]+\.get\(\3\.to\)\?\?\[\]/g,'unchanged reverse edge cost');
 const [,heap]=one(source,/const [\w$]+=new ([\w$]+);for\([\w$]+\.push\(\{id:[\w$]+,access:0,cost:0,tie:""\}\);[\w$]+\.length;\)/g,'reverse Dijkstra heap');
 const call=`__hkDestinationLowerBounds(${index},${graph},{prepared:!!${prepared},originId:${origin},destinationId:${destination},originCandidates:${originCandidates},destinationCandidates:${destinationCandidates},overlay:${overlay},mode:${request}.mode,destinationKey:JSON.stringify([${request}.destination,${request}.mode]),seconds:${arc}=>${expression},skip:${arc}=>${request}.mode==="walk"&&${excluded}.has(${arc}.edge.kind),Heap:${heap},compact:__hkCompactLowerBounds})`;
 const replacement=`let ${bounds}=${timed}?/* HK_DESTINATION_QUERY_BEGIN */${call}??/* HK_DESTINATION_QUERY_END */${index}.remainingCache.get(${key}):void 0;`;
 return{source:prefix+source.replace(lookup,replacement),changes:1};
}
export function restoreDestinationLowerBounds(source){
 if(!source.includes('HK_DESTINATION_LOWER_BOUNDS_V1'))return source;
 if(!source.match(helperPattern)||[...source.matchAll(queryPattern)].length!==1)throw Error('Unrecognized destination lower-bound transform to restore');
 return source.replace(helperPattern,'').replace(queryPattern,'');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const root=process.argv[2]??fileURLToPath(new URL('../',import.meta.url));
 for(const file of destinationLowerBoundAssets){const path=root+'/dist/assets/'+file,result=patchDestinationLowerBounds(readFileSync(path,'utf8'));if(result.changes)writeFileSync(path,result.source);console.log(file+': '+result.changes+' exact destination lower-bound changes');}
}
