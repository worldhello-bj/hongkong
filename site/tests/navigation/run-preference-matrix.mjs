import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),out=root+'validation/preference-matrix';mkdirSync(out,{recursive:true});
const ids=[1,7,12,19,25,36],needs=['ordinary','luggage','escalator','lift','accessible'];
const report={runtime:JSON.parse(readFileSync(root+'dist/build-meta.json')).version,selection:'Six fixed systematic indices 1,7,12,19,25,36 from prior seed-20261011 land-sampled 36 OD fixture, without success filtering. All five preferences with optional taxi enabled. 60s observation window and 90s external watchdog; pending refinement is reported, not a pass.',rows:[]};
const saved=existsSync(out+'/summary.json')?JSON.parse(readFileSync(out+'/summary.json')):null;if(saved?.runtime===report.runtime)report.rows=saved.rows;
for(const id of ids)for(const need of needs){
 const previous=report.rows.find(r=>r.id===id&&r.need===need);if(previous?.status==='observed')continue;
 const file=out+`/${id}-${need}.json`,log=out+`/${id}-${need}.log`;
 const child=spawnSync(process.execPath,['--max-old-space-size=768','tests/navigation/preference-matrix-harness.mjs'],{cwd:root,env:{...process.env,HK_MATRIX_OD:String(id),HK_NEED:need,HK_REPORT_PATH:file},timeout:90000,encoding:'utf8',maxBuffer:8e6});
 writeFileSync(log,(child.stdout??'')+'\n'+(child.stderr??''));
 const row={id,need,status:child.error?'diagnostic-inconclusive':child.status===0?'observed':'failed',exitCode:child.status,signal:child.signal,error:child.error?.message,...existsSync(file)?{result:JSON.parse(readFileSync(file))}:{}};
 if(previous){row.previousAttempts=[...(previous.previousAttempts??[]),{status:previous.status,signal:previous.signal,error:previous.error}];report.rows[report.rows.indexOf(previous)]=row;}else report.rows.push(row);writeFileSync(out+'/summary.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({id,need,status:row.status,state:row.result?.state,firstMs:row.result?.performance?.firstResultMs,candidates:row.result?.candidates.length,invariants:row.result?.invariants}));
}
