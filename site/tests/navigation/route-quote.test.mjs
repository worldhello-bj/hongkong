import test from 'node:test';import assert from 'node:assert/strict';import {quoteRouteSafely} from '../../src/navigation/route-quote.js';
test('over100 navigation walking segments compact only pricing input',()=>{
 const segments=Array.from({length:150},(_,i)=>({mode:'walk',label:'道路'+i,durationMinutes:1,distanceM:60,available:true}));segments.splice(75,0,{mode:'metro',label:'地铁',durationMinutes:10,available:true});const snapshot=structuredClone(segments);let pricing;
 const quote=quoteRouteSafely({segments,title:'路线',origin:'起点',destination:'终点',complete:true,createQuote:request=>{pricing=request;assert.ok(request.segments.length<=100);return{available:true,segments:request.segments,totalCents:1200}}});
 assert.deepEqual(segments,snapshot);assert.deepEqual(pricing.segments.map(s=>s.mode),['walk','metro','walk']);assert.equal(pricing.segments[0].durationMinutes,75);assert.equal(quote.compacted,true);
});
test('pricing failure does not mutate or invalidate the journey',()=>{
 const result={journey:{complete:true,steps:[{kind:'walk'}]}};const quote=quoteRouteSafely({segments:[{mode:'walk',label:'步行',available:true}],complete:result.journey.complete,createQuote:()=>{throw Error('outage')}});assert.equal(result.journey.complete,true);assert.equal(quote.available,false);assert.equal(quote.pricingUnavailable,true);assert.equal(quote.error,'outage');
});
