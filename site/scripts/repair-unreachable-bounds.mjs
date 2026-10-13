import{readFileSync,writeFileSync}from'node:fs';import{fileURLToPath,pathToFileURL}from'node:url';
export const unreachableBoundAssets=['mobile-navigation-DfEsS_7b.js','app-walk-worker-jk5g-BMr.js','metro-worker-BDEusPKL.js','app-transit-worker-CaCMeUxU.js'];
const marker=/\/\* HK_STATIC_UNREACHABLE_BEGIN \*\/[\s\S]*?\/\* HK_STATIC_UNREACHABLE_END \*\//g;
const one=(source,pattern,label)=>{const found=[...source.matchAll(pattern)];if(found.length!==1)throw Error('Expected one '+label+', saw '+found.length);return found[0]};
export function restoreUnreachableBounds(source){return source.replace(marker,'')}
/** A missing reverse distance proves no path in the time-relaxed directed graph.
 * Use the exact existing failure constructor/message. No finite bound, deadline,
 * preference or search-state approximation is used to reject a request.
 */
export function patchUnreachableBounds(source){
 const original=source;source=restoreUnreachableBounds(source);
 const[,bounds]=one(source,/let ([\w$]+)=[\w$]+\?[^;]*?\.remainingCache\.get\([\w$]+\):void 0;/g,'computed lower-bound lookup');
 const[,origin]=one(source,/([\w$]+)=[\w$]+\("__area_origin__"\),[\w$]+=[\w$]+\?\1:[\w$]+\("__area_destination__"\)/g,'origin root');
 const[,failure]=one(source,/if\(![\w$]+\.has\([\w$]+\)\)return ([\w$]+\("NO_ROUTE",[\s\S]*?\));const [\w$]+=\[\];for\(let/g,'unchanged no-route return');
 const[anchor]=one(source,/const [\w$]+=\{access:0,cost:0,tie:"",elapsed:0\}/g,'forward-search initialization');
 source=source.replace(anchor,`/* HK_STATIC_UNREACHABLE_BEGIN */if(${bounds}&&${bounds}.get(${origin})===undefined)return ${failure};/* HK_STATIC_UNREACHABLE_END */`+anchor);
 return{source,changes:source===original?0:1};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const root=process.argv[2]??fileURLToPath(new URL('../',import.meta.url));for(const file of unreachableBoundAssets){const path=root+'/dist/assets/'+file,result=patchUnreachableBounds(readFileSync(path,'utf8'));if(result.changes)writeFileSync(path,result.source);console.log(file+': '+result.changes+' proven static disconnection changes')}}
