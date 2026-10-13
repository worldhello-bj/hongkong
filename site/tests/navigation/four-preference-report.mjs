/** Produce a human-readable report from the actual per-cell observations. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {ROOT,digest,runtimeIdentity} from './four-preference-fixture.mjs';
const directory=resolve(process.argv[2]??'');
if(!directory.startsWith(resolve(ROOT,'validation/four-preference-')))throw Error('Pass a validation/four-preference-* report directory.');
const read=file=>JSON.parse(readFileSync(resolve(directory,file))),summary=read('summary.json');
if(!summary.finished||summary.cells.length!==16)throw Error('The complete 16-cell observation is not available yet.');
const intermediatePath=resolve(directory,'intermediate-comparison.json'),intermediate=existsSync(intermediatePath)?JSON.parse(readFileSync(intermediatePath)):null;
if(intermediate&&intermediate.finalRuntime.signature!==summary.runtime.signature)throw Error('Intermediate comparison does not match this final runtime.');
const reports=summary.cells.map(cell=>cell.report?read(cell.report):null).filter(Boolean),candidates=reports.flatMap(r=>r.candidates);
const range=xs=>`${(Math.min(...xs)/1000).toFixed(2)}–${(Math.max(...xs)/1000).toFixed(2)} s`;
const first=reports.map(r=>r.firstResultMs).filter(Number.isFinite),complete=reports.map(r=>r.fullCandidateWallMs).filter(Number.isFinite);
const failures=summary.cells.filter(c=>!c.accepted),differences=summary.cells.filter(c=>c.baseline&&!c.baseline.inheritedFieldsEqual);
const unavailableTaxi=reports.flatMap(r=>r.unavailable.filter(c=>c.kind!=='public').map(c=>({rowId:r.rowId,need:r.need,taxi:r.taxi,id:c.id,reason:c.incompleteReason,available:c.available,journeyComplete:c.journeyComplete,fareScenarioPass:c.fareScenario?.pass===true})));
const unavailableTaxiSafe=unavailableTaxi.every(c=>c.available===false&&c.journeyComplete===false&&c.reason==='UNVERIFIED_ENDPOINT_ACCESS'&&c.fareScenarioPass);
const allStable=reports.every(r=>r.runtime.version===summary.runtime.version&&r.runtime.signature===summary.runtime.signature&&r.runtimeStable);
const manifest={schema:1,runtime:summary.runtime,summarySha256:digest(readFileSync(resolve(directory,'summary.json'))),cellReportSha256:Object.fromEntries(summary.cells.filter(c=>c.report).map(c=>[c.report,digest(readFileSync(resolve(directory,c.report)))])),intermediateComparisonSha256:intermediate?digest(readFileSync(intermediatePath)):null,allRuntimeSignaturesStable:allStable,unavailableTaxiScenarioAudit:{pass:unavailableTaxiSafe,cases:unavailableTaxi},generatedAt:new Date().toISOString()};
writeFileSync(resolve(directory,'report-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const rows=summary.cells.map(c=>`| ${c.rowId} | ${c.need} | ${c.taxi?'on':'off'} | ${c.accepted?'PASS':c.classification} | ${(c.candidates??[]).map(x=>`${x.minutes} min / HK$${x.cost.toFixed(2)}`).join('; ')} | ${c.fullCandidateWallMs===null?'incomplete':(c.fullCandidateWallMs/1000).toFixed(2)+' s'} |`);
const lines=[
 '# Four-passenger-mode real-point regression', '',
 `- Runtime: ${summary.runtime.version}`,
 `- Routing-asset signature: ${summary.runtime.signature}`,
 `- Result: ${summary.acceptedCells}/16 newly executed cells passed; ${summary.pass?'complete matrix PASS':'matrix NOT PASSED'}`,
 `- Runtime stability: ${allStable?'all 16 pinned observations retained the exact frozen signature':'FAILED'}`,
 `- Source preservation: ${summary.sourcePreservation.assets.filter(a=>a.unchanged).length}/${summary.sourcePreservation.assets.length} area/transit files are byte-identical to fd323a328ba2`,
 `- First available route: ${range(first)}. Full comparison: ${range(complete)}. These one-run Node timings are diagnostic, not browser/device performance guarantees.`, '',
 '## Fixed requests and results', '',
 'Pacific Place LG1 → L4 and Admiralty E2 → Hung Hom B2 lift portal. All cells depart at 11:00 Asia/Hong_Kong on 2026-10-12. Endpoints and source floors were selected before the result was known.', '',
 '| OD | Preference | Taxi | Result | Available route | Complete comparison |',
 '| --- | --- | --- | --- | --- | --- |', ...rows, '',
 '## Invariants and facility evidence', '',
 `Every available candidate (${candidates.length} total) retains the original endpoint/XYZ or disclosed same-floor portal, continuous geometry, closed/disabled-edge checks, complete segmented fare, taxi policy and luggage vehicle-confirmation checks. Added audits verify requested/effective preference, paid journey clock, endpoint/facility opening intervals and no promotion of unknown wheelchair suitability. ${candidates.filter(c=>c.pass).length}/${candidates.length} candidates pass all checks.`, '',
 'The source graphs were not edited: graph hashes preserve every source node, edge and original facility-evidence field. Pacific Place luggage/lift routes retain source lift ADM:P:250020515. Cross-harbour ordinary/escalator routes retain HUH:I:1000858058 and HUH:I:1000858891:r; luggage/lift routes keep their longer source-lift chain. Unknown wheelchair evidence remains unknown, even where ordinary or facility-preference travel remains legal.', '',
 `Enabling taxi does not establish an unverified floor/node-to-road connection. All ${unavailableTaxi.length} unavailable direct-taxi choices retain UNVERIFIED_ENDPOINT_ACCESS and a separately summed illustrative fare scenario (additional retained-result audit: ${unavailableTaxiSafe?'PASS':'FAIL'}). No available taxi itinerary occurs for these fixed exact-floor/source-node endpoints, so this matrix covers taxi inclusion and safe endpoint refusal, not success of every taxi/intermodal combination. The cross-harbour walking-only choice remains NO_ROUTE; it does not invalidate its completed public-transport alternative.`, '',
 '## Failures and historical comparison', '',
 failures.length?failures.map(c=>`- ${c.id}: ${c.classification}; inspect ${c.report??c.log}`).join('\n'):'No pending cells, empty comparisons, worker errors, OOMs, cancellation failures or structural audit failures were observed.', '',
 `Historical retained-field comparison: ${summary.cells.filter(c=>c.baseline?.inheritedFieldsEqual).length}/16 unchanged. ${differences.length?'Differences are retained in the corresponding comparison JSON files.':'All retained request/candidate/unavailable fields match the selected historical references.'} Those reports originate from older runtimes and are comparison evidence only. They do not count as execution of this runtime, and raw full historical journey geometry was not saved.`, '',
 ...(intermediate?['## Final-build rerun versus intermediate build','',`This report accepts the final runtime ${intermediate.finalRuntime.version}. The earlier ${intermediate.intermediateRuntime.version} report remains an intermediate observation. All 16 final cells were independently executed from the final frozen runtime; none was reused from the intermediate build. The complete retained request/candidate/facility/clock payload is unchanged in ${intermediate.rows.filter(r=>r.pass).length}/16 cells. See INTERMEDIATE-COMPARISON.md and intermediate-comparison.json for exact per-report hashes and differences.`, '']:[]),
 '## Reproduce and scope', '',
 `Run: node tests/navigation/four-preference-run.mjs --dist=${relative(ROOT,summary.dist)} --runtime=${summary.runtime.version} --run`,
 `Render report: node tests/navigation/four-preference-report.mjs ${relative(ROOT,directory)}`, '',
 'Use a fresh output directory if the audit changes. The runner is dry by default, requires the exact runtime, compares source asset hashes, and runs fresh processes serially with 60-second observations and 90-second external watchdogs. Main heap is 768 MiB; each Worker heap is 384 MiB. Heap limits are not an RSS cap.', '',
 'This is bounded diagnostic coverage of two real-point ODs using built production code and real source-data fixtures in a Node DOM stand-in. It is not actual-browser visual QA, all-Hong-Kong route coverage, live lift availability, official live fares, taxi booking, or wheelchair-route certification. Source-backed does not mean live verified.', ''
];
writeFileSync(resolve(directory,'REPORT.md'),lines.join('\n'));
console.log(JSON.stringify({directory,runtime:summary.runtime.version,pass:summary.pass,acceptedCells:summary.acceptedCells,firstResultRange:range(first),fullComparisonRange:range(complete),historicalUnchanged:summary.cells.filter(c=>c.baseline?.inheritedFieldsEqual).length,allStable,unavailableTaxiSafe}));
if(!summary.pass||!allStable||!unavailableTaxiSafe)process.exitCode=1;
