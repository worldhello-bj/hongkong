import test from 'node:test';import assert from 'node:assert/strict';
import {createRoutingQueue} from '../../src/navigation/routing-queue.js';
test('heavy graph owners serialize and previous worker is released before the next allocation',async()=>{
 const controller=new AbortController(),queue=createRoutingQueue(controller.signal),events=[];let active=0,peak=0;
 const work=key=>queue.run(async()=>{events.push('start '+key);active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,3));active--;return key;},key,()=>events.push('release '+key));
 assert.deepEqual(await Promise.all([work('public'),work('taxi'),work('taxi'),work('walk')]),['public','taxi','taxi','walk']);queue.dispose();
 assert.equal(peak,1);assert.deepEqual(events,['start public','release public','start taxi','start taxi','release taxi','start walk','release walk']);
});
test('cancellation releases current graph owner and prevents queued queries starting',async()=>{
 const controller=new AbortController(),queue=createRoutingQueue(controller.signal);let finish,released=0,ran=false;
 const first=queue.run(()=>new Promise(resolve=>finish=resolve),'a',()=>released++);
 const next=queue.run(()=>{ran=true;},'b');await new Promise(r=>setImmediate(r));controller.abort();finish('done');
 assert.equal(await first,'done');await assert.rejects(next,{name:'AbortError'});assert.equal(released,1);assert.equal(ran,false);queue.dispose();
});
