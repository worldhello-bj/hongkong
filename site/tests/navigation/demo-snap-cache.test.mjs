import test from'node:test';import assert from'node:assert/strict';import vm from'node:vm';
import{readFileSync,writeFileSync,mkdtempSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';import{pathToFileURL}from'node:url';
import{demoSnapCacheAssets,patchDemoSnapCache,restoreDemoSnapCache}from'../../scripts/repair-demo-snap-cache.mjs';
globalThis.document??={createElement:()=>({relList:{supports:()=>true}})};
const engines=[];
for(const file of demoSnapCacheAssets){
 const url=new URL('../../dist/assets/'+file,import.meta.url),raw=restoreDemoSnapCache(readFileSync(url,'utf8'));
 const snap=raw.match(/function ([\w$]+)\(([\w$]+),([\w$]+),([\w$]+),([\w$]+)\)\{const [^;]+\.snapCache\.get\([^;]+;/);
 const index=raw.match(/let ([\w$]+)=([\w$]+)\?\.get\(([\w$]+)\.preference\);\1\|\|\(\1=([\w$]+)\(([\w$]+),\3\.preference\),\2\?\.set\(\3\.preference,\1\)\);/);
 assert(snap&&index,file);
 const load=async source=>{const context={self:{},console,setTimeout,clearTimeout,DOMException,document:globalThis.document};
  for(const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)";/g)){const module=await import(new URL(match[2],url).href);for(const binding of match[1].split(',')){const[name,alias]=binding.trim().split(/\s+as\s+/);context[alias??name]=module[name];}}
  source=source.replace(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)";/g,'').replace(/export\{[^;]+;/g,'');
  source=source.replace('function '+snap[1]+'(',`globalThis.audit={index:${index[4]},candidates:${snap[1]}};function ${snap[1]}(`);
  vm.createContext(context);vm.runInContext(source,context);return context.audit;
 };
 engines.push({file,raw,baseline:await load(raw),candidate:await load(patchDemoSnapCache(raw).source)});
}
const p=[114.165,22.279,0],q=[114.1651,22.279,0];
const graph=()=>({nodes:[{id:'a',region_id:'R',coordinates:p},{id:'b',region_id:'R',coordinates:q}],edges:[{id:'e',physical_id:'e',from_id:'a',to_id:'b',region_id:'R',kind:'walk',name:'e',length_m:10,duration_s:10,location:1,coordinates:[p,q],geometry_mode:'official',source_id:'TEST',snap_eligible:true,accessible_eligible:true,disabled:false}],regions:[{id:'R',center:p.slice(0,2),radius_m:1000}],portals:[]});
const point=z=>({lon:114.16505,lat:22.279,demoSourceCoordinates:[114.16505,22.279,z]});
const owner=(engine,guard=true)=>{const index=engine.index(graph(),'fast');if(guard)index.hkDemoSnapGuard=()=>true;return index;};
const query=(engine,index,z,mode='walk')=>engine.candidates(index,point(z),graph().regions[0],mode);
test('four-engine key repair is reversible, idempotent, layered and anchor-checked',()=>{
 for(const{raw}of engines){const r=patchDemoSnapCache(raw);assert.equal(r.changes,1);assert.equal(restoreDemoSnapCache(r.source),raw);assert.equal(patchDemoSnapCache(r.source).changes,0);assert.equal(restoreDemoSnapCache('/* outer */\n'+r.source),'/* outer */\n'+raw);assert.throws(()=>patchDemoSnapCache(raw+raw),/drift/);assert.throws(()=>patchDemoSnapCache(r.source.replace('/* HK_DEMO_SNAP_CACHE_HEIGHT_V1 */\n','')),/unmarked/);}
 assert.throws(()=>patchDemoSnapCache('unknown'),/drift/);
});
for(const{file,baseline,candidate}of engines){
 test(file+': reproduce both unsafe warm orders and retain exact cold-height candidates',()=>{
  const a=owner(baseline);assert.equal(query(baseline,a,0).length,1);assert.equal(query(baseline,a,10).length,1);assert.equal(query(baseline,owner(baseline),10).length,0);
  const b=owner(baseline);assert.equal(query(baseline,b,10).length,0);assert.equal(query(baseline,b,0).length,0);
  for(const order of[[0,10,1,-1,1.0001,-1.0001,0],[10,0,-1.0001,1.0001,-1,1,10]]){const index=owner(candidate);for(const z of order){const req=point(z),before=structuredClone(req);assert.deepEqual(structuredClone(candidate.candidates(index,req,graph().regions[0],'walk')),structuredClone(query(candidate,owner(candidate),z)));assert.deepEqual(req,before);}}
 });
 test(file+': unguarded keys and absent/nonfinite filtering are unchanged, equal heights still hit',()=>{
  for(const guarded of[false,true]){const index=owner(candidate,guarded);for(const z of[undefined,null,NaN,Infinity,-Infinity])assert.equal(query(candidate,index,z).length,1);const same=query(candidate,index,0);assert.equal(query(candidate,index,-0),same);assert.equal(query(candidate,index,0),same);if(!guarded){assert.equal(query(candidate,index,10),same);assert.equal([...index.snapCache.keys()][0],`walk:R:${point(0).lon}:${point(0).lat}`);}}
 });
}
const dir=mkdtempSync(join(tmpdir(),'hk-snap-key-'));
test.after(()=>rmSync(dir,{recursive:true,force:true}));
test('full actual mobile router with real land guard matches cold outcomes for repeated endpoint heights',async()=>{
 const entry=engines.find(e=>e.file.startsWith('mobile')),base=new URL('../../dist/assets/'+entry.file,import.meta.url);
 const load=async(name,source)=>{const path=join(dir,name+'.mjs');writeFileSync(path,source.replace(/from\s*["'](\.\.?\/[^"']+)["']/g,(_,p)=>'from '+JSON.stringify(new URL(p,base).href)));return import(pathToFileURL(path).href);};
 const old=await load('old',entry.raw),fixed=await load('fixed',patchDemoSnapCache(entry.raw).source);
 const raw=graph();raw.portals=[{id:'target',node_id:'b',region_id:'R',coordinates:q}];raw.demo_connector_geography=[{kind:'land',d:'M-100,-100L100,-100L100,100L-100,100Z'},{kind:'water',d:'M-90,-90L-80,-90L-80,-80L-90,-80Z'}];
 const request=z=>({origin:{lon:p[0],lat:p[1],coordinates:p.slice(0,2),demoSourceCoordinates:[p[0],p[1],z]},destination:{lon:q[0],lat:q[1],node_id:'b'},mode:'walk',preference:'fast',departureS:39600,departureDate:'2026-10-12'});
 const prior=old.p(structuredClone(raw));assert.equal(old.d(prior,request(0)).status,'CONDITIONAL');assert.equal(old.d(prior,request(10)).status,'CONDITIONAL');assert.equal(old.d(old.p(structuredClone(raw)),request(10)).status,'NO_ROUTE');
 for(const order of[[0,10,0],[10,0,10]]){const prepared=fixed.p(structuredClone(raw));for(const z of order){const req=request(z),before=structuredClone(req);assert.deepEqual(fixed.d(prepared,req),fixed.d(fixed.p(structuredClone(raw)),req));assert.deepEqual(req,before);}}
});
