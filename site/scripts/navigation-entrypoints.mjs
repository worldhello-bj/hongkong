import {readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
export const NAVIGATION_ENTRYPOINTS=['index.html','area.html','metro.html','research.html'];
// These bundles only mounted the retired page roots. Shared maps, models, data and
// Workers are deliberately retained, even where a model is loaded dynamically.
export const RETIRED_UI_ASSETS=['main-C9YUgpRJ.js','area-BQzcy4cq.js','area-BFUvIpLC.css','metro-DbCkSPHF.js','metro-CW7flKEN.css','research-CfFgT8e-.js','research-KeN-us88.css'];
export async function migrateNavigationEntrypoints(root) {
  const html=await readFile(join(root,'src/navigation/index.html'),'utf8');
  for(const name of NAVIGATION_ENTRYPOINTS)await writeFile(join(root,'dist',name),html);
  for(const name of RETIRED_UI_ASSETS)await rm(join(root,'dist/assets',name),{force:true});
}
