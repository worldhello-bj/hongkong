import{readFileSync,writeFileSync}from'node:fs';const root=process.argv[2];if(!root)throw Error('Pass isolated/approved checkout');
for(const file of ['mobile-navigation-DfEsS_7b.js','app-walk-worker-jk5g-BMr.js','metro-worker-BDEusPKL.js','app-transit-worker-CaCMeUxU.js']){
 const path=root+'/dist/assets/'+file;let s=readFileSync(path,'utf8');if(s.includes('HK_MODELED_SOURCE_HEIGHT_SNAP_V1'))continue;
 const guard=s.match(/if\(([\w$]+)\.hkDemoSnapGuard&&!\1\.hkDemoSnapGuard\(\[([\w$]+)\.lon,\2.lat\],([\w$]+)\.coordinates\)\)continue;/);
 if(!guard)throw Error('Missing geography snap guard '+file);const [,index,request,candidate]=guard;
 s=s.replace(guard[0],guard[0]+`if(${index}.hkDemoSnapGuard&&Number.isFinite(${request}.demoSourceCoordinates?.[2])&&(!Number.isFinite(${candidate}.coordinates[2])||Math.abs(${candidate}.coordinates[2]-${request}.demoSourceCoordinates[2])>1))continue;`);
 writeFileSync(path,'/* HK_MODELED_SOURCE_HEIGHT_SNAP_V1 */\n'+s);
}
console.log('Modeled ground-source snaps retain source height; no graph edges added.');
