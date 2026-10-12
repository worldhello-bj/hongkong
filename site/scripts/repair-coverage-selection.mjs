import {readFile,writeFile} from 'node:fs/promises';
for(const name of ['mobile-navigation-DfEsS_7b.js','app-walk-worker-jk5g-BMr.js','metro-worker-BDEusPKL.js','app-transit-worker-CaCMeUxU.js']){
 const file=new URL('../dist/assets/'+name,import.meta.url);let s=await readFile(file,'utf8');
 if(s.includes('HK_SELECTION_ENVELOPES'))continue;
 const regex=/const ([\w$]+)=([\w$]+)\.selection_bounds\?\?\2\.bounds;return\(!\1\|\|([\w$]+)\.lon>=\1\[0\]&&\3\.lat>=\1\[1\]&&\3\.lon<=\1\[2\]&&\3\.lat<=\1\[3\]\)/;
 if(!regex.test(s))throw Error('Coverage selector anchor drift '+name);
 s=s.replace(regex,(_,bound,region,point)=>`const ${bound}=${region}.selection_bounds??${region}.bounds;return(/* HK_SELECTION_ENVELOPES */${region}.selection_envelopes?.length?${region}.selection_envelopes.some(box=>${point}.lon>=box[0]&&${point}.lat>=box[1]&&${point}.lon<=box[2]&&${point}.lat<=box[3]):!${bound}||${point}.lon>=${bound}[0]&&${point}.lat>=${bound}[1]&&${point}.lon<=${bound}[2]&&${point}.lat<=${bound}[3])`);
 await writeFile(file,s);
}
// Shared station/area merge must retain the current public acquisition envelope.
for(const name of ['intermodal-routing-D8vKT-lN.js','app-transit-worker-CaCMeUxU.js']){
 const file=new URL('../dist/assets/'+name,import.meta.url);let s=await readFile(file,'utf8');
 if(s.includes('HK_PUBLIC_REGION_PRECEDENCE'))continue;
 const regex=/([\w$]+)\(\{\.\.\.([\w$]+),detailed_station_access:!0,nodes:/;
 const match=s.match(regex);if(!match)throw Error('Region merge anchor drift '+name);
 const index=s.lastIndexOf('function ',match.index),prefix=s.slice(index,match.index),args=prefix.match(/^function [\w$]+\(([\w$]+),([\w$]+)\)/);if(!args)throw Error('Merge args drift');
 const area=args[2];s=s.replace(regex,(_,prepare,station)=>`${prepare}({...${station},/* HK_PUBLIC_REGION_PRECEDENCE */regions:[...new Map([...${station}.regions,...${area}.regions].map(region=>[region.id,region])).values()],detailed_station_access:!0,nodes:`);
 await writeFile(file,s);
}
