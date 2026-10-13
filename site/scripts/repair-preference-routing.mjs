import{readFile,writeFile}from'node:fs/promises';
for(const file of ['mobile-navigation-DfEsS_7b.js','app-walk-worker-jk5g-BMr.js','metro-worker-BDEusPKL.js','app-transit-worker-CaCMeUxU.js']){
 const url=new URL('../dist/assets/'+file,import.meta.url);let s=await readFile(url,'utf8');if(s.includes('HK_PREFERENCE_ROUTING_V1'))continue;
 s=s.replace(/hkFifoWaiting=([\w$]+)\.preference==="fast"&&/,'hkFifoWaiting=');
 const dominance=s.match(/([\w$]+)=\(([\w$]+),([\w$]+)\)=>\2\.access<=\3\.access\+1e-9&&[^;]+?;for\(/);
 if(!dominance)throw Error('Missing dominance '+file);const tail=dominance[0],body=tail.slice(tail.indexOf('=>')+2,tail.lastIndexOf(';for(')),tie=body.match(/([\w$]+)\(\w+\.tie,\w+\.tie\)/)?.[1];
 if(!tie)throw Error('Missing tie comparator '+file);s=s.replace(tail,`${dominance[1]}=(${dominance[2]},${dominance[3]})=>hkFifoWaiting?__hkWaitingDominates(${dominance[2]},${dominance[3]},${tie}):(${body});for(`);
 const allowed=s.match(/function ([\w$]+)\(([\w$]+),([\w$]+)\)\{return \2\.disabled\|\|\2\.access_time_id!=null&&!([\w$]+)\(\2\)\|\|\(\3==="escalator_first"\|\|\3==="lift_first"\)[^}]+?\}/);
 if(!allowed)throw Error('Missing facility rule '+file);const [,name,edge,pref,parsed]=allowed;const accessible=allowed[0].slice(allowed[0].indexOf(`:${pref}!=="accessible"`)+1,-1);
 s=s.replace(allowed[0],`function ${name}(${edge},${pref}){return ${edge}.disabled||${edge}.access_time_id!=null&&!${parsed}(${edge})||!__hkPreferenceAllows(${edge},${pref})?!1:${accessible}}`);
 s=s.replaceAll('["fast","few_stairs","accessible","escalator_first","lift_first"]','["fast","few_stairs","accessible","escalator_first","lift_first","luggage"]');
 const metric=s.match(/cost:([\w$]+)\*\(([\w$]+)==="few_stairs"&&([\w$]+)\.edge\.kind==="stairs"\?3:1\)\+([\w$]+),ride:/);
 if(!metric)throw Error('Missing preference metric '+file);const near=s.slice(Math.max(0,metric.index-250),metric.index),same=near.match(/([\w$]+)=!!\(/)?.[1];
 if(!same)throw Error('Missing lift continuity '+file);s=s.replace(metric[0],`cost:__hkPreferenceCost(${metric[3]}.edge,${metric[1]},${metric[2]},{continuingLift:${same},fraction:${metric[3]}.fraction}),ride:`);
 s='/* HK_PREFERENCE_ROUTING_V1 */\nimport {preferenceCost as __hkPreferenceCost,preferenceAllows as __hkPreferenceAllows,waitingLabelDominates as __hkWaitingDominates} from "./preference-routing.js";\n'+s;
 await writeFile(url,s);console.log('Enabled distinct FIFO preferences:',file);
}
for(const file of ['metro-worker-BDEusPKL.js','metro-planning-CBAOotPX.js']){
 const url=new URL('../dist/assets/'+file,import.meta.url);let s=await readFile(url,'utf8');s=s.replaceAll('luggage:"lift_first"','luggage:"luggage"').replace(/([\w$]+)==="luggage"\|\|\1==="lift"\?"lift_first"/g,'$1==="luggage"?"luggage":$1==="lift"?"lift_first"').replaceAll('大件行李采用升降机优先，并排除楼梯和扶梯；未知设施及升降机运行状态仍需现场确认。','行李模式优先减少搬运与步行；含楼梯或扶梯的备选需搬运行李，大件行李请优先改用升降机并确认设施条件。');await writeFile(url,s);
}
for(const file of ['intermodal-routing-D8vKT-lN.js','app-transit-worker-CaCMeUxU.js']){
 const url=new URL('../dist/assets/'+file,import.meta.url);let s=await readFile(url,'utf8');if(s.includes('HK_PUBLIC_PREFERENCE_COST_V1'))continue;
 const penalty=s.match(/([\w$]+)&&\(([\w$]+)==="escalator_first"&&\(([\w$]+)=\{\.\.\.\3,preferencePenaltyS:90\*([\w$]+)\(\1\.legs\)\.lifts\}\),/);
 if(!penalty)throw Error('Missing public preference cost '+file);
 s=s.replace(penalty[0],`${penalty[1]}&&((${penalty[3]}={...${penalty[3]},preferencePenaltyS:__hkConnectionPenalty(${penalty[1]}.legs,${penalty[2]})}),`);
 s=s.replace(/([\w$]+)===\"escalator_first\"\|\|\1===\"lift_first\"/g,'$1==="escalator_first"||$1==="lift_first"||$1==="luggage"');
 s='/* HK_PUBLIC_PREFERENCE_COST_V1 */\nimport {preferenceConnectionPenalty as __hkConnectionPenalty} from "./preference-routing.js";\n'+s;await writeFile(url,s);
}
for(const file of ['intermodal-routing-D8vKT-lN.js','app-transit-worker-CaCMeUxU.js']){
 const url=new URL('../dist/assets/'+file,import.meta.url);let s=await readFile(url,'utf8');if(s.includes('HK_PUBLIC_BAGGAGE_BANS_V1'))continue;
 const preference=s.match(/async route\(([\w$]+),[\w$]+\)\{[^;]+;const ([\w$]+)=\1.preference\?\?"fast"/);
 const edge=s.match(/return!([\w$]+)\|\|\1.disabled\|\|\1.access_time_id!=null/);
 if(!preference||!edge)throw Error('Missing cached baggage check '+file);
 s=s.replace(edge[0],edge[0]+`||!__hkPublicAllows(${edge[1]},${preference[2]})`);
 s='/* HK_PUBLIC_BAGGAGE_BANS_V1 */\nimport {preferenceAllows as __hkPublicAllows} from "./preference-routing.js";\n'+s;await writeFile(url,s);
}
for(const file of ['mobile-navigation-DfEsS_7b.js','app-walk-worker-jk5g-BMr.js','metro-worker-BDEusPKL.js','app-transit-worker-CaCMeUxU.js']){
 const url=new URL('../dist/assets/'+file,import.meta.url);const s=await readFile(url,'utf8');await writeFile(url,s.replaceAll('设施偏好模式排除已知楼梯及楼梯升降台；','设施偏好按时间与搬运负担排序，楼梯或扶梯可能作为备选；'));
}
