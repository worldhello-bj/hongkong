import{readFileSync,writeFileSync}from'node:fs';import{fileURLToPath,pathToFileURL}from'node:url';
export const intermodalRegionAssets=['intermodal-routing-D8vKT-lN.js','app-transit-worker-CaCMeUxU.js'];
const variants=[{anchor:'function ft(o,r,s,t,n){',pairs:[
 ['ee=(e,i)=>{const m=re(I,e);','ee=(e,i)=>{const m=re(I,e)??((e.node_id||e.node_ids?.length)&&d?re(d,e):undefined);'],
 ['const $=Z.get(S);return $?[$.coordinates]:[]','const $=Z.get(S)??p.get(S);return $?[$.coordinates]:[]'],
 ['&&re(I,{lon:S.coordinates[0],lat:S.coordinates[1]})?.id===m.id','&&(d?.portals?.find(portal=>portal.id===S.id)?.region_id??b.get(S.id)?.region_id??re(I,{lon:S.coordinates[0],lat:S.coordinates[1]})?.id)===m.id'],
 ['if(!re(I,e.origin)||!re(I,e.destination))','if(!(re(I,e.origin)||d&&re(d,e.origin))||!(re(I,e.destination)||d&&re(d,e.destination)))']
 ]},{anchor:'function jt(t,e,o,n,s){',pairs:[
 ['me=(i,m)=>{const v=Ie(E,i);','me=(i,m)=>{const v=Ie(E,i)??((i.node_id||i.node_ids?.length)&&c?Ie(c,i):undefined);'],
 ['const W=J.get(R);return W?[W.coordinates]:[]','const W=J.get(R)??d.get(R);return W?[W.coordinates]:[]'],
 ['&&Ie(E,{lon:R.coordinates[0],lat:R.coordinates[1]})?.id===v.id','&&(c?.portals?.find(portal=>portal.id===R.id)?.region_id??M.get(R.id)?.region_id??Ie(E,{lon:R.coordinates[0],lat:R.coordinates[1]})?.id)===v.id'],
 ['if(!Ie(E,i.origin)||!Ie(E,i.destination))','if(!(Ie(E,i.origin)||c&&Ie(c,i.origin))||!(Ie(E,i.destination)||c&&Ie(c,i.destination)))']
 ]}];
const marker='/* HK_INTERMODAL_EXACT_REGION_UNION_V1 */\n';
const variant=source=>{const v=variants.filter(v=>source.includes(v.anchor));if(v.length!==1)throw Error('Intermodal region owner anchor drift');return v[0]};
function replace(source,a,b){if(source.split(a).length!==2)throw Error('Intermodal region anchor drift '+a);return source.replace(a,b)}
export function restoreIntermodalEndpointRegion(source){if(!source.startsWith(marker)&&!source.includes(marker))return source;source=source.replace(marker,'');for(const [a,b]of variant(source).pairs)source=replace(source,b,a);return source;}
export function patchIntermodalEndpointRegion(source){const original=source;source=restoreIntermodalEndpointRegion(source);for(const [a,b]of variant(source).pairs)source=replace(source,a,b);source=marker+source;return{source,changes:source===original?0:1};}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const root=process.argv[2]??fileURLToPath(new URL('../',import.meta.url));for(const file of intermodalRegionAssets){const path=root+'/dist/assets/'+file,result=patchIntermodalEndpointRegion(readFileSync(path,'utf8'));if(result.changes)writeFileSync(path,result.source);console.log(file+': '+result.changes+' intermodal endpoint region union changes');}}
