import {readFile,writeFile} from 'node:fs/promises';
const file=new URL('../dist/assets/mobile-navigation-DfEsS_7b.js',import.meta.url);
let text=await readFile(file,'utf8');
const marker='/* HSR_PROCEDURAL_OVERVIEW_V1 */';
if(!text.includes(marker)){
 const target='function S2(e){if(e.kind==="station_overview")';
 if(!text.includes(target))throw new Error('High-speed overview hook changed');
 text=text.replace(target,`function S2(e){${marker}if(e.kind==="highspeed")return{title:"乘坐跨境高铁",symbol:"▣",note:e.context??e.guidance.label};if(e.kind==="procedure")return{title:"办理乘车手续",symbol:"◇",note:e.guidance.label+"。"+(e.context??"")};if(e.kind==="station_overview")`);
 text=text.replace('["rail","metro","bus","tram","taxi","bikeshare","parking"].includes(d.kind)','["rail","metro","bus","tram","taxi","bikeshare","parking","highspeed"].includes(d.kind)');
 await writeFile(file,text);
}
if(!text.includes('/* HSR_ONBOARD_WAIT_V1 */')){
 const target='if(e.kind==="wait")return{title:"在站点候车"';
 if(!text.includes(target))throw new Error('High-speed wait heading hook changed');
 text=text.replace(target,'/* HSR_ONBOARD_WAIT_V1 */if(e.kind==="wait"&&e.highSpeedProcedure==="onboard-wait")return{title:"车内等候发车",symbol:"◷",note:e.guidance.label};'+target);
 await writeFile(file,text);
}
console.log('High-speed procedural overview labels ready; no pedestrian turn instructions synthesized.');
