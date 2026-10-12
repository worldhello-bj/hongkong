import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
import{compactLowerBounds,retainLowerBounds}from'../../src/navigation/compact-lower-bounds.js';
import{patchLowerBoundCache,restoreLowerBoundCache,lowerBoundAssets}from'../../scripts/repair-lower-bound-cache.mjs';
test('compact bounds preserve every numeric value, absent entries and synthetic nodes',()=>{
 const nodes=new Map(Array.from({length:10},(_,i)=>['n'+i,i])),bounds=new Map([['n0',0],['n1',-0],['n2',NaN],['n3',Infinity],['n4',-Infinity],['n5',1/3],['n9',Number.MAX_VALUE],['@origin',12],['@destination',-0]]),compact=compactLowerBounds(bounds,nodes);
 assert.equal(compact.size,bounds.size);assert.equal(compact.byteLength,82);
 for(const key of [...nodes.keys(),'@origin','@destination','missing'])assert.ok(Object.is(compact.get(key),bounds.get(key)),key);
 assert.throws(()=>compactLowerBounds(new Map([['n0',undefined]]),nodes),/numeric/);
});
test('same graph shares the node index, bounded FIFO retention keeps 64 precise maps',()=>{
 const graph={nodes:Array.from({length:100},(_,i)=>({id:'n'+i}))},index={remainingCache:new Map()};
 for(let i=0;i<65;i++)retainLowerBounds(index,graph,'key'+i,new Map([['n0',i]]));
 assert.equal(index.remainingCache.size,64);assert.equal(index.hkLowerBoundNodes.capacity,64);assert.equal(index.remainingCache.has('key0'),false);assert.equal(index.remainingCache.get('key1').get('n0'),1);
 const metadata=index.hkLowerBoundNodes;retainLowerBounds(index,graph,'key64',new Map([['n0',-0]]));assert.equal(index.hkLowerBoundNodes,metadata);assert.equal(index.remainingCache.size,64);assert.ok(Object.is(index.remainingCache.get('key64').get('n0'),-0));
 const other={remainingCache:new Map()};retainLowerBounds(other,graph,'x',new Map([['n0',1]]));assert.notEqual(other.hkLowerBoundNodes,metadata);
});
test('typed array retention adapts to budget while always allowing one result',()=>{
 const graph={nodes:Array.from({length:100},(_,i)=>({id:'n'+i}))},index={remainingCache:new Map()};
 for(let i=0;i<5;i++)retainLowerBounds(index,graph,'k'+i,new Map([['n0',i]]),{arrayBudgetBytes:1700,maxEntries:32});
 assert.equal(index.hkLowerBoundNodes.capacity,2);assert.equal(index.remainingCache.size,2);assert.ok([...index.remainingCache.values()].reduce((sum,x)=>sum+x.byteLength,0)<=1700);
 const large={remainingCache:new Map()};retainLowerBounds(large,graph,'k',new Map(),{arrayBudgetBytes:1});assert.equal(large.hkLowerBoundNodes.capacity,1);
});
test('all four lower-bound transforms are narrow, reversible and idempotent',()=>{
 for(const file of lowerBoundAssets){const source=restoreLowerBoundCache(readFileSync(new URL('../../dist/assets/'+file,import.meta.url),'utf8')),result=patchLowerBoundCache(source);assert.equal(result.changes,1);assert.equal(patchLowerBoundCache(result.source).changes,0);assert.equal(restoreLowerBoundCache(result.source),source);const stale=result.source.replace('arrayBudgetBytes=16*1024*1024,maxEntries=64','arrayBudgetBytes=8*1024*1024,maxEntries=32');const rebuilt=patchLowerBoundCache(stale);assert.equal(rebuilt.changes,1);assert.equal(rebuilt.source,result.source);const layered='/* OTHER_TRANSFORM */\n'+result.source;assert.equal(patchLowerBoundCache(layered).source,layered);assert.equal(restoreLowerBoundCache(layered),'/* OTHER_TRANSFORM */\n'+source)}
 assert.throws(()=>patchLowerBoundCache('unknown'),/exactly one/);
});
