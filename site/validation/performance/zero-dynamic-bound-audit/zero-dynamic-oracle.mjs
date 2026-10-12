const root=fileURLToPath(new URL('../../../',import.meta.url));
const runtime=fileURLToPath(new URL('../runtime-2e2fcf795897/',import.meta.url));
const out=fileURLToPath(new URL('./',import.meta.url));
import fs from'node:fs';import vm from'node:vm';import assert from'node:assert/strict';import{fileURLToPath,pathToFileURL}from'node:url';

const {createGeneratedGoalBounds}=await import(pathToFileURL(root+'src/navigation/generated-goal-bounds.js'));
const certified=new WeakMap();let trace;
const record=(kind,label)=>trace[kind].push(label);
function bound(config){
 const domain=certified.get(config.resolveConnectionAt);if(!domain||!(config.boundary>config.departureS))return null;
 const nodes=new Set(),trips=new Set();for(const list of config.connections.values())for(const e of list){nodes.add(e.fromId);nodes.add(e.toId);assert.equal(e.kind,'walk');}
 for(const entries of config.patterns.values())for(const {p,trips:ts}of entries){for(const s of p.stops)nodes.add(s.stopId);for(const t of ts)trips.add(t.id);}
 const pathStates=2*nodes.size*(trips.size+1);assert.ok(Number.isSafeInteger(pathStates)&&pathStates<=2**30);
 assert.ok(config.departureS>=0&&config.horizonEndS<=2**40&&config.walkPenalty<=2**20&&config.transferPenaltyS<=2**20);
 const relaxed=new Map([...config.connections].map(([k,es])=>[k,es.map(e=>domain.dynamic.has(e.id)?{...e,durationS:0,preferencePenaltyS:0}:e)]));
 const result=createGeneratedGoalBounds({...config,connections:relaxed,resolveConnectionAt:undefined});assert.ok(result);trace.bound=result;trace.stateBound=pathStates;return result;
}
const once=(s,a,b)=>{assert.equal(s.split(a).length,2,a);return s.replace(a,b);};
const engines=[];globalThis.document??={createElement:()=>({relList:{supports:()=>true}})};
for(const file of ['app-transit-worker-CaCMeUxU.js','intermodal-routing-D8vKT-lN.js']){
 const worker=file.startsWith('app-'),url=pathToFileURL(runtime+'assets/'+file),raw=fs.readFileSync(url,'utf8');
 async function load(candidate){let s=raw;const context={self:{},setTimeout,clearTimeout,DOMException,console,__bound:bound,__record:record};
 for(const m of s.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)";/g)){const mod=await import(new URL(m[2],url));for(const b of m[1].split(',')){const[n,a]=b.trim().split(/\s+as\s+/);context[a??n]=mod[n];}}
 const init=worker?'const P=(h,I,k,A,w,Y=0)=>{':'const x=(f,v,A,k,h,oe=0)=>{';
 const config=worker?'connections:J,patterns:j,target:n,departureS:s,horizonEndS:f,walkPenalty:r,transferPenaltyS:d,score:M,resolveConnectionAt:e.resolveConnectionAt,validPoint:Pe,boundary:p':'connections:Z,patterns:W,target:t,departureS:n,horizonEndS:l,walkPenalty:u,transferPenaltyS:p,score:b,resolveConnectionAt:r.resolveConnectionAt,validPoint:Ie,boundary:w';
 s=once(s,init,'const hkBound=globalThis.__bound({'+config+'});'+init);
 const push=worker?'S.push(i)':'P.push(e)',v=worker?'i':'e';s=once(s,push,push+`,globalThis.__record('accepted',${v}),hkBound?.observe(${v})`);
 const settled=worker?'h.settled=!0;':'f.settled=!0;',l=worker?'h':'f';s=once(s,settled,settled+`globalThis.__record('settled',${l});`+(candidate?`if(hkBound?.reject(${l})){globalThis.__record('pruned',${l});continue;}`:''));
 s=s.replace(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)";/g,'').replace(/export\{[^;]+;/g,'');s=worker?once(s,'let tt;self.onmessage','globalThis.engine=Dt;let tt;self.onmessage'):s+'\nglobalThis.engine=Xe;';vm.createContext(context);vm.runInContext(s,context);return context.engine;}
 engines.push({file,baseline:await load(false),candidate:await load(true)});
}
const edge=(id,fromId,toId,durationS)=>({id,fromId,toId,durationS,kind:'walk'});
const state=l=>({node:l.node,time:l.time,walk:l.walk,transfers:l.transfers,facilityPenalty:l.facilityPenalty,boarded:l.boarded,onboardTrip:l.onboardTrip,active:l.active,settled:l.settled,legs:l.legs,previous:l.previous?[l.previous.node,l.previous.time,l.previous.walk,l.previous.transfers]:null});
function run(engine,network,dynamic,duration,{trusted=true,throwAt,cancelAt,weight=2.5}={}){trace={accepted:[],settled:[],pruned:[]};const calls=[];
 const resolver=(edge,time)=>{calls.push([edge.id,time]);if(edge.id===throwAt)throw Error('resolver effect');if(calls.length===cancelAt)throw new DOMException('Aborted','AbortError');return dynamic.has(edge.id)?{...edge,durationS:duration(edge,time),preferencePenaltyS:0}:edge;};
 if(trusted)certified.set(resolver,{dynamic});let output,error;try{output=engine(structuredClone(network),{fromId:'o',toId:'g',departureS:0,horizonS:100,walkPenalty:weight,transferPenaltyS:0,connectionOpeningTimesS:[90],resolveConnectionAt:resolver});}catch(e){error={name:e.name,message:e.message};}
 const score=output?.score??Infinity;return{output:structuredClone(output),error,calls,pruned:trace.pruned.map(state),viable:structuredClone(trace.accepted.filter(l=>!trace.bound||(trace.bound.lowerScore(l)??-Infinity)<=score).map(state)),accepted:trace.accepted.length,stateBound:trace.stateBound};}
let pairs=0,pruned=0;for(const engine of engines){
 const network={patterns:[],connections:[edge('goal','o','g',0),edge('branch','o','a',0),edge('slow','a','b',20),edge('tail','b','g',20)]},dynamic=new Set(['goal','branch']);
 for(const d of[0,.00006,.25,1,2,5]){const f=e=>e.id==='goal'?10:d,a=run(engine.baseline,network,dynamic,f),b=run(engine.candidate,network,dynamic,f);assert.deepEqual(b.output,a.output);assert.deepEqual(b.viable,a.viable);assert.equal(b.pruned.length,1);assert.equal(b.pruned[0].node,'a');assert.ok(a.calls.length>b.calls.length);pairs++;pruned+=b.pruned.length;}
 // Unknown effectful callbacks are not enrolled; zero edge weights do not imply purity.
 for(const opts of[{throwAt:'slow'},{cancelAt:3}]){const a=run(engine.baseline,network,dynamic,e=>e.id==='goal'?10:1,{...opts,trusted:false}),b=run(engine.candidate,network,dynamic,e=>e.id==='goal'?10:1,{...opts,trusted:false});assert.deepEqual(b,a);assert.ok(b.error);}
 // Explicitly demonstrate the invalid inference "controlled ID => pure".
 const bad=run(engine.candidate,network,dynamic,e=>e.id==='goal'?10:1,{trusted:true,throwAt:'slow'});assert.ok(bad.output);assert.equal(bad.error,undefined);
 // Equality remains unpruned, including fractional resources.
 const tie={patterns:[],connections:[edge('goal','o','g',0),edge('branch','o','a',0),edge('tail','a','g',9)]};const td=new Set(['goal','branch']);const a=run(engine.baseline,tie,td,e=>e.id==='goal'?10:1,{weight:1}),b=run(engine.candidate,tie,td,e=>e.id==='goal'?10:1,{weight:1});assert.deepEqual(b.output,a.output);assert.deepEqual(b.viable,a.viable);assert.equal(b.pruned.length,0);pairs++;
}
console.log(JSON.stringify({pairedActualEngines:pairs,strictLosingExpansionsSkipped:pruned,subsecondDynamicCovered:true,unknownExceptionAndCancellationFallback:true,unsafeFalseBrandCounterexample:true,productionOptIn:false}));
