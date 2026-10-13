import test from'node:test';import assert from'node:assert/strict';import{readFileSync,existsSync}from'node:fs';import vm from'node:vm';
import{virtualGoalScore,loadTopologyPotentials,createGoalBoundObserver,instrumentGoalBoundObserver}from'./profile-goal-bound-observer.mjs';import{instrumentOd36Hotspots}from'./profile-od36-hotspots.mjs';
const frozenUrl=new URL('../../validation/performance/runtime-2e2fcf795897/assets/app-transit-worker-CaCMeUxU.js',import.meta.url),sourceUrl=existsSync(frozenUrl)?frozenUrl:new URL('../../dist/assets/app-transit-worker-CaCMeUxU.js',import.meta.url),raw=readFileSync(sourceUrl,'utf8');
const edge=(id,fromId,toId,durationS)=>({id,fromId,toId,durationS,kind:'walk'});
const network={patterns:[],connections:[edge('goal','o','g',0),edge('branch','o','a',0),edge('slow','a','b',20),edge('tail','b','g',20)]};
const topology={runtime:'fixture',expectedRequest:{fromId:'o',toId:'g',departureS:0,horizonS:100,walkPenalty:2.5,transferPenaltyS:0,tripIds:0},arcs:network.connections.map(e=>({kind:['goal','branch'].includes(e.id)?'dynamic':'static',id:e.id,from:e.fromId,to:e.toId,time:e.durationS,walk:e.durationS})),allBounds:[{node:'o',time:0,walk:0},{node:'g',time:0,walk:0},{node:'a',time:40,walk:40},{node:'b',time:20,walk:20}]};
async function run(observe,{throwAt,wrongOwner=false}={}){
 const events=[],trace=[],calls=[],context={self:{},setTimeout,clearTimeout,DOMException,console,performance,process,__profileWorkerId:5,__profileGoalBoundTopology:structuredClone(topology),__profile:{currentSpan:1,record:e=>events.push(structuredClone(e))},__trace:(stage,label)=>trace.push(structuredClone({stage,node:label.node,time:label.time,walk:label.walk,transfers:label.transfers,active:label.active,previous:label.previous?.node}))};
 let source=instrumentOd36Hotspots(raw,'app-transit-worker-CaCMeUxU.js');if(observe)source=instrumentGoalBoundObserver(source);
 for(const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)";/g)){const mod=await import(new URL(match[2],sourceUrl).href);for(const binding of match[1].split(',')){const[n,a]=binding.trim().split(/\s+as\s+/);context[a??n]=mod[n];}}
 source=source.replace(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)";/g,'').replace('let tt;self.onmessage','globalThis.engine=Dt;let tt;self.onmessage').replace('S.push(E);',"S.push(E);globalThis.__trace('root',E);").replace('S.push(i)',"S.push(i),globalThis.__trace('accept',i)").replace('const h=S.pop();if(!h)break;',"const h=S.pop();if(!h)break;globalThis.__trace('pop',h);");
 vm.createContext(context);vm.runInContext(virtualGoalScore.toString()+'\n'+loadTopologyPotentials.toString()+'\nglobalThis.__profileCreateGoalBoundObserver='+createGoalBoundObserver.toString()+';',context);vm.runInContext(source,context);
 const resolver=function(e,time){calls.push({id:e.id,time,receiverFrom:this.fromId});if(calls.length===throwAt)throw new DOMException('Aborted','AbortError');return{...e,durationS:e.id==='goal'?10:e.id==='branch'?1:e.durationS};};
 context.__profileDynamicResolverDomains=new WeakMap([[resolver,{ids:['goal','branch'],preference:wrongOwner?'accessible':'fast',guarded:false}]]);
 let result,error;try{result=structuredClone(context.engine(structuredClone(network),{fromId:'o',toId:'g',departureS:0,horizonS:100,walkPenalty:2.5,transferPenaltyS:0,connectionOpeningTimesS:[90],resolveConnectionAt:resolver}));}catch(e){error={name:e.name,message:e.message};}
 return{result,error,trace,calls,events};
}
test('virtual score uses original expression on floored virtual resources, strict comparison and missing-node fallback',()=>{
 const label={time:1.25,walk:2.75,transfers:1,facilityPenalty:0},score=l=>l.time-1+(2.5-1)*l.walk+180*l.transfers;
 const a=virtualGoalScore(label,{time:3,walk:4},score,score({time:4,walk:6,transfers:1,facilityPenalty:0}));assert.equal(a.equal,true);assert.equal(a.wouldPrune,false);assert.equal(a.originalScore,score(label));assert.equal(a.boundScore,score({time:4,walk:6,transfers:1,facilityPenalty:0}));assert.equal(virtualGoalScore(label,null,score).supported,false);assert.equal(virtualGoalScore({...label,facilityPenalty:1},{time:3,walk:4},score).supported,false);
});
test('actual bundled Dt passive observer preserves full output, accepted/pop trace, callback count/order and receiver',async()=>{
 const a=await run(false),b=await run(true);for(const key of ['result','error','trace','calls'])assert.deepEqual(b[key],a[key],key);assert.equal(b.result.score,25);const start=b.events.find(e=>e.event==='goal-bound-shadow-start'),end=b.events.find(e=>e.event==='goal-bound-shadow');assert.equal(start.validated,true);assert.equal(end.expanded,2);assert.equal(end.wouldPrune,1);assert.equal(end.resolverCalls,3);assert.equal(end.wouldPruneResolverCalls,1);assert.equal(end.outgoingResolverPotential,1);assert.equal(end.wouldPruneDynamicResolverCalls,0);assert.ok(end.maxVirtualScore>end.incumbent);
});
test('would-prune labels still perform original effectful callbacks and propagate cancellation; wrong owner disables statistics only',async()=>{
 for(const throwAt of [1,3]){const a=await run(false,{throwAt}),b=await run(true,{throwAt});for(const key of ['result','error','trace','calls'])assert.deepEqual(b[key],a[key],key);assert.equal(b.error.name,'AbortError');}
 const a=await run(false),b=await run(true,{wrongOwner:true});for(const key of ['result','error','trace','calls'])assert.deepEqual(b[key],a[key],key);assert.equal(b.events.find(e=>e.event==='goal-bound-shadow-unsupported').reason,'owner-domain');assert.equal(b.events.some(e=>e.event==='goal-bound-shadow-start'),false);
});
