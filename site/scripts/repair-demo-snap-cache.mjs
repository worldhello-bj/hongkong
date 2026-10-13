import{readFileSync,writeFileSync}from'node:fs';
import{fileURLToPath,pathToFileURL}from'node:url';
export const demoSnapCacheAssets=['app-walk-worker-jk5g-BMr.js','mobile-navigation-DfEsS_7b.js','metro-worker-BDEusPKL.js','app-transit-worker-CaCMeUxU.js'];
const marker='/* HK_DEMO_SNAP_CACHE_HEIGHT_V1 */\n';
const configs=[
 ['function at(t,e,n,o){','f=`${a}:${n.id}:${e.lon}:${e.lat}`','t','e'],
 ['function W4(e,r,i,t){','o=`${n}:${i.id}:${r.lon}:${r.lat}`','e','r'],
 ['function Et(t,e,n,o){','d=`${s}:${n.id}:${e.lon}:${e.lat}`','t','e'],
 ['function Et(t,e,o,n){','c=`${s}:${o.id}:${e.lon}:${e.lat}`','t','e'],
].map(([anchor,before,index,point])=>{const at=before.indexOf('='),name=before.slice(0,at),key=before.slice(at+1);return{anchor,before,after:`${name}=${index}.hkDemoSnapGuard?JSON.stringify([${key},Number.isFinite(${point}.demoSourceCoordinates?.[2])?${point}.demoSourceCoordinates[2]:null]):${key}`};});
function config(source){const matches=configs.filter(c=>source.includes(c.anchor));if(matches.length!==1)throw Error('Demo snap cache engine anchor drift');return matches[0];}
function once(source,a,b){if(source.split(a).length!==2)throw Error('Demo snap cache key anchor drift');return source.replace(a,b);}
export function restoreDemoSnapCache(source){if(!source.includes(marker))return source;if(source.split(marker).length!==2)throw Error('Demo snap cache marker drift');const c=config(source);return once(source,c.after,c.before).replace(marker,'');}
export function patchDemoSnapCache(source){if(source.includes(marker)){restoreDemoSnapCache(source);return{source,changes:0};}const c=config(source);if(source.includes(c.after))throw Error('Demo snap cache unmarked key');return{source:marker+once(source,c.before,c.after),changes:1};}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const root=process.argv[2]??fileURLToPath(new URL('../',import.meta.url));for(const file of demoSnapCacheAssets){const path=root+'/dist/assets/'+file,result=patchDemoSnapCache(readFileSync(path,'utf8'));if(result.changes)writeFileSync(path,result.source);console.log(file+': '+result.changes+' guarded snap-cache height changes');}}
