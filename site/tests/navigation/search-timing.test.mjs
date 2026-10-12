import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync,writeFileSync,mkdtempSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';import{pathToFileURL}from'node:url';
import{searchTimingProfile}from'../../src/navigation/search-timing.js';import{patchSearchPreparation,restoreSearchPreparation,searchAssets}from'../../scripts/repair-search-preparation.mjs';
import{patchLowerBoundCache,restoreLowerBoundCache}from'../../scripts/repair-lower-bound-cache.mjs';
import{restoreDestinationLowerBounds}from'../../scripts/repair-destination-lower-bounds.mjs';
const freeze=o=>{for(const v of Object.values(o))if(v&&typeof v==='object')freeze(v);return Object.freeze(o)};
test('prepared graph timing metadata is reused; endpoints/date are not cached and graph owners stay isolated',()=>{
 let tested=0;const has=e=>{tested++;return!!e.schedule},always=e=>!!e.always;
 const g=freeze({nodes:[{}],edges:[{}, {schedule:true},{schedule:true,always:true}]}),index={};
 const a=searchTimingProfile(index,g,true,has,always);assert.equal(tested,3);assert.deepEqual(a.scheduledEdges,[g.edges[1]]);assert.equal(a.waitingAllowed,true);
 assert.equal(searchTimingProfile(index,g,true,has,always),a);assert.equal(tested,3);
 const other=freeze({nodes:[{wait_allowed:false}],edges:[]});assert.equal(searchTimingProfile(index,other,true,has,always).waitingAllowed,false);assert.notEqual(searchTimingProfile({},g,true,has,always),a);
 const mutable={nodes:[{}],edges:[{schedule:true}]},rawIndex={};assert.equal(searchTimingProfile(rawIndex,mutable,false,has,always).waitingAllowed,true);mutable.nodes[0].waiting_allowed=false;assert.equal(searchTimingProfile(rawIndex,mutable,false,has,always).waitingAllowed,false);assert.equal(rawIndex.hkSearchTimingProfile,undefined);
});
test('all four production engines are patched narrowly, idempotently and without ancestor/ordering changes',()=>{
 for(const file of searchAssets){const source=restoreSearchPreparation(restoreLowerBoundCache(restoreDestinationLowerBounds(readFileSync(new URL('../../dist/assets/'+file,import.meta.url),'utf8')))),result=patchSearchPreparation(source);assert.equal(result.changes,2);assert.match(result.source,/HK_FROZEN_GRAPH_TIMING_V1/);assert.doesNotMatch(result.source,/HK_FIFO_ANCESTRY_GUARD_V1/);assert.equal(patchSearchPreparation(result.source).changes,0);assert.equal(restoreSearchPreparation(result.source),source)}
 assert.throws(()=>patchSearchPreparation('unrecognized bundle'),/exactly one/);
});
const baselineUrl=new URL('../../dist/assets/mobile-navigation-DfEsS_7b.js',import.meta.url);
let original=restoreSearchPreparation(restoreLowerBoundCache(restoreDestinationLowerBounds(readFileSync(baselineUrl,'utf8'))));
const dir=mkdtempSync(join(tmpdir(),'hk-timing-oracle-'));
const materialize=(name,source)=>{const path=join(dir,name+'.mjs');source=source.replace(/from\s*["'](\.\.?\/[^"']+)["']/g,(_,p)=>'from '+JSON.stringify(new URL(p,baselineUrl).href));writeFileSync(path,source);return pathToFileURL(path).href};
globalThis.document={createElement:()=>({relList:{supports:()=>true}})};
const baseline=await import(materialize('baseline',original)),candidate=await import(materialize('candidate',patchLowerBoundCache(patchSearchPreparation(original).source).source));
const schedule=(id,start,end)=>({access_time_id:id,access_schedule:{source_rule_id:id,kind:'daily',windows:[{start_s:start,end_s:end}]}});
const prefs=['fast','few_stairs','accessible','escalator_first','lift_first','luggage'];
test('720 paired full-engine queries preserve exact route/time/geometry across preferences, dynamic dates/endpoints and no-wait graphs',()=>{
 let seed=9471;const next=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n};let compared=0,success=0;
 for(let caseId=0;caseId<40;caseId++){
  const xy=Array.from({length:5},(_,i)=>[114.16+i*.0001,22.28]);
  const nodes=xy.map((coordinates,i)=>({id:'n'+i,coordinates,region_id:'R',...(caseId%3===0&&i===2?{wait_allowed:false}:{})}));
  const edges=[];for(let from=0;from<5;from++)for(let to=0;to<5;to++){if(from===to||next(3)===0)continue;const id=`e${from}-${to}`,duration=1+next(20),kind=['walk','walk','stairs','escalator','lift'][next(5)];edges.push({id,physical_id:id,from_id:'n'+from,to_id:'n'+to,region_id:'R',kind,name:id,length_m:duration,duration_s:duration,coordinates:[xy[from],xy[to]],geometry_mode:'official',snap_eligible:true,accessible_eligible:true,disabled:next(20)===0,source_id:'TEST',...(next(3)===0?schedule(id,next(20),80+next(40)):{})})}
  const raw={regions:[{id:'R',center:xy[0],radius_m:10000}],nodes,edges,portals:[0,4].map(i=>({id:'p'+i,node_id:'n'+i,region_id:'R',coordinates:xy[i]}))};
  const a=baseline.p(structuredClone(raw)),b=candidate.p(structuredClone(raw));
  for(const preference of prefs)for(const departureS of [undefined,0,50]){
   const origin={lon:xy[0][0],lat:xy[0][1],node_id:'n0'},destination={lon:xy[4][0],lat:xy[4][1],node_id:'n4',...(caseId%2?schedule('destination',10,100):{})};
   const request={origin,destination,preference,mode:'walk',departureS,departureDate:caseId%2?'2026-10-11':'2026-10-12'};
   const actual=candidate.d(b,request),expected=baseline.d(a,request);assert.deepEqual(actual,expected,`case${caseId}/${preference}/${departureS}`);compared++;if(actual.status==='CONDITIONAL')success++;
  }
 }
 assert.equal(compared,720);assert.ok(success>0);console.log('paired exact queries',compared,'complete',success);
});
test('repeated endpoints beyond old eight-entry cache retain exact full-engine outputs',()=>{
 const xy=Array.from({length:40},(_,i)=>[114.16+i*.0001,22.28]);
 const nodes=xy.map((coordinates,i)=>({id:'n'+i,coordinates,region_id:'R'})),edges=[];
 for(let i=0;i<39;i++)for(const [from,to] of [[i,i+1],[i+1,i]])edges.push({id:`e${from}-${to}`,physical_id:`e${from}-${to}`,from_id:'n'+from,to_id:'n'+to,region_id:'R',kind:'walk',name:`e${from}-${to}`,disabled:false,length_m:10,duration_s:10,coordinates:[xy[from],xy[to]],geometry_mode:'official',snap_eligible:true,accessible_eligible:true,source_id:'TEST',...schedule('open',1,80000)});
 const raw={regions:[{id:'R',center:xy[0],radius_m:10000}],nodes,edges,portals:Array.from({length:40},(_,i)=>i).map(i=>({id:'p'+i,node_id:'n'+i,region_id:'R',coordinates:xy[i]}))};
 const a=baseline.p(structuredClone(raw)),b=candidate.p(structuredClone(raw));let complete=0;
 for(let pass=0;pass<3;pass++)for(let k=1;k<38;k++){
  const i=pass%2?38-k:k;
  const request={origin:{lon:xy[0][0],lat:xy[0][1],node_id:'n0'},destination:{lon:xy[i][0],lat:xy[i][1],node_id:'n'+i},preference:'fast',mode:'walk',departureS:pass*600,departureDate:'2026-10-12'};
  const actual=candidate.d(b,request);assert.deepEqual(actual,baseline.d(a,request),`pass${pass}/n${i}`);if(actual.status==='CONDITIONAL')complete++;
 }
 assert.equal(complete,111);
});
test.after(()=>rmSync(dir,{recursive:true,force:true}));

// Isolate the new horizon guard from all previously installed preparation/cache work.
test('FIFO discarded-opening scan alone preserves all four actual engines, including weekly dates and node/edge no-wait paths',async()=>{
 const vm=await import('node:vm');const engines=[];
 for(const file of searchAssets){
  const url=new URL('../../dist/assets/'+file,import.meta.url),old=readFileSync(url,'utf8');
  const raw=patchSearchPreparation(restoreSearchPreparation(old),{fifoOpeningScan:false}).source;
  const changed=patchSearchPreparation(raw,{timingCache:false}).source;
  // Install only a scalar call counter around the original horizon's opening-offset call.
  const counted=source=>source.replace(/(let ([\w$]+)=0;if\([\w$]+(?:&&!hkFifoWaiting)?\)for\(const [\w$]+ of [\w$]+\)for\(const [\w$]+ of )([\w$]+\([^)]*\))(\)\2=Math\.max)/,(_m,before,_h,call,after)=>before+'(globalThis.__horizonCalls++,'+call+')'+after);
  const load=async(source,label)=>{
   if(file.startsWith('mobile-')){const module=await import(materialize(label,counted(source)));return{prepare:module.p,walk:module.d,context:globalThis};}
   const context={self:{},setTimeout,clearTimeout,DOMException,console,__horizonCalls:0};
   for(const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)";/g)){const module=await import(new URL(match[2],url).href);for(const binding of match[1].split(',')){const[name,alias]=binding.trim().split(/\s+as\s+/);context[alias??name]=module[name];}}
   source=counted(source).replace(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)";/g,'');
   const [prepare,walk]=file.startsWith('app-walk')?['Ze','rt']:file.startsWith('metro-')?['Ee','We']:['Ae','ft'];
   source=source.replace('self.onmessage=',`globalThis.engine={prepare:${prepare},walk:${walk}};self.onmessage=`);vm.createContext(context);vm.runInContext(source,context);return{...context.engine,context};
  };
  engines.push({file,baseline:await load(raw,'horizon-old-'+file),candidate:await load(changed,'horizon-new-'+file)});
 }
 const weekly=(id)=>({access_time_id:id,access_schedule:{source_rule_id:id,timezone:'Asia/Hong_Kong',kind:'weekly',week_start:'MON',windows:[{start_s:10,end_s:80},{start_s:6*86400+5,end_s:6*86400+100}]}});
 let compared=0,success=0,oldFifoCalls=0,newFifoCalls=0,oldNonFifoCalls=0,newNonFifoCalls=0;
 for(const{file,baseline,candidate}of engines)for(const scenario of ['fifo-daily','fifo-weekly','node-no-wait','edge-no-wait','closed']){
  const xy=[[114.16,22.28],[114.1601,22.28],[114.1602,22.28]],nodes=xy.map((coordinates,i)=>({id:'n'+i,coordinates,region_id:'R',...scenario==='node-no-wait'&&i===1?{wait_allowed:false}:{}}));
  const edges=[[0,1],[1,2],[0,2],[2,1],[1,0]].map(([a,b],i)=>({id:'e'+i,physical_id:'e'+i,from_id:'n'+a,to_id:'n'+b,region_id:'R',kind:i===2?'stairs':'walk',name:'e'+i,length_m:i===2?35:10,duration_s:i===2?35:10,coordinates:[xy[a],xy[b]],geometry_mode:'official',snap_eligible:true,accessible_eligible:true,source_id:'TEST',disabled:scenario==='closed',...i===0?(scenario==='fifo-weekly'?weekly('edge'):schedule('edge',10,80)):{},...scenario==='edge-no-wait'&&i===0?{waiting_allowed:false}:{}}));
  const raw={regions:[{id:'R',center:xy[0],radius_m:1000}],nodes,edges,portals:nodes.map(n=>({id:'p'+n.id,node_id:n.id,coordinates:n.coordinates,region_id:'R'}))},a=baseline.prepare(structuredClone(raw)),b=candidate.prepare(structuredClone(raw));
  for(const preference of prefs)for(const departureS of [0,50,90])for(const departureDate of ['2026-10-11','2026-10-12','not-a-date']){
   const request={origin:{lon:xy[0][0],lat:xy[0][1],node_id:'n0',...schedule('origin',5,110)},destination:{lon:xy[2][0],lat:xy[2][1],node_id:'n2',...weekly('destination')},preference,mode:'walk',departureS,departureDate};
   baseline.context.__horizonCalls=0;const expected=structuredClone(baseline.walk(a,request)),oldCalls=baseline.context.__horizonCalls;
   candidate.context.__horizonCalls=0;const actual=structuredClone(candidate.walk(b,request)),newCalls=candidate.context.__horizonCalls;
   assert.deepEqual(actual,expected,`${file}/${scenario}/${preference}/${departureS}/${departureDate}`);compared++;if(actual.status==='CONDITIONAL')success++;
   if(scenario.includes('no-wait')){assert.equal(newCalls,oldCalls);oldNonFifoCalls+=oldCalls;newNonFifoCalls+=newCalls;}else{assert.equal(newCalls,0);oldFifoCalls+=oldCalls;newFifoCalls+=newCalls;}
  }
 }
 assert.equal(compared,1080);assert.ok(success>0);assert.ok(oldFifoCalls>0);assert.equal(newFifoCalls,0);assert.ok(oldNonFifoCalls>0);assert.equal(newNonFifoCalls,oldNonFifoCalls);console.log('isolated horizon oracle',{compared,success,oldFifoCalls,newFifoCalls,oldNonFifoCalls,newNonFifoCalls});
});
