import {readFile,writeFile} from 'node:fs/promises';
for(const file of ['app-walk-worker-jk5g-BMr.js','mobile-navigation-DfEsS_7b.js','metro-worker-BDEusPKL.js','app-transit-worker-CaCMeUxU.js']){
 const url=new URL('../dist/assets/'+file,import.meta.url);let s=await readFile(url,'utf8');if(s.includes('HK_DEMO_SAFE_SNAP_V1'))continue;
 const index=s.match(/let ([\w$]+)=([\w$]+)\?\.get\(([\w$]+)\.preference\);\1\|\|\(\1=([\w$]+)\(([\w$]+),\3\.preference\),\2\?\.set\(\3\.preference,\1\)\);/);
 if(!index)throw Error('Missing walking index '+file);const [,idx,,,fn,graph]=index;
 s=s.replace(index[0],index[0]+`if(${graph}.demo_connector_geography&&!${idx}.hkDemoSnapGuard)${idx}.hkDemoSnapGuard=__hkConnectorGuard({geography:${graph}.demo_connector_geography,graph:${graph},barrierLines:${graph}.demo_connector_barriers??[]});`);
 const snap=s.match(/function ([\w$]+)\(([\w$]+),([\w$]+),([\w$]+),([\w$]+)\)\{const [^;]+\.snapCache\.get\([^;]+;if\([^;]+;let /);
 if(!snap)throw Error('Missing snap search '+file);const tail=s.slice(snap.index),candidate=tail.match(/const ([\w$]+)=([\w$]+)\(\[([\w$]+)\],([\w$]+)\);if\(!\1\)continue;/);
 if(!candidate)throw Error('Missing snap candidate '+file);const [,point,,,request]=candidate;
 const at=snap.index+candidate.index;s=s.slice(0,at)+candidate[0]+`if(${snap[2]}.hkDemoSnapGuard&&!${snap[2]}.hkDemoSnapGuard([${request}.lon,${request}.lat],${point}.coordinates))continue;`+s.slice(at+candidate[0].length);
 s='/* HK_DEMO_SAFE_SNAP_V1 */\nimport {createModeledConnectorGuard as __hkConnectorGuard} from "./integrated-navigation.js";\n'+s;
 await writeFile(url,s);console.log('Enabled guarded demo snapping:',file);
}
