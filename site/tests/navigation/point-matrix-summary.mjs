/** Read-only aggregation of the 60-cell matrix. Never routes or promotes pending to success. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,basename} from 'node:path';
import {pathToFileURL} from 'node:url';
import {FIXTURE,readJSON,digest,cells} from './point-matrix-fixture.mjs';

export function summarizeMatrix(directory,fixture=readJSON(FIXTURE)){
 const fixtureSha256=digest(readFileSync(FIXTURE)),expected=cells(fixture,'all'),rows=[];let runtime;
 for(const cell of expected){
  const path=resolve(directory,cell.id+'.json');
  if(!existsSync(path)){rows.push({...cell,classification:'not-observed'});continue;}
  const raw=readJSON(path),notStarted=raw.planningStarted===false||!Number.isFinite(raw.performance?.startedMonotonic);
  const r=notStarted?{...raw,classification:'planning-not-started',fullCandidateWallMs:null}:raw;
  if(r.fixtureSha256!==fixtureSha256||r.rowId!==cell.rowId||r.need!==cell.need||r.taxi!==cell.taxi)throw Error('Cell provenance mismatch: '+path);
  if(runtime&&runtime.signature!==r.runtime.signature)throw Error('Mixed runtimes in matrix directory');runtime??=r.runtime;
  const completed=r.classification==='completed-with-candidates'&&r.comparisonStatus==='complete'&&r.candidates.length>0&&r.candidates.every(c=>c.pass)&&r.cancel.pass;
  rows.push({...cell,classification:r.classification,recordedClassification:raw.classification,recordedFullCandidateWallMs:raw.fullCandidateWallMs,completeAndAudited:completed,report:basename(path),firstResultMs:r.firstResultMs,fullCandidateWallMs:r.fullCandidateWallMs,stoppedWallMs:r.stoppedWallMs,comparisonCompleted:r.state==='complete'&&r.comparisonStatus==='complete'&&['completed-with-candidates','completed-without-candidate-needs-diagnosis'].includes(r.classification),comparisonStatus:r.comparisonStatus,failedStages:r.failedStages,requestIdentityPreserved:r.requestIdentityPreserved,cancellationPass:r.cancel.pass,candidates:r.candidates.map(c=>({id:c.id,pass:c.pass,minutes:c.minutes,cost:c.cost,walkMinutes:c.walkMinutes,waitMinutes:c.waitMinutes,transfers:c.transfers,modes:c.modes,failedChecks:Object.entries(c.checks).filter(([,ok])=>!ok).map(([k])=>k)})),unavailable:r.unavailable.map(c=>({id:c.id,failureStatus:c.failureStatus,incompleteReason:c.incompleteReason,endpointAccess:c.endpointAccess,cost:c.cost,scenarioOnly:c.scenarioOnly,simulationOnly:c.simulationOnly}))});
 }
 const countBy=fn=>Object.fromEntries([...new Set(rows.map(fn))].map(k=>[k,rows.filter(r=>fn(r)===k).length]));
 const timing=key=>{const x=rows.map(r=>r[key]).filter(Number.isFinite).sort((a,b)=>a-b);return {count:x.length,minMs:x[0]??null,medianMs:x.length?(x[Math.floor((x.length-1)/2)]+x[Math.floor(x.length/2)])/2:null,p90Ms:x[Math.max(0,Math.ceil(x.length*.9)-1)]??null,p95Ms:x[Math.max(0,Math.ceil(x.length*.95)-1)]??null,percentileMethod:'nearest-rank',maxMs:x.at(-1)??null};};
 return {schema:1,generatedAt:new Date().toISOString(),runtime,fixtureSha256,expectedCells:expected.length,observedCells:rows.filter(r=>r.classification!=='not-observed').length,completedComparisonCells:rows.filter(r=>r.comparisonCompleted).length,completedAndAuditedCells:rows.filter(r=>r.completeAndAudited).length,classificationCounts:countBy(r=>r.classification),firstResult:timing('firstResultMs'),fullCandidateComparison:timing('fullCandidateWallMs'),rows,limitations:['Pending observation windows and stopped/error outcomes are not completed comparisons or evidence of NO_ROUTE.','Times are one fresh-process Node S1 observation, not repeated browser/device latency benchmarks.','Source geometry, facility eligibility and illustrative fares retain the qualifications in each original report.','Unavailable endpoint-access fare scenarios remain excluded from complete navigation candidates.']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const directory=process.argv.find(x=>x.startsWith('--directory='))?.slice('--directory='.length);if(!directory)throw Error('--directory=<immutable-runtime-report-directory> required');
 const report=summarizeMatrix(resolve(directory));writeFileSync(resolve(directory,'matrix-summary.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({runtime:report.runtime?.version,expectedCells:report.expectedCells,observedCells:report.observedCells,completedComparisonCells:report.completedComparisonCells,completedAndAuditedCells:report.completedAndAuditedCells,classificationCounts:report.classificationCounts,firstResult:report.firstResult,fullCandidateComparison:report.fullCandidateComparison},null,2));
}
