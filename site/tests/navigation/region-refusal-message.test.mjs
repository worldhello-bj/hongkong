import test from 'node:test';import assert from 'node:assert/strict';
import {oldMessage,refusalMessage,repairRegionRefusalText} from '../../scripts/repair-region-refusal-message.mjs';
test('different source regions are not mislabeled as opposite harbour shores',()=>{
 const source=`if(request.mode==="walk"&&a.id!==b.id)return noRoute("${oldMessage}");`;
 const fixed=repairRegionRefusalText(source);
 assert.equal(fixed,`if(request.mode==="walk"&&a.id!==b.id)return noRoute("${refusalMessage}");`);
 assert.equal(repairRegionRefusalText(fixed),fixed);
 assert.match(refusalMessage,/已载入路网/);assert.match(refusalMessage,/不代表现实中必须跨海/);
});
