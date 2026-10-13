/** Dry by default. --run starts only the explicit, serial 16-cell acceptance matrix. */
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync,openSync,closeSync,unlinkSync,readdirSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {ROOT,FIXTURE,readJSON,digest,runtimeIdentity,fourPreferenceFixture,fourPreferenceCells,fourPreferencePlan} from './four-preference-fixture.mjs';
import {compareRetainedObservation} from './point-supplement-compare.mjs';
const args=process.argv.slice(2),arg=name=>args.find(a=>a.startsWith(name+'='))?.slice(name.length+1);
const base=resolve(arg('--dist')??process.env.HK_POINT_DIST??resolve(ROOT,'dist')),runtime=runtimeIdentity(base),fixture=fourPreferenceFixture();
if(arg('--runtime')&&arg('--runtime')!==runtime.version)throw Error('Requested runtime does not match the actual assets.');
const selected=fourPreferenceCells(),plan=fourPreferencePlan(runtime),out=resolve(arg('--out')??resolve(ROOT,`validation/four-preference-${runtime.version}-${runtime.signature.slice(0,12)}`));
if(!out.startsWith(resolve(ROOT,'validation/four-preference-')))throw Error('Outputs must stay within validation/four-preference-* ownership.');
const originalRuntimePath=resolve(ROOT,'validation/four-preference-baseline-fd323a328ba2/runtime');
const originalIdentityPath=resolve(ROOT,'validation/four-preference-baseline-fd323a328ba2/baseline-identity.json');
const originalRuntime=existsSync(originalRuntimePath)?runtimeIdentity(originalRuntimePath):existsSync(originalIdentityPath)?readJSON(originalIdentityPath).runtime:null;
if(!originalRuntime||originalRuntime.version!=='fd323a328ba2'||originalRuntime.signature!=='873b1fa9ad43b219db43a773240db455c4550647a7c78594dd05f3844dca1e46')throw Error('Original source runtime identity missing or changed. Restore baseline-identity.json before proceeding.');
const preservedSourceAssets=originalRuntime?Object.entries(originalRuntime.assets).filter(([p])=>/^(area|transit)\//.test(p)&&/\.(json|gz)$/.test(p)).map(([p,sha256])=>({path:p,baselineSha256:sha256,currentSha256:runtime.assets[p],unchanged:runtime.assets[p]===sha256})):null;
const sourcePreservation={baselineRuntime:originalRuntime?.version??null,assets:preservedSourceAssets,pass:preservedSourceAssets?.every(p=>p.unchanged)??null,scope:'Byte-identical area/station/block graphs and transit data preserve every original source node, edge, lift and facility-evidence field. This is not a wheelchair suitability claim.'};
console.log(JSON.stringify({...plan,dist:base,out,sourcePreservation,willRun:args.includes('--run')},null,2));
if(!args.includes('--run'))process.exit(0);
if(sourcePreservation.pass===false)throw Error('Source graphs/services changed relative to frozen fd323a328ba2. Review, do not silently remove or reinterpret real facility evidence.');
mkdirSync(out,{recursive:true});const summaryPath=resolve(out,'summary.json'),lock=resolve(ROOT,'validation/four-preference-run.lock');
const provenanceFiles=['four-preference-fixture.mjs','four-preference-harness.mjs','four-preference-audit.mjs','four-preference-run.mjs','point-matrix-audit.mjs'];
const harnessIdentity=Object.fromEntries(provenanceFiles.map(f=>[f,digest(readFileSync(resolve(ROOT,'tests/navigation',f)))]));
const previous=existsSync(summaryPath)?readJSON(summaryPath):null;
if(previous&&(previous.runtime.signature!==runtime.signature||JSON.stringify(previous.harnessIdentity)!==JSON.stringify(harnessIdentity)))throw Error('Existing observation uses a different runtime or audit. Pick a fresh output path.');
const report=previous??{schema:1,runtime,dist:base,fixtureSha256:digest(readFileSync(FIXTURE)),harnessIdentity,sourcePreservation,plan,startedAt:new Date().toISOString(),cells:[],limitations:['Two diagnostic real-point ODs; not territory-wide coverage.','Old observations are comparisons only and never count as a new-build observation.','Source suitability is not live facility verification.','Node DOM stand-in runs built production route/Worker code, not browser visual or device performance QA.']};
function historical(cell){
 const root=resolve(ROOT,'validation/point-matrix'),paths=readdirSync(root,{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>resolve(root,d.name,cell.id+'.json')).filter(existsSync);
 const matching=paths.map(path=>({path,result:readJSON(path)})).filter(({result:r})=>r.rowId===cell.rowId&&r.need===cell.need&&r.taxi===cell.taxi&&r.fixtureSha256===report.fixtureSha256&&JSON.stringify(r.request)===JSON.stringify(fixture.rows.find(row=>row.id===cell.rowId).request));
 return matching.sort((a,b)=>String(b.result.date).localeCompare(String(a.result.date)))[0];
}
function compareBaseline(before,after){
 const compatible=structuredClone(after),newKeys=['fourPassengerPreference','requestedPreference','effectivePreference','paidJourneyClock','unknownWheelchairEvidenceNotPromoted'];
 for(const c of compatible.candidates){delete c.fourPreferenceAudit;for(const key of newKeys)delete c.checks[key];c.pass=Object.values(c.checks).every(Boolean);}
 return compareRetainedObservation(before,compatible);
}
let fd;try{fd=openSync(lock,'wx');writeFileSync(fd,JSON.stringify({pid:process.pid,runtime:runtime.version,out,startedAt:report.startedAt}));}catch{throw Error('A four-preference matrix owns the resource lock. Check its owner before retrying.');}
try{
 for(const cell of selected){
  if(report.cells.some(c=>c.id===cell.id))continue;
  if(runtimeIdentity(base).signature!==runtime.signature)throw Error('Runtime changed. Stop mixed-build matrix.');
  const file=resolve(out,cell.id+'.json'),log=resolve(out,cell.id+'.log');if(existsSync(file))throw Error('Unindexed observation exists. Inspect before retrying: '+file);
  const start=performance.now(),child=spawnSync(process.execPath,['--max-old-space-size=768','tests/navigation/four-preference-harness.mjs'],{cwd:ROOT,env:{...process.env,HK_POINT_DIST:base,HK_POINT_RUNTIME:runtime.version,HK_POINT_ROW:cell.rowId,HK_NEED:cell.need,HK_TAXI:cell.taxi?'1':'0',HK_REPORT_PATH:file},timeout:fixture.externalWatchdogMs,encoding:'utf8',maxBuffer:2e6});
  const logText=(child.stdout??'')+'\n'+(child.stderr??'');writeFileSync(log,logText);
  const result=existsSync(file)?readJSON(file):null,classification=result?.classification??(/heap out of memory|memory limit|ERR_WORKER_OUT_OF_MEMORY/i.test(logText)?'resource-failure-oom':child.error?.code==='ETIMEDOUT'?'external-watchdog-inconclusive':child.signal==='SIGKILL'?'process-killed-resource-cause-unconfirmed':'harness-failure');
  const baseline=historical(cell),comparison=result&&baseline?compareBaseline(baseline.result,result):null;
  if(comparison)writeFileSync(resolve(out,cell.id+'.comparison.json'),JSON.stringify({baselinePath:relative(ROOT,baseline.path),baselineReportSha256:digest(readFileSync(baseline.path)),...comparison},null,2)+'\n');
  const accepted=classification==='completed-with-candidates'&&result.runtimeStable&&result.requestIdentityPreserved&&result.cancel?.pass&&result.candidates.every(c=>c.pass);
  report.cells.push({...cell,accepted,classification,state:result?.state,comparisonStatus:result?.comparisonStatus,exitCode:child.status,signal:child.signal,error:child.error?.message,processWallMs:performance.now()-start,report:result?cell.id+'.json':null,log:cell.id+'.log',firstResultMs:result?.firstResultMs??null,fullCandidateWallMs:result?.fullCandidateWallMs??null,candidateCount:result?.candidates.length??0,candidates:result?.candidates.map(c=>({id:c.id,kind:c.kind,minutes:c.minutes,cost:c.cost,pass:c.pass,failedChecks:Object.entries(c.checks).filter(([,v])=>!v).map(([k])=>k),usedLiftIds:c.fourPreferenceAudit?.facilities.filter(e=>e.kind==='lift').map(e=>e.id),unknownWheelchairEvidenceCount:c.fourPreferenceAudit?.unknownWheelchairEvidenceCount})),unavailable:result?.unavailable.map(c=>({id:c.id,failureStatus:c.failureStatus,incompleteReason:c.incompleteReason,message:c.message})),baseline:baseline?{path:relative(ROOT,baseline.path),runtime:baseline.result.runtime.version,date:baseline.result.date,inheritedFieldsEqual:comparison?.pass,differences:comparison?.differences}:null});
  report.observedCells=report.cells.length;report.expectedCells=16;report.acceptedCells=report.cells.filter(c=>c.accepted).length;report.finished=report.cells.length===16;report.pass=report.finished&&report.acceptedCells===16;report.updatedAt=new Date().toISOString();writeFileSync(summaryPath,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report.cells.at(-1)));
  if(['resource-failure-oom','process-killed-resource-cause-unconfirmed','runtime-changed-inconclusive','invariant-failure','worker-failure','harness-failure','incomplete-routing-error','planning-not-started'].includes(classification)){report.stoppedReason=classification;writeFileSync(summaryPath,JSON.stringify(report,null,2)+'\n');process.exitCode=1;break;}
 }
 if(!report.pass)process.exitCode=1;
}finally{closeSync(fd);unlinkSync(lock);}
