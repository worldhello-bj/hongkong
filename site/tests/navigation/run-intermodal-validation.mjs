import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),out=root+'validation/intermodal';mkdirSync(out,{recursive:true});
const cases=['覆盖走廊金钟至柯士甸','覆盖走廊柯士甸至金钟','覆盖走廊港岛接驳至柯士甸','覆盖电车走廊','覆盖九龙公交走廊','缺失荃湾线诊断金钟至旺角'];
const report={runtime:JSON.parse(readFileSync(root+'dist/build-meta.json')).version,method:'Each actual routing comparison runs in a fresh process; 120s diagnostic watchdog, 384MiB per routing Worker; watchdog means inconclusive, never application no-route. No browser visual claim.',cases:[]};
for(let i=0;i<cases.length;i++){
 const file=out+'/case-'+(i+1)+'.json',log=out+'/case-'+(i+1)+'.log';
 const child=spawnSync(process.execPath,['--max-old-space-size=768','tests/navigation/intermodal-comparison.mjs'],{cwd:root,env:{...process.env,HK_COMPARE:cases[i],HK_REPORT_PATH:file},timeout:120000,encoding:'utf8',maxBuffer:8e6});
 writeFileSync(log,(child.stdout??'')+'\n'+(child.stderr??''));
 const result={name:cases[i],status:child.error?'diagnostic-inconclusive':child.status===0?'completed':'failed',exitCode:child.status,signal:child.signal,error:child.error?.message,...existsSync(file)?{result:JSON.parse(readFileSync(file)).rows[0]}:{}};
 report.cases.push(result);writeFileSync(out+'/summary.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({name:result.name,status:result.status,exitCode:result.exitCode,ms:result.result?.ms,candidates:result.result?.candidates.length}));
}
