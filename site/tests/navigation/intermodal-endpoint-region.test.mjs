import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{intermodalRegionAssets,patchIntermodalEndpointRegion,restoreIntermodalEndpointRegion}from'../../scripts/repair-intermodal-endpoint-region.mjs';import{exactSourceRegion}from'../../src/navigation/endpoint-region.js';
test('both real intermodal owners check existing station identity before rejecting public-area coverage',()=>{
 const area={nodes:[{id:'road',region_id:'AUS'}],regions:[{id:'AUS'}]},station={nodes:[{id:'huh-lift',region_id:'HUH'}],regions:[{id:'HUH'}]},request={origin:{node_id:'road'},destination:{node_id:'huh-lift'}},lookup=(g,p)=>exactSourceRegion(g,p)?.region;
 for(const file of intermodalRegionAssets){
  const source=restoreIntermodalEndpointRegion(readFileSync(new URL('../../dist/assets/'+file,import.meta.url),'utf8')),patched=patchIntermodalEndpointRegion(source);assert.equal(patched.changes,1);assert.equal(patchIntermodalEndpointRegion(patched.source).changes,0);assert.equal(restoreIntermodalEndpointRegion(patched.source),source);
  const match=patched.source.match(/if\((!\([^;]+?)\)return\{status:"OUT_OF_REGION"/);assert(match,'one patched exact owner coverage gate');
  const worker=file.startsWith('app-'),run=new Function(...(worker?['Ie','E','c','i']:['re','I','d','e']),'return '+match[1]);
  assert.equal(run(lookup,area,station,request),false,'valid station-only node reaches actual source router');
  assert.equal(run(lookup,area,station,{...request,destination:{node_id:'unknown'}}),true,'unknown IDs still rejected');
  assert.equal(run(lookup,area,undefined,request),true,'absent station is not invented');
 }
});
