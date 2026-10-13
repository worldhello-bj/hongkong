/** Optional small V8 sampling profile, never a full heap snapshot.
 * Installed only in the selected copied Worker before its first input message.
 * The synchronous inspector callback is invoked from an actual search progress
 * checkpoint, so a blocked event loop cannot postpone capture until OOM.
 */
export function heapSamplingBootstrap({enabled,worker,file,thresholdMiB=340,targetLabels=5000,samplingInterval=65536}){
 if(!enabled)return '';
 return `
const __heapInspector=require('node:inspector'),__heapFs=require('node:fs'),__heapSession=new __heapInspector.Session();
__heapSession.connect();let __heapSampling=true,__heapStartedAt=performance.now();
__heapSession.post('HeapProfiler.startSampling',{samplingInterval:${samplingInterval},includeObjectsCollectedByMajorGC:false,includeObjectsCollectedByMinorGC:false},error=>{if(error){__heapSampling=false;globalThis.postMessage({__profile:{event:'heap-sampling-error',worker:${worker},error:error.message}});}else globalThis.postMessage({__profile:{event:'heap-sampling-start',worker:${worker},samplingInterval:${samplingInterval},thresholdMiB:${thresholdMiB},targetLabels:${targetLabels},startsBeforeInputClone:true}});});
globalThis.__profileHeapCheckpoint=context=>{
 if(!__heapSampling)return;
 const memory=process.memoryUsage();
 if(memory.heapUsed<${thresholdMiB}*1048576&&(context.retainedLabels??0)<${targetLabels})return;
 __heapSampling=false;
 const checkpoint={...context,...memory,elapsedSinceSamplingStartMs:performance.now()-__heapStartedAt,thresholdMiB:${thresholdMiB},targetLabels:${targetLabels}};
 __heapSession.post('HeapProfiler.stopSampling',(error,result)=>{
  if(error){globalThis.postMessage({__profile:{event:'heap-sampling-error',worker:${worker},error:error.message}});return;}
  const payload={worker:${worker},samplingInterval:${samplingInterval},checkpoint,profile:result.profile,limitations:['Statistical live-allocation samples, not exact retained sizes or dominator/retainer paths.','Objects not yet collected can still appear; no forced GC was requested.','Native allocations and input cloning can have unattributed/root frames.','Only this selected detailed Worker is sampled; wall-time is diagnostic, not an A/B timing run.']};
  const json=JSON.stringify(payload);__heapFs.writeFileSync(${JSON.stringify(file)},json+'\\n');
  globalThis.postMessage({__profile:{event:'heap-sampling-ready',worker:${worker},file:${JSON.stringify(file)},bytes:Buffer.byteLength(json),checkpoint,samples:result.profile.samples?.length}});
 });
 __heapSession.disconnect();
};
`;
}
