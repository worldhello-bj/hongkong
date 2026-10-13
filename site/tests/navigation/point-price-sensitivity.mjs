/** Offline re-ranking of already observed, audited candidates. Never starts routing. */
import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {ROOT,readJSON,digest,runtimeIdentity} from './point-matrix-fixture.mjs';
export const PRICE_WEIGHTS=[0,.25,.75,1.5,3];
export function evaluatePriceSensitivity(report,{journeyScore,rankJourneys}){
 const excluded=[],choices=[];
 for(const c of report.candidates??[]){
  if(c.pass!==true||c.checks?.complete!==true||c.available===false){excluded.push({id:c.id,reason:'not a complete available candidate with passing structural assertions'});continue;}
  let input=c.scoringInput;
  // Old ordinary reports need no facility penalty. Do not invent non-ordinary segments.
  if(!input&&report.need==='ordinary')input={id:c.id,available:true,minutes:c.minutes,cost:c.cost,walkMinutes:c.walkMinutes,transfers:c.transfers,result:{waitMinutes:c.waitMinutes,segments:[]}};
  if(!input){excluded.push({id:c.id,reason:'missing source segments needed for exact preference penalty'});continue;}
  const score=journeyScore(input,'time',report.need);if(!Number.isFinite(score.total)){excluded.push({id:c.id,reason:'incomplete/nonfinite pricing or metrics'});continue;}choices.push(input);
 }
 const byId=new Map((report.candidates??[]).map(c=>[c.id,c]));
 const samples=PRICE_WEIGHTS.map(cost=>{
  const ranked=rankJourneys(choices,'time',report.need,{cost});
  return {priceWeight:cost,winner:ranked[0]?.id??null,winnerKind:byId.get(ranked[0]?.id)?.kind??null,ranked:ranked.map(c=>{const s=journeyScore(c,'time',report.need,{cost});return {id:c.id,kind:byId.get(c.id)?.kind,score:s.total,contributions:s.terms,weights:s.weights,metrics:s.metrics,luggageCarryRequired:!!c.result?.luggageCarryRequired};})};
 });
 return {rowId:report.rowId,need:report.need,taxi:report.taxi,observationClassification:report.classification,comparisonStatus:report.comparisonStatus??null,candidateSetComplete:report.state==='complete'&&['completed-with-candidates','completed-without-candidate-needs-diagnosis'].includes(report.classification)&&report.comparisonStatus!=='incomplete-error',eligible:choices.map(c=>c.id),candidateFares:choices.map(c=>({id:c.id,cost:c.cost,fare:byId.get(c.id)?.fare??null,qualification:byId.get(c.id)?.fare?'Full production illustrative per-leg quote from this same observation.':'Legacy/unit input without retained per-leg fare; cost scalar only.'})),excluded,samples,winnerChanges: samples.some(s=>s.winner!==samples[0].winner),qualification:'Only observed complete, available, structurally passing candidates are reranked. Missing/pending candidates are not inferred; a lower score does not establish a global optimum.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2),directory=args.find(x=>x.startsWith('--directory='))?.slice(12),runtimeRoot=args.find(x=>x.startsWith('--runtime-root='))?.slice(15);
 if(!directory||!runtimeRoot)throw Error('Provide --directory=<point-report-directory> --runtime-root=<matching-dist-or-frozen-runtime>. No routing is invoked.');
 const dir=resolve(directory),base=resolve(runtimeRoot),runtime=runtimeIdentity(base);
 const {journeyScore}=await import(pathToFileURL(resolve(base,'assets/journey-score.js'))),{rankJourneys}=await import(pathToFileURL(resolve(base,'assets/integrated-navigation.js')));
 const files=readdirSync(dir).filter(n=>n.endsWith('.json')),rows=[];
 for(const name of files){const report=readJSON(resolve(dir,name));if(!report.rowId||!report.need||!Array.isArray(report.candidates))continue;
  if(report.runtime?.version!==runtime.version||report.runtime?.signature!==runtime.signature)throw Error('Result/runtime content mismatch: '+name);
  rows.push({file:name,sha256:digest(readFileSync(resolve(dir,name))),...evaluatePriceSensitivity(report,{journeyScore,rankJourneys})});
 }
 const out=resolve(dir,'price-sensitivity.json'),result={schema:1,runtime,checkedAt:new Date().toISOString(),priceWeights:PRICE_WEIGHTS,priority:'time',otherWeights:'Unmodified production time-priority defaults, including fixed per-preference facility penalty and luggage carry ordering.',rows,limitations:['No new routing, endpoint mutation or fare changes.','Old reports are used only if their exact runtime is available; missing non-ordinary facility data is excluded, never guessed.','Pending and error comparisons may have a partial eligible candidate set, explicitly labeled.','Unavailable XYZ/floor curb-access fare scenarios and structurally failing candidates are excluded.']};
 writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({out,cells:rows.length,rows:rows.map(r=>({rowId:r.rowId,need:r.need,taxi:r.taxi,candidateSetComplete:r.candidateSetComplete,winners:r.samples.map(s=>({priceWeight:s.priceWeight,id:s.winner,kind:s.winnerKind})),excluded:r.excluded}))},null,2));
}
