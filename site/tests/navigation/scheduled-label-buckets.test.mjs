import test from'node:test';import assert from'node:assert/strict';import{readFileSync,writeFileSync,mkdtempSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';import{pathToFileURL}from'node:url';import vm from'node:vm';
import{getScheduledLabelBucket,setScheduledLabelBucket}from'../../src/navigation/scheduled-label-buckets.js';
import{patchScheduledLabelBuckets,restoreScheduledLabelBuckets,scheduledLabelAssets}from'../../scripts/repair-scheduled-label-buckets.mjs';
const me=(a,b,p)=>a<=b&&(a===b||a>=p);
test('exact-time buckets select precisely the labels eligible in either original comparison direction',()=>{
 for(const boundary of[-1,-0,0,1,100]){
  const index=new Map(),all=[],times=[-2,-1,-0,0,Number.MIN_VALUE,1-Number.EPSILON,1,1+Number.EPSILON,2,99,100,101,1,0,100];
  assert.equal(getScheduledLabelBucket(index,'node',0,boundary),undefined);assert.equal(index.size,0);
  for(const [id,time]of times.entries()){
   const label={id,time,active:id%3!==0},list=getScheduledLabelBucket(index,'node',time,boundary)??[];list.push(label);setScheduledLabelBucket(index,'node',time,boundary,list);all.push(label);
  }
  for(const time of times){const expected=all.filter(label=>me(label.time,time,boundary)||me(time,label.time,boundary));assert.deepEqual(getScheduledLabelBucket(index,'node',time,boundary),expected);}
  assert.equal([...index.get('node').values()].reduce((n,list)=>n+list.length,0),all.length);
  assert.equal(new Set([...index.get('node').values()].flat()).size,all.length);
  assert.equal(getScheduledLabelBucket(index,'node',-0,boundary),getScheduledLabelBucket(index,'node',0,boundary));
 }
});
test('the index preserves object identity, inactive entries, insertion order and independent node owners',()=>{
 const index=new Map(),a={id:'a',active:false},b={id:'b',active:true},labels=[a,b];
 assert.equal(setScheduledLabelBucket(index,'__proto__',5,10,labels),index);assert.equal(getScheduledLabelBucket(index,'__proto__',5,10),labels);
 getScheduledLabelBucket(index,'__proto__',5,10)[1].active=false;assert.equal(b.active,false);assert.deepEqual(labels,[a,b]);
 setScheduledLabelBucket(index,'constructor',5,10,[{id:'c'}]);assert.notEqual(getScheduledLabelBucket(index,'constructor',5,10),labels);
 assert.equal(getScheduledLabelBucket(new Map(),'__proto__',5,10),undefined);
});
test('both production transforms are exactly reversible, idempotent, layered and refreshable',()=>{
 for(const file of scheduledLabelAssets){const source=restoreScheduledLabelBuckets(readFileSync(new URL('../../dist/assets/'+file,import.meta.url),'utf8')),result=patchScheduledLabelBuckets(source);assert.equal(result.changes,1);assert.equal(restoreScheduledLabelBuckets(result.source),source);assert.equal(patchScheduledLabelBuckets(result.source).changes,0);const layered='/* OUTER */\n'+result.source;assert.equal(patchScheduledLabelBuckets(layered).source,layered);assert.equal(restoreScheduledLabelBuckets(layered),'/* OUTER */\n'+source);assert.equal(patchScheduledLabelBuckets(result.source.replace('let buckets=index.get(node);','let buckets=index.get(node); /* stale */')).source,result.source);}
 assert.throws(()=>patchScheduledLabelBuckets('unknown'),/anchor drift/);
});
const dir=mkdtempSync(join(tmpdir(),'hk-scheduled-labels-'));globalThis.document={createElement:()=>({relList:{supports:()=>true}})};
let trace=[];
const record=(stage,label)=>trace.push(structuredClone({stage,node:label.node,time:label.time,walk:label.walk,transfers:label.transfers,facilityPenalty:label.facilityPenalty,boarded:label.boarded,onboardTrip:label.onboardTrip,active:label.active,settled:label.settled,legs:label.legs,previous:label.previous?[label.previous.node,label.previous.time,label.previous.walk,label.previous.transfers,label.previous.facilityPenalty,label.previous.boarded,label.previous.onboardTrip]:null}));
globalThis.__scheduledRecord=record;
const once=(source,old,next)=>{assert.equal(source.split(old).length,2,old);return source.replace(old,next);};
function traced(source,worker){
 const c=worker?{root:'S.push(E);',rootVar:'E',push:'S.push(i)',pushVar:'i',pop:'const h=S.pop();if(!h)break;',popVar:'h',inactive:'(m.active=!1)',inactiveVar:'m'}:{root:'P.push(I);',rootVar:'I',push:'P.push(e)',pushVar:'e',pop:'const f=P.pop();if(!f)break;',popVar:'f',inactive:'(i.active=!1)',inactiveVar:'i'};
 source=once(source,c.root,c.root+`globalThis.__scheduledRecord('root',${c.rootVar});`);
 source=once(source,c.push,`${c.push},globalThis.__scheduledRecord('accept',${c.pushVar})`);
 source=once(source,c.pop,c.pop+`globalThis.__scheduledRecord('pop',${c.popVar});`);
 source=once(source,c.inactive,`(${c.inactiveVar}.active=!1,globalThis.__scheduledRecord('inactive',${c.inactiveVar}),!1)`);
 return source;
}
const engines=[];
for(const file of scheduledLabelAssets){
 const url=new URL('../../dist/assets/'+file,import.meta.url),source=restoreScheduledLabelBuckets(readFileSync(url,'utf8')),worker=file.startsWith('app-');
 const load=async(input,name)=>{
  input=traced(input,worker);
  if(worker){
   const context={self:{},setTimeout,clearTimeout,DOMException,console,__scheduledRecord:record};
   for(const match of input.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)";/g)){const module=await import(new URL(match[2],url).href);for(const binding of match[1].split(',')){const [name,alias]=binding.trim().split(/\s+as\s+/);context[alias??name]=module[name];}}
   input=input.replace(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)";/g,'').replace('let tt;self.onmessage','globalThis.engine={scheduled:Dt,router:jt,prepare:Ae};let tt;self.onmessage');vm.createContext(context);vm.runInContext(input,context);return context.engine;
  }
  input=input.replace(/from\s*["'](\.\.?\/[^"']+)["']/g,(_,p)=>'from '+JSON.stringify(new URL(p,url).href));input+='\nexport {Xe as scheduled,ft as router,Ae as prepare};';const path=join(dir,name+'.mjs');writeFileSync(path,input);return import(pathToFileURL(path).href);
 };
 engines.push({file,baseline:await load(source,file+'-baseline'),candidate:await load(patchScheduledLabelBuckets(source).source,file+'-candidate')});
}
const xy=i=>[114.16+i*.0001,22.28];
const pattern=(id,from,to,duration,departures,mode='bus')=>({id,routeId:id,label:id,mode,direction:from+'>'+to,stops:[{stopId:from,arrivalOffsetS:0,departureOffsetS:0,shapeIndex:0},{stopId:to,arrivalOffsetS:duration,departureOffsetS:duration,shapeIndex:1}],shape:[xy(0),xy(1)],schedule:{departuresS:departures},provenance:{scheduleKind:'scheduled'}});
const connection=(id,fromId,toId,durationS,rest={})=>({id,fromId,toId,kind:'walk',durationS,...rest});
function run(engine,network,request,resolverFactory){
 trace=[];const calls=[],resolver=resolverFactory?.(calls);let result,error;
 try{result=structuredClone(engine.scheduled(structuredClone(network),{...request,...resolver?{resolveConnectionAt:resolver}:{}}));}catch(e){error={name:e.name,message:e.message};}
 return{result,error,trace:structuredClone(trace),calls};
}
function paired(engines,network,request,resolverFactory,label){
 const a=run(engines.baseline,network,request,resolverFactory),b=run(engines.candidate,network,request,resolverFactory);assert.deepEqual(b,a,engines.file+' '+label);return b;
}
test('complete scheduled engines preserve all accepted labels, inactive transitions, heap pop order and final itineraries',()=>{
 const network={patterns:[],connections:[connection('ab','a','b',5,{preferencePenaltyS:10}),connection('ac','a','c',2),connection('cb','c','b',3),connection('bd','b','d',20)]};
 for(const engine of engines)for(const boundary of [undefined,[],[0],[5],[25],[100],[NaN,Infinity,-Infinity,5]]){
  const result=paired(engine,network,{fromId:'a',toId:'d',departureS:0,horizonS:100,walkPenalty:2.5,connectionOpeningTimesS:boundary},calls=>(edge,time)=>{calls.push([edge.id,time]);return edge;},JSON.stringify(boundary));
  assert.ok(result.trace.some(x=>x.stage==='inactive'));assert.equal(result.result.arrivalS,25);
 }
});
test('random complete-engine oracles cover pre/post boundary states, modes, transfers, openings, null resolution and exact fractional clocks',()=>{
 let seed=946781;const next=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};let compared=0;
 for(let runId=0;runId<100;runId++){
  const connections=[],patterns=[];for(let n=0;n<12;n++){const from=next(5),to=next(5);if(from===to)continue;connections.push(connection('c'+n,'n'+from,'n'+to,[0,.1,1/3,1,5,10][next(6)],{kind:next(7)===0?'metro':'walk',preferencePenaltyS:next(3),openingS:next(3)===0?10+next(30):0,closed:next(15)===0}));}
  for(let n=0;n<4;n++){const from=next(5),to=(from+1+next(4))%5;patterns.push(pattern('p'+n,'n'+from,'n'+to,next(10),[0,5,10,20,30,50,70],next(2)?'bus':'tram'));}
  const network={connections,patterns},request={fromId:'n0',toId:runId%4===0?'unreachable':'n4',departureS:[-0,0,.1,5,19.999999999999996,20][runId%6],horizonS:80,walkPenalty:[1,2.5,4][runId%3],transferPenaltyS:[0,5,180][runId%3],connectionOpeningTimesS:runId%5===0?undefined:runId%5===1?[]:[10,20,40,Infinity,NaN],allowedModes:runId%2?['bus','tram','metro']:['bus']};
  const resolver=calls=>(edge,time)=>{calls.push([edge.id,time]);if(edge.closed)return null;return{...edge,durationS:edge.durationS+Math.max(0,edge.openingS-time)};};
  for(const engine of engines){paired(engine,network,request,runId%4===1?undefined:resolver,'random '+runId);compared++;}
 }
 assert.equal(compared,200);console.log('paired scheduled output/state/call-order oracles',compared);
});
test('signed zero, exact boundary, horizon edge, invalid finite-clock inputs and resolver validation keep original behavior',()=>{
 const network={patterns:[],connections:[connection('ab','a','b',0),connection('bc','b','c',1)]};
 for(const engine of engines){
  for(const departureS of [-0,0,Number.MIN_VALUE,1-Number.EPSILON,1,1+Number.EPSILON])for(const boundary of [0,1,2])paired(engine,network,{fromId:'a',toId:'c',departureS,horizonS:2,connectionOpeningTimesS:[boundary]},calls=>(edge,time)=>{calls.push([edge.id,time]);return edge;},'boundary');
  for(const change of [{departureS:NaN},{departureS:Infinity},{horizonS:NaN},{horizonS:-1},{horizonS:7*86400+1},{walkPenalty:NaN},{walkPenalty:.5},{transferPenaltyS:Infinity},{transferPenaltyS:-1}]){
   const out=paired(engine,network,{fromId:'a',toId:'c',departureS:0,...change},undefined,'invalid request');assert.equal(out.error?.message,'Invalid route time/horizon/penalty');assert.equal(out.trace.length,0);
  }
  for(const change of [{durationS:NaN},{durationS:Infinity},{durationS:-1},{preferencePenaltyS:NaN},{fromId:'wrong'},{kind:'metro'},{geometry:[[NaN,0],[0,0]]}]){
   const out=paired(engine,network,{fromId:'a',toId:'c',departureS:0,horizonS:10},calls=>(edge,time)=>{calls.push([edge.id,time]);return {...edge,...change};},'invalid resolver');assert.match(out.error?.message??'',/Invalid resolved connection/);
  }
 }
});
test('resolver cancellation preserves the exact call prefix and state prefix',()=>{
 const network={patterns:[pattern('trip','a','b',1,[0,5,10,15])],connections:[connection('ab','a','b',2),connection('bc','b','c',3),connection('ca','c','a',4),connection('bd','b','d',2)]};
 for(const engine of engines)for(const at of [1,2,4]){
  const out=paired(engine,network,{fromId:'a',toId:'unreachable',departureS:0,horizonS:30,connectionOpeningTimesS:[20]},calls=>(edge,time)=>{calls.push([edge.id,time]);if(calls.length===at)throw new DOMException('Aborted','AbortError');return edge;},'cancel '+at);assert.equal(out.error?.name,'AbortError');assert.equal(out.calls.length,at);
 }
});
test('outer asynchronous routers preserve cancellation before work and at the existing cooperative yield',async()=>{
 const nodes=[0,1,2].map(i=>({id:'n'+i,region_id:'R',coordinates:xy(i)})),edges=[];
 for(const[from,to]of[[0,1],[1,0],[1,2],[2,1]]){const id=`e${from}-${to}`;edges.push({id,physical_id:id,from_id:'n'+from,to_id:'n'+to,region_id:'R',kind:'walk',name:id,length_m:10,duration_s:10,coordinates:[xy(from),xy(to)],geometry_mode:'official',location:1,source_id:'TEST',snap_eligible:true,accessible_eligible:true,disabled:false});}
 const raw={version:'fixture',nodes,edges,regions:[{id:'R',center:xy(0),radius_m:1000}],portals:nodes.map(n=>({id:'s'+n.id,node_id:n.id,region_id:'R',name:n.id,coordinates:n.coordinates}))},services={stops:[{id:'sn0',coordinates:xy(0),name:'a'},{id:'sn2',coordinates:xy(2),name:'b'}],patterns:[pattern('bus','sn0','sn2',1,[0,10,20,30])],connections:[]},links={graph_version:'fixture',preference:'fast',connections:[],warnings:[]};
 const request={origin:{lon:xy(0)[0],lat:xy(0)[1],node_id:'n0'},destination:{lon:xy(2)[0],lat:xy(2)[1],node_id:'n2'},preference:'fast',departureS:0,horizonS:100,allowedModes:['bus']};
 for(const engine of engines){
  const routers=[engine.baseline,engine.candidate].map(e=>e.router(e.prepare(structuredClone(raw)),structuredClone(services),structuredClone(links)));
  assert.deepEqual(structuredClone(await routers[1].route(request)),structuredClone(await routers[0].route(request)));
  for(const router of routers){let controller=new AbortController();controller.abort();await assert.rejects(router.route(request,controller.signal),{name:'AbortError'});controller=new AbortController();const pending=router.route(request,controller.signal);queueMicrotask(()=>controller.abort());await assert.rejects(pending,{name:'AbortError'});}
 }
});
test.after(()=>{delete globalThis.__scheduledRecord;rmSync(dir,{recursive:true,force:true});});
