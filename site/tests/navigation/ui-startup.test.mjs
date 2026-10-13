import test from 'node:test';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
for(const mode of ['metadata','block','land','accessible','quote-failure'])test('full entry and Worker remain usable when optional '+mode+' stalls',{timeout:90000},async()=>{
 const {stdout}=await run(process.execPath,[new URL('./ui-harness.mjs',import.meta.url).pathname],{env:{...process.env,HK_BOOT_CASE:mode},timeout:85000,maxBuffer:2000000});console.log(stdout.trim());
});
