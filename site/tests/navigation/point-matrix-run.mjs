/** Safe default is a dry plan. --run explicitly starts one serial stage. */
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync,openSync,closeSync,unlinkSync} from 'node:fs';
import {resolve} from 'node:path';
import {ROOT,FIXTURE,readJSON,digest,cells,runtimeIdentity} from './point-matrix-fixture.mjs';
import {compareRetainedObservation} from './point-supplement-compare.mjs';
const args=process.argv.slice(2),stage=args.find(x=>x.startsWith('--stage='))?.split('=')[1]??'A';
if(!['A','B','all'].includes(stage))throw Error('Stage must be A, B or all.');
const preflight=args.includes('--preflight');
const baselineArg=args.find(x=>x.startsWith('--baseline='))?.slice(11),baseline=baselineArg?resolve(baselineArg):null;
const selectionPath=args.find(x=>x.startsWith('--selection='))?.slice(12),selection=selectionPath?readJSON(resolve(selectionPath)):null;
if(selection&&(!/^[a-z0-9-]+$/.test(selection.id)||!Array.isArray(selection.cellIds)||new Set(selection.cellIds).size!==selection.cellIds.length))throw Error('Invalid or duplicated explicit selection.');
const fixture=readJSON(FIXTURE),base=resolve(process.env.HK_POINT_DIST??resolve(ROOT,'dist')),runtime=runtimeIdentity(base),selected=cells(fixture,stage).filter(c=>(!preflight||c.need==='ordinary')&&(!selection||selection.cellIds.includes(c.id))),fixtureHash=digest(readFileSync(FIXTURE));
if(selection&&(selected.length!==selection.cellIds.length||selection.fixtureSha256!==fixtureHash))throw Error('Selection does not exactly match fixed fixture/stage.');
const plan={stage,preflight,runtime:runtime.version,signature:runtime.signature,cells:selected.length,rows:fixture.rows.filter(r=>selected.some(c=>c.rowId===r.id)).map(r=>({id:r.id,label:r.label,tags:r.tags})),execution:'Serial fresh process per cell, 768 MiB main heap + 384 MiB per Worker; heap limits are not an RSS cap.',windowMs:fixture.observationWindowMs,watchdogMs:fixture.externalWatchdogMs,maximumRouteObservationMinutes:selected.length*fixture.observationWindowMs/60000,maximumExternalWatchdogMinutes:selected.length*fixture.externalWatchdogMs/60000,sourceFloorLayer:'Separate lower-cost source graph check, never counted as S1/taxi coverage.',willRun:args.includes('--run')};
if(selection)plan.selection={id:selection.id,fixtureSha256:selection.fixtureSha256,baselineRuntime:selection.baselineRuntime,cellIds:selection.cellIds};
console.log(JSON.stringify(plan,null,2));if(!args.includes('--run'))process.exit(0);
const out=resolve(ROOT,'validation/point-matrix',`${runtime.version}-${runtime.signature.slice(0,12)}`),lock=resolve(ROOT,'validation/point-matrix/.run-lock');mkdirSync(out,{recursive:true});

const summaryPath=resolve(out,`summary-${stage}${preflight?'-preflight':''}${selection?'-selection-'+selection.id:''}.json`),saved=existsSync(summaryPath)?readJSON(summaryPath):null;
if(saved&&(saved.fixtureSha256!==fixtureHash||saved.runtime.signature!==runtime.signature))throw Error('Saved matrix provenance differs; choose a fresh output location.');
const report=saved??{schema:1,runtime,fixtureSha256:fixtureHash,plan,startedAt:new Date().toISOString(),cells:[]};
let fd;try{fd=openSync(lock,'wx');writeFileSync(fd,JSON.stringify({pid:process.pid,runtime:runtime.version,startedAt:new Date().toISOString()}));}catch{throw Error('Point matrix lock exists. Inspect its owner before removing; do not run concurrent matrices.');}
try{
 for(const cell of selected){
  if(report.cells.some(c=>c.id===cell.id))continue; // Never silently replace an inconclusive/OOM observation.
  if(runtimeIdentity(base).signature!==runtime.signature)throw Error('Production runtime changed; stop mixed-build matrix.');
  const file=resolve(out,`${cell.id}.json`),log=resolve(out,`${cell.id}.log`),start=performance.now();
  const existing=existsSync(file)?readJSON(file):null;
  if(existing&&(existing.runtime.signature!==runtime.signature||existing.fixtureSha256!==fixtureHash||existing.rowId!==cell.rowId||existing.need!==cell.need||existing.taxi!==cell.taxi))throw Error('Existing cell provenance mismatch: '+file);
  const child=existing?{status:0,reused:true}:spawnSync(process.execPath,['--max-old-space-size=768','tests/navigation/point-matrix-harness.mjs'],{cwd:ROOT,env:{...process.env,HK_POINT_DIST:base,HK_POINT_RUNTIME:runtime.version,HK_POINT_ROW:cell.rowId,HK_NEED:cell.need,HK_TAXI:cell.taxi?'1':'0',HK_REPORT_PATH:file},timeout:fixture.externalWatchdogMs,encoding:'utf8',maxBuffer:2e6});
  const text=(child.stdout??'')+'\n'+(child.stderr??'');if(!existing)writeFileSync(log,text);
  const result=existing??(existsSync(file)?readJSON(file):null);
  const classification=result&&!Number.isFinite(result.performance?.startedMonotonic)?'planning-not-started':result?.classification??(/heap out of memory|memory limit|ERR_WORKER_OUT_OF_MEMORY/i.test(text)?'resource-failure-oom':child.error?.code==='ETIMEDOUT'?'external-watchdog-inconclusive':child.signal==='SIGKILL'?'process-killed-resource-cause-unconfirmed':'harness-failure');
  let retainedComparison;
  if(baseline&&result){const before=readJSON(resolve(baseline,`${cell.id}.json`));if(selection&&(before.runtime.version!==selection.baselineRuntime||before.runtime.signature!==selection.baselineSignature))throw Error('Supplement baseline provenance mismatch');retainedComparison=compareRetainedObservation(before,result);writeFileSync(resolve(out,`${cell.id}.comparison.json`),JSON.stringify(retainedComparison,null,2)+'\n');}
  report.cells.push({...cell,retainedComparison,reused:!!existing,classification,exitCode:child.status,signal:child.signal,error:child.error?.message,processWallMs:performance.now()-start,report:result?`${cell.id}.json`:null,log:`${cell.id}.log`,state:result?.state,comparisonStatus:result?.comparisonStatus,failedStages:result?.failedStages,stoppedWallMs:result?.stoppedWallMs??null,firstResultMs:result?.firstResultMs??null,fullCandidateWallMs:classification==='planning-not-started'?null:result?.fullCandidateWallMs??null,candidates:result?.candidates.length??null,failedChecks:result?.candidates.filter(c=>!c.pass).map(c=>({id:c.id,checks:c.checks}))});
  report.observedCells=report.cells.length;report.expectedCells=selected.length;report.finished=report.cells.length===selected.length;report.updatedAt=new Date().toISOString();writeFileSync(summaryPath,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report.cells.at(-1)));
  if(retainedComparison&&!retainedComparison.pass){console.error('Stopping supplement after a retained candidate/request difference; diagnosis required.');process.exitCode=1;break;}
  if(result?.sourceCoverageReview?.length){console.error('Stopping stage for unexpected exact-source coverage rejection; diagnosis required.');process.exitCode=1;break;}
  if(['resource-failure-oom','process-killed-resource-cause-unconfirmed','runtime-changed-inconclusive','invariant-failure','worker-failure','harness-failure','incomplete-routing-error','planning-not-started'].includes(classification)){console.error('Stopping stage after structural/resource/provenance failure. Remaining cells are not run.');process.exitCode=1;break;}
 }
}finally{closeSync(fd);unlinkSync(lock);}
