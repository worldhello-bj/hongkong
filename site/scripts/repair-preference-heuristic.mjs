import{readFileSync,writeFileSync}from'node:fs';
const root=process.argv[2];if(!root)throw Error('Pass an isolated checkout or approved runtime directory');
for(const file of ['mobile-navigation-DfEsS_7b.js','app-walk-worker-jk5g-BMr.js','metro-worker-BDEusPKL.js','app-transit-worker-CaCMeUxU.js']){
 const path=root+'/dist/assets/'+file;let s=readFileSync(path,'utf8');if(s.includes('HK_PREFERENCE_ADMISSIBLE_HEURISTIC_V1'))continue;
 if(!s.includes('__hkPreferenceCost'))throw Error('Preference-aware walking engine required');
 const req=s.match(/JSON.stringify\(\[([\w$]+)\.origin,\1\.destination,\1\.mode\]\)/)?.[1];
 const lower=s.match(/([\w$]+)\.accessSide\?0:Math.max\(0,\(\1.edge.duration_s-\(\1.edge.lift_wait_s\?\?0\)\)\*\1.fraction\)/);
 if(!req||!lower)throw Error('Conservative heuristic location not found: '+file);
 const arc=lower[1],liftInfo=s.match(/function [\w$]+\(([\w$]+),[\w$]+,[\w$]+\)\{const [\w$]+=([\w$]+)\(\1.edge\),[\w$]+=!!\(/)?.[2];
 if(!liftInfo)throw Error('Missing actual lift continuity metadata');
 const duration=`Math.max(0,(${arc}.edge.duration_s-(${liftInfo}(${arc}.edge)?.wait??0))*${arc}.fraction)`;
 s=s.replace(lower[0],`${arc}.accessSide?0:__hkPreferenceCost(${arc}.edge,${duration},${req}.preference,{continuingLift:true,fraction:${arc}.fraction})`);
 writeFileSync(path,'/* HK_PREFERENCE_ADMISSIBLE_HEURISTIC_V1 */\n'+s);console.log('Changed only conservative reverse cost:',file);
}
