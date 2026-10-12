import test from'node:test';import assert from'node:assert/strict';import{readFileSync,writeFileSync,mkdtempSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';import{pathToFileURL}from'node:url';import vm from'node:vm';
import{createGeneratedGoalBounds}from'../../src/navigation/generated-goal-bounds.js';
import{patchGeneratedGoalBounds,restoreGeneratedGoalBounds,generatedGoalAssets}from'../../scripts/repair-generated-goal-bounds.mjs';
const dir=mkdtempSync(join(tmpdir(),'hk-generated-goal-')),engines=[];
globalThis.document??={createElement:()=>({relList:{supports:()=>true}})};
const once=(s,a,b)=>{assert.equal(s.split(a).length,2,a);return s.replace(a,b);};
const snapshot=l=>structuredClone({node:l.node,time:l.time,walk:l.walk,transfers:l.transfers,facilityPenalty:l.facilityPenalty,boarded:l.boarded,onboardTrip:l.onboardTrip,active:l.active,settled:l.settled,legs:l.legs,previous:l.previous?[l.previous.node,l.previous.time,l.previous.walk,l.previous.transfers,l.previous.facilityPenalty,l.previous.boarded,l.previous.onboardTrip]:null});
for(const file of generatedGoalAssets){
 const url=new URL('../../dist/assets/'+file,import.meta.url),raw=restoreGeneratedGoalBounds(readFileSync(url,'utf8')),worker=file.startsWith('app-');
 const load=async(variant)=>{
  let source=variant==='candidate'?patchGeneratedGoalBounds(raw).source:raw;
  const cfg=worker?'connections:J,patterns:j,target:n,departureS:s,horizonEndS:f,walkPenalty:r,transferPenaltyS:d,score:M,resolveConnectionAt:e.resolveConnectionAt,validPoint:Pe':'connections:Z,patterns:W,target:t,departureS:n,horizonEndS:l,walkPenalty:u,transferPenaltyS:p,score:b,resolveConnectionAt:r.resolveConnectionAt,validPoint:Ie';
  const accept=worker?'const P=(h,I,k,A,w,Y=0)=>{':'const x=(f,v,A,k,h,oe=0)=>{';
  source=once(source,accept,'globalThis.__goalState.config={'+cfg+'};'+accept);
  source=once(source,worker?'S.push(i)':'P.push(e)',(worker?'S.push(i)':'P.push(e)')+',globalThis.__goalState.accepted.push('+(worker?'i':'e')+')');
  const settled=worker?'h.settled=!0;':'f.settled=!0;',label=worker?'h':'f';
  source=once(source,settled,settled+`globalThis.__goalState.settled.push(${label});`+(variant==='naive'?`if(globalThis.__goalState.naive(${label},globalThis.__goalState))continue;`:''));
  if(variant==='candidate')source=once(source,'if(hkGoalBound?.reject('+label+'))continue;','if(hkGoalBound?.reject('+label+')){globalThis.__goalState.pruned.push('+label+');continue;}');
  if(worker){const context={self:{},setTimeout,clearTimeout,DOMException,console};for(const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)";/g)){const module=await import(new URL(match[2],url).href);for(const binding of match[1].split(',')){const[name,alias]=binding.trim().split(/\s+as\s+/);context[alias??name]=module[name];}}source=source.replace(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)";/g,'').replace('let tt;self.onmessage','globalThis.engine={scheduled:Dt,router:jt,prepare:Ae};let tt;self.onmessage');vm.createContext(context);vm.runInContext(source,context);return{...context.engine,context};}
  source=source.replace(/from\s*["'](\.\.?\/[^"']+)["']/g,(_,p)=>'from '+JSON.stringify(new URL(p,url).href));source+='\nexport{Xe as scheduled,ft as router,Ae as prepare};';const path=join(dir,file+'-'+variant+'.mjs');writeFileSync(path,source);return{...await import(pathToFileURL(path).href),context:globalThis};
 };
 engines.push({file,baseline:await load('baseline'),candidate:await load('candidate'),naive:await load('naive')});
}
const edge=(id,fromId,toId,durationS,rest={})=>({id,fromId,toId,durationS,kind:'walk',...rest});
const pattern=(id,from,to,duration,departures)=>({id,routeId:id,label:id,mode:'bus',stops:[{stopId:from,arrivalOffsetS:0,departureOffsetS:0,shapeIndex:0},{stopId:to,arrivalOffsetS:duration,departureOffsetS:duration,shapeIndex:1}],shape:[[114,22],[114.01,22]],schedule:{departuresS:departures},provenance:{scheduleKind:'scheduled'}});
function run(engine,network,request,resolverFactory,naive){
 const calls=[],state={accepted:[],settled:[],pruned:[],naive};engine.context.__goalState=state;let output,error;const resolver=resolverFactory?.(calls);
 try{output=structuredClone(engine.scheduled(structuredClone(network),{fromId:'o',toId:'g',departureS:0,horizonS:100,walkPenalty:1,transferPenaltyS:0,...request,...resolver?{resolveConnectionAt:resolver}:{}}));}catch(e){error={name:e.name,message:e.message};}
 const certificate=state.config?createGeneratedGoalBounds(state.config):null,score=output?.score??Infinity;
 const survivors=state.accepted.filter(l=>!certificate||(certificate.lowerScore(l)??-Infinity)<=score).map(snapshot);
 return{output,error,calls,accepted:state.accepted.map(snapshot),settled:state.settled.map(snapshot),survivors,pruned:state.pruned.map(snapshot),enabled:!!certificate};
}
function paired(engine,network,request={},resolver){const a=run(engine.baseline,network,request,resolver),b=run(engine.candidate,network,request,resolver);assert.deepEqual(b.output,a.output,engine.file);assert.deepEqual(b.error,a.error,engine.file);assert.deepEqual(b.survivors,a.survivors,engine.file+' viable accepted states');if(!b.enabled){assert.deepEqual(b.accepted,a.accepted);assert.deepEqual(b.settled,a.settled);assert.deepEqual(b.calls,a.calls);}return{a,b};}
test('experimental patches are narrow, reversible, idempotent, layered and absent from production build',()=>{
 assert.doesNotMatch(readFileSync(new URL('../../scripts/build-navigation.mjs',import.meta.url),'utf8'),/repair-generated-goal-bounds/);
 for(const file of generatedGoalAssets){const old=restoreGeneratedGoalBounds(readFileSync(new URL('../../dist/assets/'+file,import.meta.url),'utf8')),next=patchGeneratedGoalBounds(old);assert.equal(next.changes,1);assert.equal(restoreGeneratedGoalBounds(next.source),old);assert.equal(patchGeneratedGoalBounds(next.source).changes,0);assert.equal(patchGeneratedGoalBounds('/* outer */\n'+next.source).source,'/* outer */\n'+next.source);}
});
test('both complete engines prune a strictly losing expansion while preserving all viable accepted states',()=>{
 const network={patterns:[],connections:[edge('og','o','g',10),edge('oa','o','a',1),edge('ab','a','b',20),edge('bg','b','g',20)]};
 for(const e of engines){const{a,b}=paired(e,network);assert.equal(b.enabled,true);assert.equal(b.pruned.length,1);assert.equal(b.pruned[0].node,'a');assert.ok(a.accepted.length>b.accepted.length);assert.equal(b.output.score,10);}
});
test('strict equality counterexample retains the original arrival-time tiebreak',()=>{
 const network={patterns:[],connections:[edge('og','o','g',20,{kind:'metro'}),edge('oa','o','a',1),edge('ag','a','g',9)]};
 for(const e of engines){const{b}=paired(e,network,{walkPenalty:2});assert.equal(b.output.score,20);assert.equal(b.output.arrivalS,10);const wrong=run(e.naive,network,{walkPenalty:2},undefined,(label,state)=>label.node==='a'&&state.accepted.some(x=>x.node==='g'));assert.equal(wrong.output.score,20);assert.equal(wrong.output.arrivalS,20);}
});
test('unrounded duration counterexample, signed zero and fractional clock additions retain exact numeric results',()=>{
 const network={patterns:[],connections:[edge('og','o','g',3.99999),edge('oa','o','a',2),edge('ag','a','g',Number((2/60).toFixed(6))*60)]};
 for(const e of engines){for(const departureS of[-0,0,.1,2**39,-(2**39)]){const{b}=paired(e,network,{departureS});assert.equal(b.enabled,true);}const{b}=paired(e,network);assert.equal(b.output.arrivalS,3.99998);const wrong=run(e.naive,network,{},undefined,l=>l.node==='a'&&l.time+2>3.99999);assert.equal(wrong.output.arrivalS,3.99999);}
});
test('random static networks and actual scheduled patterns preserve full results and viable states',()=>{
 let seed=78293,count=0,pruned=0;const next=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 for(let n=0;n<120;n++){const nodes=['o','a','b','c','g'],connections=[edge('og','o','g',10+next(20))],patterns=[];for(let i=0;i<15;i++){const a=next(5),b=next(5);if(a!==b)connections.push(edge('e'+i,nodes[a],nodes[b],1+next(30)+[0,.25,.9][next(3)],{kind:next(4)?'walk':'metro',preferencePenaltyS:next(5)}));}for(let i=0;i<3;i++){const a=next(5),b=next(5);if(a!==b)patterns.push(pattern('p'+i,nodes[a],nodes[b],2+next(10)+.25,[0,10,25,50]));}for(const e of engines){const{b}=paired(e,{connections,patterns},{walkPenalty:[1,2.5,4][n%3],transferPenaltyS:[0,5,180][n%3],allowedModes:n%2?['bus','metro']:['bus']});pruned+=b.pruned.length;count++;}}
 assert.equal(count,240);assert.ok(pruned>0);console.log('generated-goal static oracle',{count,pruned});
});
test('uncertified numeric, zero-cost, geometry and resolver cases fall back with exact old state/error/cancellation behavior',()=>{
 const base={patterns:[],connections:[edge('og','o','g',10),edge('oa','o','a',1),edge('ag','a','g',20)]};
 for(const e of engines){
  for(const request of[{departureS:NaN},{departureS:Infinity},{departureS:2**45},{walkPenalty:NaN},{walkPenalty:2**45},{transferPenaltyS:Infinity}])paired(e,base,request);
  for(const change of[{durationS:.1},{durationS:NaN},{durationS:Infinity},{durationS:0,preferencePenaltyS:1},{durationS:0,kind:'metro'},{geometry:[[NaN,22],[114,22]]}]){const network=structuredClone(base);Object.assign(network.connections[2],change);paired(e,network);}
  const zeros={patterns:[],connections:[edge('oa','o','a',0),edge('ao','a','o',0),edge('ag','a','g',10)]};assert.equal(paired(e,zeros).b.output.score,10);
  for(const at of[2,3]){const{b}=paired(e,base,{},calls=>(connection,time)=>{calls.push([connection.id,time]);if(calls.length===at)throw new DOMException('Aborted','AbortError');return connection;});assert.equal(b.error?.name,'AbortError');assert.equal(b.enabled,false);}
  const{b}=paired(e,base,{},calls=>(connection,time)=>{calls.push([connection.id,time]);return{...connection,durationS:connection.id==='ag'?1:connection.durationS};});assert.equal(b.enabled,false);assert.equal(b.output.score,2);
 }
});
test('history-aware admissibility alone is insufficient: skipping a dead end removes its later dominance',()=>{
 const network={patterns:[],connections:[edge('og','o','g',10),edge('ox','o','x',1),edge('xv','x','v',1),edge('vz','v','z',1),edge('zx','z','x',1),edge('oy','o','y',3,{preferencePenaltyS:1}),edge('yz','y','z',0),edge('xg','x','g',1)]};
 const resolver=calls=>(connection,time)=>{calls.push([connection.id,time]);return connection.id==='xg'&&time<4?null:connection;};
 for(const e of engines){const{b}=paired(e,network,{connectionOpeningTimesS:[100]},resolver);assert.equal(b.output.score,10);assert.equal(b.enabled,false);const wrong=run(e.naive,network,{connectionOpeningTimesS:[100]},resolver,l=>l.node==='v');assert.equal(wrong.output.score,6);}
});
test('production asynchronous routers remain fallback-only and preserve output plus both existing cancellation boundaries',async()=>{
 const coordinates=i=>[114.16+i*.0001,22.28],nodes=[0,1,2].map(i=>({id:'n'+i,region_id:'R',coordinates:coordinates(i)})),edges=[];
 for(const[a,b]of[[0,1],[1,0],[1,2],[2,1]]){const id=`e${a}-${b}`;edges.push({id,physical_id:id,from_id:'n'+a,to_id:'n'+b,region_id:'R',kind:'walk',name:id,length_m:10,duration_s:10,coordinates:[coordinates(a),coordinates(b)],geometry_mode:'official',source_id:'TEST',snap_eligible:true,accessible_eligible:true,disabled:false});}
 const area={version:'goal-fixture',nodes,edges,regions:[{id:'R',center:coordinates(0),radius_m:1000}],portals:nodes.map(n=>({id:'s'+n.id,node_id:n.id,region_id:'R',name:n.id,coordinates:n.coordinates}))},services={stops:[{id:'sn0',coordinates:coordinates(0),name:'a'},{id:'sn2',coordinates:coordinates(2),name:'b'}],patterns:[{...pattern('bus','sn0','sn2',1,[0,10,20,30]),shape:[coordinates(0),coordinates(2)]}],connections:[]},links={graph_version:area.version,preference:'fast',connections:[],warnings:[]};
 const request={origin:{lon:coordinates(0)[0],lat:coordinates(0)[1],node_id:'n0'},destination:{lon:coordinates(2)[0],lat:coordinates(2)[1],node_id:'n2'},preference:'fast',departureS:0,horizonS:100,allowedModes:['bus']};
 for(const e of engines){const loaded=[e.baseline,e.candidate],routers=loaded.map(x=>x.router(x.prepare(structuredClone(area)),structuredClone(services),structuredClone(links))),outputs=[];
  for(let i=0;i<2;i++){const state={accepted:[],settled:[],pruned:[]};loaded[i].context.__goalState=state;outputs.push(structuredClone(await routers[i].route(request)));assert.equal(createGeneratedGoalBounds(state.config),null);assert.deepEqual(state.pruned,[]);}
  assert.deepEqual(outputs[1],outputs[0]);
  for(const router of routers){let controller=new AbortController();controller.abort();await assert.rejects(router.route(request,controller.signal),{name:'AbortError'});controller=new AbortController();const pending=router.route(request,controller.signal);queueMicrotask(()=>controller.abort());await assert.rejects(pending,{name:'AbortError'});}
 }
});
test.after(()=>{delete globalThis.__goalState;rmSync(dir,{recursive:true,force:true});});
