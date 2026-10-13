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
import {runRoutingPhases} from '../../src/navigation/routing-queue.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('base public and dependent taxi queries use one owner before all refinements, preserving request payloads',async()=>{
 const controller=new AbortController(),queue=createRoutingQueue(controller.signal),events=[],requests=[];let allocations=0,owner;
 const route=(key,request)=>queue.run(async()=>{if(owner!==key){owner=key;allocations++}requests.push(structuredClone(request));events.push(request.id);await tick();return request.id},key,()=>{events.push('dispose:'+key);owner=undefined});
 const base={id:'public',departureS:28800,need:'luggage'},legs=[{id:'last',departureS:28800,need:'luggage'},{id:'first',departureS:30412,need:'luggage'}];
 const result=await runRoutingPhases({basePublic:()=>route('base',base),taxi:async()=>{events.push('direct-quote');for(const request of legs)await route('base',request)},refinePublic:async()=>{await route('metro',{id:'metro'});await route('demo',{id:'demo'});await route('detail',{id:'detail'})},walk:()=>route('walk',{id:'walk'}),isCurrent:()=>!controller.signal.aborted});queue.dispose();
 assert.deepEqual(requests.slice(0,3),[base,...legs]);assert.equal(allocations,5,'base owner is initialized once, then four genuinely different owners');
 assert.deepEqual(events.filter(x=>x.startsWith('dispose:')),['dispose:base','dispose:metro','dispose:demo','dispose:detail','dispose:walk']);
 assert.ok(events.indexOf('direct-quote')<events.indexOf('last'));assert.ok(events.indexOf('first')<events.indexOf('metro'));assert.ok(result.every(x=>x.status==='fulfilled'));
});
test('cancellation while the taxi group is pending prevents all later phases and queued queries',async()=>{
 const controller=new AbortController(),queue=createRoutingQueue(controller.signal),events=[];let finish;
 const pending=runRoutingPhases({basePublic:()=>queue.run(()=>{events.push('public')},'base',()=>events.push('release')),taxi:()=>queue.run(()=>new Promise(r=>{finish=r;events.push('taxi')}),'base',()=>events.push('release')),refinePublic:()=>events.push('refinement'),walk:()=>events.push('walk'),isCurrent:()=>!controller.signal.aborted});
 for(let i=0;i<4;i++)await tick();controller.abort();finish();await pending;queue.dispose();
 assert.deepEqual(events,['public','taxi','release']);
});
test('a rejected base or taxi branch does not suppress independent original refinements',async()=>{
 const calls=[];const results=await runRoutingPhases({basePublic:()=>{throw Error('base unavailable')},taxi:()=>{calls.push('taxi')},refinePublic:()=>{calls.push('refinement');throw Error('detail unavailable')},walk:()=>{calls.push('walk')}});
 assert.deepEqual(calls,['taxi','refinement','walk']);assert.deepEqual(results.map(x=>x.status),['rejected','fulfilled','rejected','fulfilled']);
});
