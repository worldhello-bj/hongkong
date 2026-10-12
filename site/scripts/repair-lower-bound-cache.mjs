import{readFileSync,writeFileSync}from'node:fs';import{fileURLToPath,pathToFileURL}from'node:url';
const helper=readFileSync(new URL('../src/navigation/compact-lower-bounds.js',import.meta.url),'utf8').replaceAll('export function compactLowerBounds','function __hkCompactLowerBounds').replaceAll('export function retainLowerBounds','function __hkRetainLowerBounds').replace('const result=compactLowerBounds(','const result=__hkCompactLowerBounds(');
export const lowerBoundAssets=['mobile-navigation-DfEsS_7b.js','app-walk-worker-jk5g-BMr.js','metro-worker-BDEusPKL.js','app-transit-worker-CaCMeUxU.js'];
const prefix='/* HK_COMPACT_LOWER_BOUND_CACHE_V1 */\n'+helper+'\n';
function priorHelperPrefix(source){
 const match=source.match(/\/\* HK_COMPACT_LOWER_BOUND_CACHE_V1 \*\/\n[\s\S]*?\n}\n[\s\S]*?\n}\n\n/);
 if(!match||!match[0].includes('function __hkCompactLowerBounds(')||!match[0].includes('function __hkRetainLowerBounds('))throw Error('Unrecognized lower-bound helper prefix');
 return match[0];
}
export function patchLowerBoundCache(source){
 if(source.includes('HK_COMPACT_LOWER_BOUND_CACHE_V1')){const prior=priorHelperPrefix(source);return {source:source.replace(prior,prefix),changes:prior===prefix?0:1};}
 const pattern=/([\w$]+)\.remainingCache\.size>=8&&\1\.remainingCache\.delete\(\1\.remainingCache\.keys\(\)\.next\(\)\.value\),\1\.remainingCache\.set\(([\w$]+),([\w$]+)\)/g;
 const matches=[...source.matchAll(pattern)];if(matches.length!==1)throw Error('Expected exactly one reverse-bound cache store');
 const graph=source.match(/const hkTimingProfile=__hkSearchTimingProfile\([\w$]+,([\w$]+),/)?.[1]??source.match(/const hkFifoWaiting=([\w$]+)\.nodes\.every/)?.[1];if(!graph)throw Error('Missing graph identity');
 source=source.replace(pattern,(_full,index,key,bounds)=>`${bounds}=__hkRetainLowerBounds(${index},${graph},${key},${bounds})`);
 return{source:prefix+source,changes:1};
}
export function restoreLowerBoundCache(source){
 if(!source.includes('HK_COMPACT_LOWER_BOUND_CACHE_V1'))return source;
 const pattern=/([\w$]+)=__hkRetainLowerBounds\(([\w$]+),[\w$]+,([\w$]+),\1\)/g;
 const matches=[...source.matchAll(pattern)];if(matches.length!==1)throw Error('Expected one compact cache store to restore');
 source=source.replace(pattern,(_full,bounds,index,key)=>`${index}.remainingCache.size>=8&&${index}.remainingCache.delete(${index}.remainingCache.keys().next().value),${index}.remainingCache.set(${key},${bounds})`);
 return source.replace(priorHelperPrefix(source),'');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const root=process.argv[2]??fileURLToPath(new URL('../',import.meta.url));for(const file of lowerBoundAssets){const path=root+'/dist/assets/'+file,result=patchLowerBoundCache(readFileSync(path,'utf8'));if(result.changes)writeFileSync(path,result.source);console.log(file+': '+result.changes+' lossless lower-bound cache changes')}
}
