/** Compare two actually executed four-mode matrices. Neither run can replace the other. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {ROOT,fourPreferenceCells,digest} from './four-preference-fixture.mjs';
import {compareRetainedObservation} from './point-supplement-compare.mjs';
const [beforePath,afterPath]=process.argv.slice(2).map(p=>resolve(p));
if(!beforePath||!afterPath||![beforePath,afterPath].every(p=>p.startsWith(resolve(ROOT,'validation/four-preference-'))))throw Error('Pass the intermediate and final validation/four-preference-* report directories.');
const read=(dir,file)=>JSON.parse(readFileSync(resolve(dir,file))),beforeSummary=read(beforePath,'summary.json'),afterSummary=read(afterPath,'summary.json');
if(![beforeSummary,afterSummary].every(s=>s.finished&&s.cells.length===16))throw Error('Both runtimes must have their own complete 16-cell observations.');
if(beforeSummary.runtime.signature===afterSummary.runtime.signature)throw Error('The intermediate and final runtime signatures must differ.');
const rows=fourPreferenceCells().map(cell=>{
 const before=read(beforePath,cell.id+'.json'),after=read(afterPath,cell.id+'.json');
 if(before.runtime.signature!==beforeSummary.runtime.signature||after.runtime.signature!==afterSummary.runtime.signature)throw Error('Mixed-build observation: '+cell.id);
 const comparison=compareRetainedObservation(before,after);
 return {...cell,beforeReport:relative(ROOT,resolve(beforePath,cell.id+'.json')),afterReport:relative(ROOT,resolve(afterPath,cell.id+'.json')),beforeReportSha256:digest(readFileSync(resolve(beforePath,cell.id+'.json'))),afterReportSha256:digest(readFileSync(resolve(afterPath,cell.id+'.json'))),...comparison};
});
const report={schema:1,createdAt:new Date().toISOString(),intermediateRuntime:beforeSummary.runtime,finalRuntime:afterSummary.runtime,intermediateDirectory:relative(ROOT,beforePath),finalDirectory:relative(ROOT,afterPath),intermediateAcceptedCells:beforeSummary.acceptedCells,finalAcceptedCells:afterSummary.acceptedCells,allRetainedFieldsEqual:rows.every(r=>r.pass),changedCells:rows.filter(r=>!r.pass).map(r=>r.id),sourceAssetsUnchanged:afterSummary.sourcePreservation.pass,rows,scope:'Each version has its own 16 fresh-process executions. Compare all retained requests, preferences, taxi policy, available/unavailable candidates, endpoints, fares and new facility/clock audits. Top-level runtime/performance diagnostics are excluded. Complete raw historical route geometry was not retained, so geometry byte equality is not claimed.'};
writeFileSync(resolve(afterPath,'intermediate-comparison.json'),JSON.stringify(report,null,2)+'\n');
writeFileSync(resolve(afterPath,'INTERMEDIATE-COMPARISON.md'),[
 '# Final versus intermediate four-mode runtime', '',
 `- Final acceptance runtime: ${report.finalRuntime.version}; ${report.finalAcceptedCells}/16 freshly executed cells accepted`,
 `- Earlier intermediate runtime: ${report.intermediateRuntime.version}; ${report.intermediateAcceptedCells}/16 separately executed cells accepted`,
 `- Retained request/candidate/evidence comparison: ${rows.filter(r=>r.pass).length}/16 unchanged`,
 `- Original area/transit source assets: ${report.sourceAssetsUnchanged?'8/8 byte-identical to fd323a328ba2':'changed; inspect source preservation report'}`, '',
 'The final build includes the production E2.route engine-preference normalization fix. Its matrix was run from its own frozen runtime after the intermediate run finished. The intermediate results were preserved and were not used as final-build execution.', '',
 report.scope, '',
 'Reproduce:', '',
 `    node tests/navigation/four-preference-compare.mjs ${relative(ROOT,beforePath)} ${relative(ROOT,afterPath)}`, '',
 'See intermediate-comparison.json for every report hash, retained-payload hash and recursive field difference.', ''
].join('\n'));
console.log(JSON.stringify({finalRuntime:report.finalRuntime.version,intermediateRuntime:report.intermediateRuntime.version,finalAcceptedCells:report.finalAcceptedCells,retainedFieldsEqual:rows.filter(r=>r.pass).length,changedCells:report.changedCells}));
if(!afterSummary.pass||!report.allRetainedFieldsEqual)process.exitCode=1;
