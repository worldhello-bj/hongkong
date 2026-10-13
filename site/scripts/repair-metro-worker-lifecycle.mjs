import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
export function patchMetroWorkerLifecycle(source){
 if(source.includes('HK_IDLE_METRO_OWNER_V1'))return source;
 const checks=[['C.set(e,r);const l=r;','C.set(e,r);hkMetroOwners.set(e,r);const l=r;'],['n.terminate(),C.delete(e);','n.terminate(),C.delete(e),hkMetroOwners.delete(e);'],['a.worker.terminate(),C.get(e)===a&&C.delete(e);','a.worker.terminate(),C.get(e)===a&&C.delete(e);if(hkMetroOwners.get(e)===a)hkMetroOwners.delete(e);']];
 for(const [before,after]of checks){if(source.split(before).length!==2)throw Error('Metro lifecycle source drift: '+before);source=source.replace(before,after);}
 return '/* HK_IDLE_METRO_OWNER_V1 */\nconst hkMetroOwners=new Map;\nexport function disposeIdleMetroWorkers(){for(const [graph,owner] of hkMetroOwners){if(owner.pending.size)continue;owner.worker.terminate();if(C.get(graph)===owner)C.delete(graph);hkMetroOwners.delete(graph);}}\n'+source;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const path=new URL('../dist/assets/metro-planning-CBAOotPX.js',import.meta.url);
 await writeFile(path,patchMetroWorkerLifecycle(await readFile(path,'utf8')));
}
