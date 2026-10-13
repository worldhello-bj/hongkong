import{readFileSync,writeFileSync}from'node:fs';import{fileURLToPath}from'node:url';const root=process.argv[2]??fileURLToPath(new URL('../',import.meta.url));
for(const file of ['intermodal-routing-D8vKT-lN.js','app-transit-worker-CaCMeUxU.js']){
 const path=root+'/dist/assets/'+file;let s=readFileSync(path,'utf8');if(s.includes('HK_LOCAL_ACCESS_EVIDENCE_V1'))continue;
 const re=/const\{geometry:([\w$]+),\.\.\.([\w$]+)\}=([\w$]+);return\{\.\.\.\2,geometry_mode:"none",access_evidence:"UNVERIFIED",label:`前往站台入口/;
 const m=s.match(re);if(!m)throw Error('Missing station-access geometry stripping seam '+file);
 s=s.replace(m[0],m[0].replace('geometry_mode:"none"',`local_access_geometry:${m[1]}??${m[3]}.local_access_geometry,geometry_mode:"none"`));writeFileSync(path,'/* HK_LOCAL_ACCESS_EVIDENCE_V1 */\n'+s);
}
{
 const path=root+'/dist/assets/mobile-navigation-DfEsS_7b.js';let s=readFileSync(path,'utf8');if(!s.includes('HK_LOCAL_ACCESS_GUIDANCE_V1')){
 const re=/function ([\w$]+)\(([\w$]+),([\w$]+),([\w$]+)\)\{const ([\w$]+)=\[\];for\(const ([\w$]+) of \2.edge_ids\)\{const ([\w$]+)=\4.get\(\6\)\?\.shift\(\)/;const m=s.match(re);if(!m)throw Error('Missing per-leg geometry assembly');
 const arg=m[2],head=`function ${m[1]}(${m[2]},${m[3]},${m[4]}){`;
 s=s.replace(head,head+`if(${arg}.kind==="access_connector"){const local=${arg}.local_access_geometry??${arg}.geometry;return local?.type==="LineString"&&local.coordinates?.length>=2?{coordinates:local.coordinates.map(point=>[...point]),atoms:[]}:void 0;}`);writeFileSync(path,'/* HK_LOCAL_ACCESS_GUIDANCE_V1 */\n'+s);
 }
}
console.log('Synthetic endpoint guidance uses only its own local geometry evidence.');
