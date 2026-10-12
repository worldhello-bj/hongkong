/** Full comparison of the fields actually retained by the original point audit. */
import {createHash} from 'node:crypto';
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const payload=report=>{
 const c=structuredClone({rowId:report.rowId,need:report.need,taxi:report.taxi,fixtureSha256:report.fixtureSha256,request:report.request,candidates:report.candidates,unavailable:report.unavailable});
 for(const choice of c.candidates??[])if(choice.strictSourceAudit?.provenance)delete choice.strictSourceAudit.provenance.sha256;
 return canonical(c);
};
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function diff(a,b,path='',out=[]){
 if(Object.is(a,b))return out;
 if(a&&b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)){
  if(Array.isArray(a)&&a.length!==b.length)out.push({path:path+'.length',before:a.length,after:b.length});
  for(const k of new Set([...Object.keys(a),...Object.keys(b)]))diff(a[k],b[k],path?path+'.'+k:k,out);
 }else out.push({path,before:a,after:b});
 return out;
}
export function compareRetainedObservation(before,after){
 const a=payload(before),b=payload(after),differences=diff(a,b);
 return {pass:differences.length===0,baselineRuntime:before.runtime?.version,currentRuntime:after.runtime?.version,baselineSignature:before.runtime?.signature,currentSignature:after.runtime?.signature,retainedPayloadSha256Before:sha(a),retainedPayloadSha256After:sha(b),differences,classificationBefore:before.classification,classificationAfter:after.classification,newAssertionsPass:after.requestIdentityPreserved===true&&after.cancel?.pass===true&&(after.candidates??[]).every(c=>c.pass),timing:{firstBeforeMs:before.firstResultMs??null,firstAfterMs:after.firstResultMs??null,fullBeforeMs:before.fullCandidateWallMs??null,fullAfterMs:after.fullCandidateWallMs??null},excludedDiagnostics:['Top-level runtime, observation/performance/Worker/load/cancel timing and audit-file provenance are not candidate data.','Only candidate.strictSourceAudit.provenance.sha256 is omitted inside retained candidate objects.'],scope:'All originally retained candidate and unavailable fields, plus exact request/need/taxi/fixture, are compared recursively. Full original raw journey geometry was not saved; its byte equality is not claimed. New routes independently rerun all structural audits.'};
}
