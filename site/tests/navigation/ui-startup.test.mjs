import test from 'node:test';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
const cases={highspeed:'cross-boundary high-speed timetable and real local connections','departure-time':'navigation departure changes one coherent traffic and result snapshot',traffic:'shared traffic simulation and independent route policy',metadata:'optional metadata stalls',block:'optional block detail stalls',land:'ordinary map-point access', 'retired-preference':'retired passenger preference migrates to ordinary', 'quote-failure':'simulated pricing fails'};
for(const [mode,label] of Object.entries(cases))test('full entry and Worker remain usable: '+label,{timeout:90000},async()=>{
 const {stdout}=await run(process.execPath,[new URL('./ui-harness.mjs',import.meta.url).pathname],{env:{...process.env,HK_BOOT_CASE:mode},timeout:85000,maxBuffer:2000000});console.log(stdout.trim());
});
