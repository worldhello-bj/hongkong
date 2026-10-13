import test from'node:test';import assert from'node:assert/strict';import{readFileSync,writeFileSync,mkdtempSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';import{pathToFileURL}from'node:url';
import{patchUnreachableBounds,restoreUnreachableBounds,unreachableBoundAssets}from'../../scripts/repair-unreachable-bounds.mjs';
test('all four static no-route guards are exact, reversible and idempotent',()=>{
 for(const file of unreachableBoundAssets){const source=restoreUnreachableBounds(readFileSync(new URL('../../dist/assets/'+file,import.meta.url),'utf8')),patched=patchUnreachableBounds(source);assert.equal(patched.changes,1);assert.equal(patchUnreachableBounds(patched.source).changes,0);assert.equal(restoreUnreachableBounds(patched.source),source)}
 assert.throws(()=>patchUnreachableBounds('drift'),/Expected one/);
});
const url=new URL('../../dist/assets/mobile-navigation-DfEsS_7b.js',import.meta.url),source=restoreUnreachableBounds(readFileSync(url,'utf8')),dir=mkdtempSync(join(tmpdir(),'hk-static-unreachable-'));
globalThis.document={createElement:()=>({relList:{supports:()=>true}})};
const materialize=(name,text)=>{const path=join(dir,name+'.mjs');text=text.replace(/from\s*["'](\.\.?\/[^"']+)["']/g,(_,p)=>'from '+JSON.stringify(new URL(p,url).href));writeFileSync(path,text);return import(pathToFileURL(path).href)};
const original=await materialize('original',source),patched=patchUnreachableBounds(source).source;
const guarded=await materialize('guarded',patched.replace(/(if\([\w$]+&&[\w$]+\.get\([\w$]+\)===undefined\))return ([\s\S]*?);\/\* HK_STATIC_UNREACHABLE_END \*\//,'$1{globalThis.__staticBoundRejects++;return $2;}/* HK_STATIC_UNREACHABLE_END */'));
const schedule=(id,start,end)=>({access_time_id:id,access_schedule:{source_rule_id:id,kind:'daily',windows:[{start_s:start,end_s:end}]}});
test('full engine diagnostics, coordinates, clock rules and reachable paths match across disconnected directed components',()=>{
 let seed=7731,compared=0,success=0;globalThis.__staticBoundRejects=0;const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n};
 for(let run=0;run<36;run++){
  const xy=Array.from({length:7},(_,i)=>[114.16+i*.0001,22.28]),ids=run%4===0?['__area_origin__','__area_destination__','n2','n3','n4','n5','n6']:xy.map((_,i)=>'n'+i),nodes=xy.map((coordinates,i)=>({id:ids[i],region_id:'R',coordinates,...(run%3===0&&i===2?{wait_allowed:false}:{})})),edges=[];
  for(let a=0;a<7;a++)for(let b=0;b<7;b++){
   if(a===b||random(3)===0||(run%2===0&&a<4&&b>=4))continue;
   const id=`e${a}-${b}`,duration=1+random(20);edges.push({id,physical_id:id,from_id:ids[a],to_id:ids[b],region_id:'R',kind:['walk','walk','stairs','escalator','lift'][random(5)],name:id,length_m:duration,duration_s:duration,coordinates:[xy[a],xy[b]],geometry_mode:'official',source_id:'fixture',disabled:false,snap_eligible:true,accessible_eligible:true,...schedule(id,random(10),80+random(50))});
  }
  const graph={version:'fixture',regions:[{id:'R',center:xy[0],radius_m:10000}],nodes,edges,portals:ids.map((id,i)=>({id:'p'+i,node_id:id,region_id:'R',coordinates:xy[i]}))},a=original.p(structuredClone(graph)),b=guarded.p(structuredClone(graph));
  for(const preference of['fast','few_stairs','accessible','escalator_first','lift_first','luggage'])for(const departureS of[undefined,0,50])for(const reverse of[false,true]){
   const from=reverse?6:0,to=reverse?0:6,request={origin:{lon:xy[from][0],lat:xy[from][1],node_id:ids[from]},destination:{lon:xy[to][0],lat:xy[to][1],node_id:ids[to],...schedule('destination',1,200)},preference,mode:run%3===1?'metro':'walk',departureS,departureDate:run%2?'2026-10-11':'2026-10-12'};
   const expected=original.d(a,request),actual=guarded.d(b,request);assert.deepEqual(actual,expected,`${run}/${preference}/${departureS}/${reverse}`);compared++;if(actual.status==='CONDITIONAL')success++;
  }
 }
 assert.equal(compared,1296);assert.ok(success>0);assert.ok(globalThis.__staticBoundRejects>100);console.log('exact static-disconnection oracle',compared,'successful',success,'proven early rejections',globalThis.__staticBoundRejects);delete globalThis.__staticBoundRejects;
});
test.after(()=>rmSync(dir,{recursive:true,force:true}));
