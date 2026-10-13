import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
import{patchMetroWorkerLifecycle}from'../../scripts/repair-metro-worker-lifecycle.mjs';
test('idle metro index is released, active query protected, next request safely rebuilds',async()=>{
 const original=readFileSync(new URL('../../dist/assets/metro-planning-CBAOotPX.js',import.meta.url),'utf8');
 const source=patchMetroWorkerLifecycle(original);assert.equal(patchMetroWorkerLifecycle(source),source);
 const registry=source.slice(0,source.indexOf('import'));
 const tail=source.slice(source.indexOf('const C=new WeakMap')).replaceAll('import.meta.url',JSON.stringify(import.meta.url));
 const workers=[];globalThis.Worker=class{constructor(){this.messages=[];this.terminated=false;workers.push(this)}postMessage(m){this.messages.push(m)}terminate(){this.terminated=true}};
 const api=await import('data:text/javascript;base64,'+Buffer.from(registry+tail).toString('base64'));
 const graph={},query={};const pending=api.p(graph,query);assert.equal(workers.length,1);
 api.disposeIdleMetroWorkers();assert.equal(workers[0].terminated,false,'active query must remain alive');
 const id=workers[0].messages[0].id;workers[0].onmessage({data:{id,journey:{complete:true}}});assert.deepEqual(await pending,{complete:true});
 api.disposeIdleMetroWorkers();assert.equal(workers[0].terminated,true);
 const controller=new AbortController(),second=api.p(graph,query,controller.signal);assert.equal(workers.length,2);controller.abort();await assert.rejects(second,{name:'AbortError'});assert.equal(workers[1].terminated,true);
 api.disposeIdleMetroWorkers();delete globalThis.Worker;
});
