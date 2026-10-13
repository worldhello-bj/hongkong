import test from'node:test';import assert from'node:assert/strict';import{readFileSync,writeFileSync,mkdtempSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';import{pathToFileURL}from'node:url';
import{exactSourceRegion}from'../../src/navigation/endpoint-region.js';import{endpointRegionAssets,patchEndpointRegion,restoreEndpointRegion}from'../../scripts/repair-endpoint-region.mjs';
test('source region wins overlapping bounds, unknown/conflicting identities fail closed, mutable snapshots do not stale',()=>{
 const g={nodes:[{id:'n',region_id:'HUH'},{id:'other',region_id:'AUS'}],regions:[{id:'AUS'},{id:'HUH'}]};
 assert.equal(exactSourceRegion(g,{node_id:'n'}).region.id,'HUH');assert.equal(exactSourceRegion(g,{node_ids:['n']}).region.id,'HUH');
 assert.equal(exactSourceRegion(g,{}),null);assert.equal(exactSourceRegion(g,{node_id:'missing'}).region,undefined);assert.equal(exactSourceRegion(g,{node_ids:['n','other']}).region,undefined);
 g.nodes[0].region_id='AUS';assert.equal(exactSourceRegion(g,{node_id:'n'}).region.id,'AUS');
});
test('all four selector patches are narrow, reversible and idempotent',()=>{
 for(const file of endpointRegionAssets){const source=restoreEndpointRegion(readFileSync(new URL('../../dist/assets/'+file,import.meta.url),'utf8')),patched=patchEndpointRegion(source);assert.equal(patched.changes,1);assert.equal(patchEndpointRegion(patched.source).changes,0);assert.equal(restoreEndpointRegion(patched.source),source);}
 assert.throws(()=>patchEndpointRegion('unknown'),/exactly one/);
});
const baseUrl=new URL('../../dist/assets/mobile-navigation-DfEsS_7b.js',import.meta.url),source=restoreEndpointRegion(readFileSync(baseUrl,'utf8')),dir=mkdtempSync(join(tmpdir(),'hk-region-'));
const load=async(name,code)=>{const path=join(dir,name+'.mjs');writeFileSync(path,code.replace(/from\s*["'](\.\.?\/[^"']+)["']/g,(_,p)=>'from '+JSON.stringify(new URL(p,baseUrl).href)));return import(pathToFileURL(path).href)};
globalThis.document={createElement:()=>({relList:{supports:()=>true}})};
const old=await load('old',source),fixed=await load('fixed',patchEndpointRegion(source).source);
test('actual engine reaches exact source lift despite preceding overlapping acquisition region, without changing XYZ/facilities',()=>{
 const raw=JSON.parse(readFileSync(new URL('./fixtures/kow-c1-corridor-small.json',import.meta.url))),lift=raw.edges.find(e=>e.kind==='lift');
 raw.regions.unshift({...raw.regions[0],id:'AUS',radius_m:4400});
 const point=id=>{const n=raw.nodes.find(n=>n.id===id);return {node_id:id,coordinates:n.coordinates,lon:n.coordinates[0],lat:n.coordinates[1]}};
 const a=old.p(structuredClone(raw)),b=fixed.p(structuredClone(raw));
 for(const preference of ['fast','accessible','luggage','escalator_first','lift_first']){
  const request={origin:point(lift.from_id),destination:point(lift.to_id),preference,mode:'walk',departureS:39600,departureDate:'2026-10-12'};
  assert.equal(old.d(a,request).status,'NO_ROUTE');const actual=fixed.d(b,request);assert.equal(actual.status,'CONDITIONAL',actual.message);
  assert.deepEqual(actual.snapped_origin.coordinates,request.origin.coordinates);assert.deepEqual(actual.snapped_destination.coordinates,request.destination.coordinates);
  assert(actual.legs.filter(l=>l.kind!=='wait').every(l=>l.edge_ids.every(id=>raw.edges.some(e=>e.id===id))));
  const changed={...request,origin:{...request.origin,lon:request.origin.lon+.01}};assert.equal(fixed.d(b,changed).status,'NO_ROUTE','identity never overrides coordinate validation');
  for(const lon of [undefined,NaN,Infinity,181])assert.equal(fixed.d(b,{...request,origin:{...request.origin,lon}}).status,'OUT_OF_REGION','exact identity never bypasses finite/range coordinate validation');
  assert.equal(fixed.d(b,{...request,origin:{...request.origin,coordinates:[...request.origin.coordinates.slice(0,2),999]}}).status,'OUT_OF_REGION','source node cannot silently override contradictory requested height');
 }
 const xy={lon:raw.regions[0].center[0],lat:raw.regions[0].center[1]};assert.equal(old.h(a,xy).id,fixed.h(b,xy).id,'unidentified map-point geographic policy unchanged');
});
test.after(()=>rmSync(dir,{recursive:true,force:true}));

test('main coverage checks the union of loaded source graphs without removing endpoint identity',()=>{
 const source=readFileSync(new URL('../../src/navigation/main.recovered.js',import.meta.url),'utf8'),start=source.indexOf('function publicPointRegion('),end=source.indexOf('function publicCoverageMessage(',start);
 assert(start>=0&&end>start);const point={node_id:'HUH:real',coordinates:[114.18,22.3,13.8]},before=structuredClone(point);
 const area={nodes:[],regions:[{id:'AUS'}]},station={nodes:[{id:'HUH:real',region_id:'HUH',coordinates:[114.18,22.3,13.8]}],regions:[{id:'HUH'}]};
 const fn=new Function('t2','Q','L1','z',source.slice(start,end)+'return publicPointRegion;')((g,p)=>exactSourceRegion(g,p)?.region,area,station,null);
 assert.equal(fn(point).id,'HUH');assert.equal(fn({node_id:'unknown'}),undefined);assert.deepEqual(point,before);
 assert.match(source,/find\(point=>!publicPointRegion\(point\)\)/);
});
