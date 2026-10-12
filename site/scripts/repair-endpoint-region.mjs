import{readFileSync,writeFileSync}from'node:fs';import{fileURLToPath,pathToFileURL}from'node:url';
export const endpointRegionAssets=['mobile-navigation-DfEsS_7b.js','app-walk-worker-jk5g-BMr.js','metro-worker-BDEusPKL.js','app-transit-worker-CaCMeUxU.js'];
const helper=readFileSync(new URL('../src/navigation/endpoint-region.js',import.meta.url),'utf8').replace('export function exactSourceRegion','function __hkExactSourceRegion');
const prefix='/* HK_EXACT_ENDPOINT_REGION_V1 */\n'+helper+'\n/* END_HK_EXACT_ENDPOINT_REGION_V1 */\n';
const prefixPattern=/\/\* HK_EXACT_ENDPOINT_REGION_V1 \*\/\n[\s\S]*?\/\* END_HK_EXACT_ENDPOINT_REGION_V1 \*\/\n/;
const guard=/const hkExactRegion=(?:[\w$]+&&[\w$]+\(\[[\w$]+.lon,[\w$]+.lat\]\)\?)?__hkExactSourceRegion\(([\w$]+),([\w$]+)\)(?::null)?;if\(hkExactRegion\)return hkExactRegion.region;/;
export function restoreEndpointRegion(source){
 if(!source.includes('HK_EXACT_ENDPOINT_REGION_V1'))return source;
 if(!prefixPattern.test(source)||!guard.test(source))throw Error('Exact region restore anchor drift');
 return source.replace(prefixPattern,'').replace(guard,'');
}
export function patchEndpointRegion(source){
 const prior=source;source=restoreEndpointRegion(source);
 const selector=/function ([\w$]+)\(([\w$]+),([\w$]+)\)\{(?=if\(!\(!\3\|\|!([\w$]+)\(\[\3.lon,\3.lat\]\)\)\)return \2.regions.find\()/;
 if([...source.matchAll(new RegExp(selector.source,'g'))].length!==1)throw Error('Expected exactly one geographic region selector');
 source=prefix+source.replace(selector,(_,name,g,p,valid)=>`function ${name}(${g},${p}){const hkExactRegion=${p}&&${valid}([${p}.lon,${p}.lat])?__hkExactSourceRegion(${g},${p}):null;if(hkExactRegion)return hkExactRegion.region;`);
 return {source,changes:source===prior?0:1};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const root=process.argv[2]??fileURLToPath(new URL('../',import.meta.url));
 for(const file of endpointRegionAssets){const path=root+'/dist/assets/'+file,result=patchEndpointRegion(readFileSync(path,'utf8'));if(result.changes)writeFileSync(path,result.source);console.log(file+': '+result.changes+' exact endpoint region changes');}
}
