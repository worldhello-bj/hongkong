/** Correct a geographic overclaim; never modify the region routing guard. */
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export const oldMessage='当前两区之间没有可用的跨海步行路线，请选择“乘地铁”或将起终点设在同一区域。';
export const refusalMessage='当前已载入路网未提供这两个来源区域之间的完整步行连接；这不代表现实中必须跨海。可尝试公共交通联程，或明确选择其他已覆盖入口。';
export const repairRegionRefusalText=source=>source.replaceAll(oldMessage,refusalMessage);
export async function repairRegionRefusalMessages(){
 for(const name of ['mobile-navigation-DfEsS_7b.js','metro-worker-BDEusPKL.js','app-walk-worker-jk5g-BMr.js','app-transit-worker-CaCMeUxU.js']){
  const url=new URL('../dist/assets/'+name,import.meta.url),source=await readFile(url,'utf8');
  if(!source.includes(oldMessage)&&!source.includes(refusalMessage))throw Error('Region refusal message missing: '+name);
  await writeFile(url,repairRegionRefusalText(source));
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await repairRegionRefusalMessages();
