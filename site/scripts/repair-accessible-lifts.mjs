// Preserve source barrier, eligibility, disabled and access-schedule guards.
// The recovered routing bundle accidentally excluded every lift by kind even
// when it was an enabled official wheelchair-eligible lift. Restrict the change
// to the accessible-profile exclusion set; keep the outdoor snap exclusion set.
import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../dist/assets/',import.meta.url);
const before='new Set(["stairs","escalator","lift","stairlift","travelator","rail","transfer","station_access","access_connector"])';
const after='new Set(["stairs","escalator","stairlift","travelator","rail","transfer","station_access","access_connector"])';
for(const file of ['mobile-navigation-DfEsS_7b.js','app-walk-worker-jk5g-BMr.js','app-transit-worker-CaCMeUxU.js','metro-worker-BDEusPKL.js']){
 const path=new URL(file,root);let source=await readFile(path,'utf8');
 if(source.includes(before)){if(source.split(before).length!==2)throw new Error('Ambiguous accessibility profile: '+file);source=source.replace(before,after);await writeFile(path,source);}
 else if(source.split(after).length!==2)throw new Error('Missing expected accessibility profile: '+file);
}
console.log('Accessible profile permits eligible enabled lifts; barriers, schedules and disabled facilities remain enforced.');
