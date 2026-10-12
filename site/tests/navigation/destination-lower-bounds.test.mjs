import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync,writeFileSync,mkdtempSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';import{pathToFileURL}from'node:url';
import{destinationLowerBounds}from'../../src/navigation/destination-lower-bounds.js';
import{compactLowerBounds}from'../../src/navigation/compact-lower-bounds.js';
import{patchDestinationLowerBounds,restoreDestinationLowerBounds,destinationLowerBoundAssets}from'../../scripts/repair-destination-lower-bounds.mjs';
const worker=readFileSync(new URL('../../dist/assets/app-transit-worker-CaCMeUxU.js',import.meta.url),'utf8');
const Heap=Function('const ue=(a,b)=>a<b?-1:a>b?1:0;'+worker.slice(worker.indexOf('class lt{'),worker.indexOf('function ft('))+';return lt;')();
const group=arcs=>{const map=new Map();for(const arc of arcs){const list=map.get(arc.from)??[];list.push(arc);map.set(arc.from,list);}return map;};
const arc=(from,to,seconds,kind='walk')=>({from,to,seconds,edge:{kind}});
const candidate=(id,real=false)=>({id,candidate:real?{node_id:id}:{}});
const config=(changes={})=>({prepared:true,originId:'B',destinationId:'O',originCandidates:[candidate('I')],destinationCandidates:[candidate('D')],overlay:group([arc('B','I',0),arc('I','n0',.1),arc('n2','D',.2),arc('D','O',0)]),mode:'walk',destinationKey:'full target request',seconds:a=>a.seconds,skip:a=>a.edge.kind==='metro',Heap,compact:compactLowerBounds,...changes});
const fixture=(arcs=[arc('n0','n1',.1),arc('n1','n2',.2)])=>{const graph={nodes:['n0','n1','n2'].map(id=>({id}))};return{graph,index:{nodeIds:new Set(graph.nodes.map(n=>n.id)),adjacency:group(arcs)}};};
function oracle(index,c){
 const reverse=new Map(),bounds=new Map([[c.destinationId,0]]),heap=new Heap();
 for(const map of[index.adjacency,c.overlay])for(const list of map.values())for(const edge of list){if(c.skip(edge))continue;const list=reverse.get(edge.to)??[];list.push({from:edge.from,seconds:c.seconds(edge)});reverse.set(edge.to,list);}
 for(heap.push({id:c.destinationId,access:0,cost:0,tie:''});heap.length;){const current=heap.pop();if(current.cost===bounds.get(current.id))for(const edge of reverse.get(current.id)??[]){const distance=current.cost+edge.seconds;if(distance<(bounds.get(edge.from)??Infinity)){bounds.set(edge.from,distance);heap.push({id:edge.from,access:0,cost:distance,tie:''});}}}
 return bounds;
}
function sameBounds(actual,expected,ids,label=''){
 assert.ok(actual,'guard unexpectedly rejected '+label);assert.equal(actual.size,expected.size,label+' size');
 for(const id of new Set([...ids,...expected.keys()]))assert.ok(Object.is(actual.get(id),expected.get(id)),label+' '+id+': '+actual.get(id)+' !== '+expected.get(id));
}
test('core is reused across origins; fractional shortcuts and exact target metadata stay request-specific',()=>{
 const {graph,index}=fixture(),c=config();const first=destinationLowerBounds(index,graph,c);sameBounds(first,oracle(index,c),['missing']);
 const next={...c,overlay:group([arc('B','I',0),arc('I','D',.125),arc('n2','D',.2),arc('D','O',0)])};
 const second=destinationLowerBounds(index,graph,next);sameBounds(second,oracle(index,next),['missing']);assert.equal(first.core,second.core);assert.notEqual(first.get('I'),second.get('I'));assert.equal(index.hkDestinationLowerBounds.cache.size,1);
 const differentTarget={...next,destinationKey:'same coordinates, different node_ids / floor / schedule'};destinationLowerBounds(index,graph,differentTarget);assert.equal(index.hkDestinationLowerBounds.cache.size,2);
 const differentFraction={...next,overlay:group([arc('B','I',0),arc('I','D',.125),arc('n2','D',.3),arc('D','O',0)])};destinationLowerBounds(index,graph,differentFraction);assert.equal(index.hkDestinationLowerBounds.cache.size,3);
 assert.equal(index.hkDestinationLowerBounds.reverseByMode.size,1);
});
test('invalid or unproved topology and mutable graphs request the unchanged fallback',()=>{
 const {graph,index}=fixture();
 const cases=[{prepared:false},{originId:'O'},{originId:'n0'},{destinationId:'n1'},
  {originCandidates:[candidate('n0')]},{originCandidates:[candidate('I'),candidate('I')]},
  {destinationCandidates:[candidate('I')]},{destinationCandidates:[candidate('D'),candidate('D')]},
  {overlay:group([arc('n1','I',0)])},{overlay:group([arc('I','B',0)])},
  {overlay:group([arc('I','unknown',0)])},{overlay:group([arc('B','n2',0)])},
  {overlay:group([arc('I','n0',NaN)])},{overlay:group([arc('I','n0',-1)])}];
 for(const c of cases)assert.equal(destinationLowerBounds(index,graph,config(c)),undefined,JSON.stringify(c));
 assert.equal(index.hkDestinationLowerBounds,undefined);
});
test('missing entries, infinite edges, signed-zero edges and mode exclusions match original strict relaxation',()=>{
 const {graph,index}=fixture([arc('n0','n1',Infinity),arc('n1','n2',-0),arc('n0','n2',1,'metro')]);
 const c=config({overlay:group([arc('B','I',-0),arc('I','n0',0),arc('n2','D',-0),arc('D','O',-0)])});
 const result=destinationLowerBounds(index,graph,c);sameBounds(result,oracle(index,c),['B','I','D','O','missing']);assert.equal(result.get('n0'),undefined);assert.ok(Object.is(result.get('n1'),0));
 const metro={...c,mode:'metro',destinationKey:'target metro',skip:()=>false};sameBounds(destinationLowerBounds(index,graph,metro),oracle(index,metro),['missing']);assert.equal(index.hkDestinationLowerBounds.reverseByMode.size,2);
 const bad=fixture([arc('n0','n1',NaN)]);assert.equal(destinationLowerBounds(bad.index,bad.graph,config()),undefined);
 const stored=compactLowerBounds(new Map([['n0',-0],['n1',NaN],['n2',Infinity],['extra',-Infinity]]),new Map([['n0',0],['n1',1],['n2',2]]));
 for(const [id,value] of [['n0',-0],['n1',NaN],['n2',Infinity],['extra',-Infinity],['missing',undefined]])assert.ok(Object.is(stored.get(id),value));
});
test('cache ownership, FIFO bounds and graph replacement preserve exact values without retaining query objects',()=>{
 const {graph,index}=fixture(),c=config();
 for(let i=0;i<65;i++){const request={...c,destinationKey:'target '+i};sameBounds(destinationLowerBounds(index,graph,request),oracle(index,request),['missing']);}
 const firstState=index.hkDestinationLowerBounds;assert.equal(firstState.cache.size,64);assert.equal(firstState.capacity,64);assert.equal(firstState.reverseByMode.size,1);
 assert.ok([...firstState.cache.keys()].every(key=>JSON.parse(key)[0]!=='target 0'));
 const other={nodeIds:index.nodeIds,adjacency:index.adjacency};destinationLowerBounds(other,graph,c);assert.notEqual(other.hkDestinationLowerBounds,firstState);
 const replacement={nodes:graph.nodes};index.adjacency=group([arc('n0','n2',9)]);sameBounds(destinationLowerBounds(index,replacement,c),oracle(index,c),['missing']);assert.notEqual(index.hkDestinationLowerBounds,firstState);
 const value=destinationLowerBounds(index,replacement,c);assert.deepEqual(Object.keys(value),['core','extra','size','get']);assert.equal('config' in index.hkDestinationLowerBounds,false);assert.equal('overlay' in value,false);
});
test('2000 random exact distance oracles cover zero cycles, fractions, disconnection, candidate order and reserved-ID collisions',()=>{
 let seed=812831;const next=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 const weights=[0,-0,Number.MIN_VALUE,Number.EPSILON,1/3,.1,.2,1,1e12,Infinity];
 for(let run=0;run<2000;run++){
  const ids=['n0','n1','n2','__area_origin__','__area_destination__','__origin_candidate_0__','__destination_candidate_0__'];
  const graph={nodes:ids.map(id=>({id}))},arcs=[];
  for(let i=0;i<30;i++)arcs.push(arc(ids[next(ids.length)],ids[next(ids.length)],weights[next(weights.length)],next(8)===0?'metro':'walk'));
  const index={nodeIds:new Set(ids),adjacency:group(arcs)},I=['__origin_candidate_0___','I1','I2'],D=['__destination_candidate_0___','D1'];
  const overlay=[];for(const id of I){overlay.push(arc('B',id,0));for(let n=0;n<4;n++)overlay.push(arc(id,ids[next(ids.length)],weights[next(weights.length)]));if(next(2))overlay.push(arc(id,D[next(D.length)],weights[next(weights.length)]));}
  overlay.push(arc('B',ids[next(ids.length)],0));
  for(const id of D){overlay.push(arc(id,'O',0));for(let n=0;n<3;n++)overlay.push(arc(ids[next(ids.length)],id,weights[next(weights.length)]));}
  const direct=overlay.find(a=>a.from==='B'&&index.nodeIds.has(a.to)).to;
  const c=config({originCandidates:[...I.map(id=>candidate(id)),candidate(direct,true)],destinationCandidates:D.map(id=>candidate(id)),overlay:group(overlay)});
  sameBounds(destinationLowerBounds(index,graph,c),oracle(index,c),[...ids,...I,...D,'B','O','missing'],'case '+run);
 }
});
test('all four production transforms are narrow, reversible, layered and idempotent',()=>{
 for(const file of destinationLowerBoundAssets){const source=restoreDestinationLowerBounds(readFileSync(new URL('../../dist/assets/'+file,import.meta.url),'utf8')),result=patchDestinationLowerBounds(source);assert.equal(result.changes,1);assert.equal(patchDestinationLowerBounds(result.source).changes,0);assert.equal(restoreDestinationLowerBounds(result.source),source);const layered='/* OTHER_TRANSFORM */\n'+result.source;assert.equal(patchDestinationLowerBounds(layered).source,layered);assert.equal(restoreDestinationLowerBounds(layered),'/* OTHER_TRANSFORM */\n'+source);const stale=result.source.replace('const extra=new Map();','const extra=new Map(); /* stale helper */');assert.equal(patchDestinationLowerBounds(stale).source,result.source);}
 assert.throws(()=>patchDestinationLowerBounds('unknown'),/installed first/);
});
const baselineUrl=new URL('../../dist/assets/mobile-navigation-DfEsS_7b.js',import.meta.url),original=restoreDestinationLowerBounds(readFileSync(baselineUrl,'utf8')),dir=mkdtempSync(join(tmpdir(),'hk-destination-oracle-'));
const materialize=(name,source)=>{
 const lookup=source.match(/let ([\w$]+)=[\w$]+\?(?:\/\* HK_DESTINATION_QUERY_BEGIN \*\/[\s\S]*?\/\* HK_DESTINATION_QUERY_END \*\/)?([\w$]+)\.remainingCache\.get\([\w$]+\):void 0;/);assert.ok(lookup);
 source=source.replace(/const ([\w$]+)=\{access:0,cost:0,tie:"",elapsed:0\}/,`globalThis.__hkBoundsCapture?.(${lookup[1]},${lookup[2]});$&`);
 source=source.replace(/from\s*["'](\.\.?\/[^"']+)["']/g,(_,p)=>'from '+JSON.stringify(new URL(p,baselineUrl).href));const path=join(dir,name+'.mjs');writeFileSync(path,source);return pathToFileURL(path).href;
};
globalThis.document={createElement:()=>({relList:{supports:()=>true}})};
const baseline=await import(materialize('baseline',original)),candidateEngine=await import(materialize('candidate',patchDestinationLowerBounds(original).source));
const schedule=(id,start,end)=>({access_time_id:id,access_schedule:{source_rule_id:id,kind:'daily',windows:[{start_s:start,end_s:end}]}});
test('paired full engines preserve exact outputs and all bounds across preferences, schedules, endpoint forms, no-wait and collisions',()=>{
 let seed=139171;const next=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};let compared=0,optimized=0;
 for(let run=0;run<24;run++){
  const xy=Array.from({length:6},(_,i)=>[114.16+i*.0001,22.28]);
  const ids=run%3===0?['__area_origin__','__area_destination__','__origin_candidate_0__','__destination_candidate_0__','__area_origin___','n5']:xy.map((_,i)=>'n'+i);
  const nodes=xy.map((coordinates,i)=>({id:ids[i],coordinates,region_id:'R',...(run%4===0&&i===2?{wait_allowed:false}:{})})),edges=[];
  for(let from=0;from<6;from++)for(let to=0;to<6;to++){
   if(from===to||next(4)===0)continue;const id=`e${from}-${to}`,duration=next(20),kind=['walk','walk','stairs','escalator','lift'][next(5)];
   edges.push({id,physical_id:id,from_id:ids[from],to_id:ids[to],region_id:'R',kind,name:id,length_m:duration,duration_s:duration,coordinates:[xy[from],xy[to]],geometry_mode:'official',location:1,snap_eligible:true,accessible_eligible:true,wheelchair_barrier:2,disabled:false,source_id:'TEST',...(kind==='lift'&&next(2)===0?{lift_ride_id:'ride'+next(2),lift_wait_s:duration/2}:{}),...(next(3)===0?schedule(id,next(10),50+next(40)):{})});
  }
  const raw={regions:[{id:'R',center:xy[0],radius_m:10000}],nodes,edges,portals:ids.map((node_id,i)=>({id:'p'+i,node_id,region_id:'R',coordinates:xy[i]}))};
  const a=baseline.p(structuredClone(raw)),b=candidateEngine.p(structuredClone(raw));
  const forms=[
   i=>({lon:xy[i][0],lat:xy[i][1],node_id:ids[i]}),
   i=>({lon:xy[i][0]+.000015,lat:xy[i][1]}),
   i=>({lon:xy[i][0],lat:xy[i][1],node_ids:[ids[i],ids[Math.min(i+1,5)]],floor:run%2?'upper':'lower'})
  ];
  const check=request=>{
   let expectedBounds,actualBounds,lastIndex;globalThis.__hkBoundsCapture=(bounds,index)=>{expectedBounds=bounds;};const expected=baseline.d(a,request);
   globalThis.__hkBoundsCapture=(bounds,index)=>{actualBounds=bounds;lastIndex=index;};const actual=candidateEngine.d(b,request);delete globalThis.__hkBoundsCapture;
   assert.deepEqual(actual,expected,`full case ${run}/${compared}`);
   if(expectedBounds&&actualBounds){assert.equal(actualBounds.size,expectedBounds.size);const all=[...ids,'missing'];for(const stem of ['__area_origin__','__area_destination__',...Array.from({length:20},(_,i)=>`__origin_candidate_${i}__`),...Array.from({length:20},(_,i)=>`__destination_candidate_${i}__`)])for(let n=0;n<5;n++)all.push(stem+'_'.repeat(n));for(const id of all)assert.ok(Object.is(actualBounds.get(id),expectedBounds.get(id)),`bound ${run}/${compared}/${id}`);if(actualBounds.core)optimized++;}
   compared++;return lastIndex;
  };
  for(const preference of ['fast','few_stairs','accessible','escalator_first','lift_first','luggage'])for(const departureS of [undefined,0,25])for(const form of forms){
   const destination={...form(5),...schedule('destination',5,100)},base={preference,mode:'walk',departureS,departureDate:run%2?'2026-10-11':'2026-10-12',destination};check({...base,origin:form(0)});check({...base,origin:form(1)});
  }
  // Same-place p=true must preserve the legacy path, including synthetic-ID allocation.
  const point=forms[1](0);check({origin:point,destination:point,preference:'fast',mode:'walk',departureS:25});
 }
 assert.equal(compared,2616);assert.ok(optimized>500,`optimized ${optimized}`);console.log('paired exact full-engine queries',compared,'optimized',optimized);
});
test('prepared cross-region rail queries preserve metro state, walk filtering and paid lift continuations',()=>{
 const xy=[[114.16,22.28,0],[114.1601,22.28,4],[114.17,22.28,4],[114.1701,22.28,0]],nodes=xy.map((coordinates,i)=>({id:'n'+i,region_id:i<2?'A':'B',coordinates})),edges=[];
 for(let from=0;from<4;from++)for(const to of [from-1,from+1])if(to>=0&&to<4){const id=`e${from}-${to}`,kind=Math.min(from,to)===1?'rail':'lift';edges.push({id,physical_id:id,from_id:'n'+from,to_id:'n'+to,region_id:from<2?'A':'B',kind,name:id,length_m:10,duration_s:kind==='rail'?80:30,coordinates:[xy[from],xy[to]],geometry_mode:'official',location:1,snap_eligible:true,accessible_eligible:true,wheelchair_barrier:2,disabled:false,source_id:'TEST',...(kind==='lift'?{lift_ride_id:'ride'+Math.min(from,to),lift_wait_s:20}:{}),...schedule(id,5,80000)});}
 const raw={nodes,edges,regions:[{id:'A',center:xy[0],radius_m:70},{id:'B',center:xy[2],radius_m:70}],portals:nodes.map(n=>({id:'p'+n.id,node_id:n.id,region_id:n.region_id,coordinates:n.coordinates}))};
 const a=baseline.p(structuredClone(raw)),b=candidateEngine.p(structuredClone(raw));let compared=0;
 for(const preference of ['fast','few_stairs','accessible','escalator_first','lift_first','luggage'])for(const mode of [undefined,'metro','walk'])for(const departureS of [0,10,120])for(const originIndex of [0,1]){
  const request={origin:{lon:xy[originIndex][0],lat:xy[originIndex][1],node_id:'n'+originIndex},destination:{lon:xy[3][0],lat:xy[3][1],node_id:'n3'},preference,mode,departureS};
  assert.deepEqual(candidateEngine.d(b,request),baseline.d(a,request),`rail ${preference}/${mode}/${departureS}/${originIndex}`);compared++;
 }
 assert.equal(compared,108);
});
test('legacy fallback and destination caches can coexist and are separately bounded on one prepared owner',()=>{
 const xy=[[114.16,22.28],[114.1601,22.28],[114.1602,22.28]],nodes=xy.map((coordinates,i)=>({id:'n'+i,coordinates,region_id:'R'})),edges=[];
 for(const [from,to] of [[0,1],[1,0],[1,2],[2,1]]){const id=`e${from}-${to}`;edges.push({id,physical_id:id,from_id:'n'+from,to_id:'n'+to,region_id:'R',kind:'walk',name:id,length_m:10,duration_s:10,coordinates:[xy[from],xy[to]],geometry_mode:'official',location:1,snap_eligible:true,accessible_eligible:true,disabled:false,source_id:'TEST',...schedule(id,0,80000)});}
 const graph=candidateEngine.p({regions:[{id:'R',center:xy[0],radius_m:1000}],nodes,edges,portals:nodes.map(n=>({id:'p'+n.id,node_id:n.id,region_id:'R',coordinates:n.coordinates}))});
 let owner;globalThis.__hkBoundsCapture=(_,index)=>{owner=index;};
 for(let i=0;i<65;i++){
  const point={lon:xy[0][0],lat:xy[0][1],node_id:'n0',metadata:i};candidateEngine.d(graph,{origin:point,destination:point,preference:'fast',mode:'walk',departureS:10});
  candidateEngine.d(graph,{origin:point,destination:{lon:xy[2][0],lat:xy[2][1],node_id:'n2',metadata:i},preference:'fast',mode:'walk',departureS:10});
 }
 delete globalThis.__hkBoundsCapture;
 assert.equal(owner.remainingCache.size,64);assert.equal(owner.hkDestinationLowerBounds.cache.size,64);
 assert.notEqual(owner.hkLowerBoundNodes.nodeIndex,owner.hkDestinationLowerBounds.nodeIndex);
 const sum=cache=>[...cache.values()].reduce((total,entry)=>total+entry.byteLength,0);
 assert.equal(sum(owner.remainingCache)+sum(owner.hkDestinationLowerBounds.cache),128*25);
});
test.after(()=>{delete globalThis.__hkBoundsCapture;rmSync(dir,{recursive:true,force:true});});
