import test from 'node:test';import assert from'node:assert/strict';import{readFile}from'node:fs/promises';
globalThis.document??={createElement:()=>({relList:{supports:()=>true}})};
const module=await import('../../dist/assets/mobile-navigation-DfEsS_7b.js');
const data=JSON.parse(await readFile(new URL('../../dist/map-detail/admiralty.json',import.meta.url),'utf8'));
test('lazy map loader coalesces requests, builds existing geometry and does not fetch on module import',async()=>{
 let calls=0;const previous=globalThis.fetch;let release;
 globalThis.fetch=()=>{calls++;return new Promise(resolve=>release=()=>resolve({ok:true,json:async()=>data}));};
 try{
  assert.equal(calls,0);const a=module.loadDetailedMap(),b=module.loadDetailedMap();assert.equal(calls,1);assert.equal(a,b);release();await a;
  const svg=module.k({layer:'all',scale:.75,labels:true,viewport:{x:-234.96,y:-430,w:560,h:620}});
  const{createHash}=await import('node:crypto');
  // Hash from v41 benchmark's same final viewport, renderer and official source geometry.
  assert.equal(createHash('sha256').update(svg).digest('hex'),'a86e62195c15b8845ea6cf936b76e78c39701a89946d968d2e2749787810e7a7');
  await module.loadDetailedMap();assert.equal(calls,1);
 }finally{globalThis.fetch=previous;}
});
