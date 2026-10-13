import test from 'node:test';import assert from 'node:assert/strict';
import {pacificOpeningAdvice,pacificPlaceControls,pacificModelPanel} from '../../src/navigation/place-opening.js';
const graph={places:[{id:'pacific-place',access_schedule:{kind:'daily',windows:[{start_s:36000,end_s:79200}]}}]},point={id:'pacific-place',coordinates:[114.16,22.28]},request={origin:point,destination:{id:'park'}};
test('opening suggestion is explicit, source-bounded and preserves endpoints',()=>{
 const before=JSON.stringify(request);assert.deepEqual(pacificOpeningAdvice(request,'2026-10-12','08:00',graph),{date:'2026-10-12',time:'10:00',selectedTime:'08:00',label:'10:00–22:00'});
 assert.equal(pacificOpeningAdvice(request,'2026-10-12','10:00',graph),null);assert.equal(pacificOpeningAdvice(request,'2026-10-12','11:00',graph),null);
 assert.equal(pacificOpeningAdvice(request,'2026-10-12','22:00',graph).date,'2026-10-13');assert.equal(pacificOpeningAdvice(request,'2026-12-31','23:59',graph).date,'2027-01-01');
 assert.equal(pacificOpeningAdvice(request,'2026-10-12','99:00',graph),null);assert.equal(pacificOpeningAdvice(request,'2026-10-12','08:00',{}),null);assert.equal(pacificOpeningAdvice({origin:{id:'pacific-place-f-exterior'}},'2026-10-12','08:00',graph),null);
 assert.equal(JSON.stringify(request),before);const html=pacificPlaceControls(request,'2026-10-12','08:00',graph);assert.match(html,/不代表整楼|不是整座商场/);assert.match(html,/原起终点不会自动移动/);assert.match(html,/data-action="pacific-opening"/);assert.match(html,/data-mall-target="origin"/);assert.match(pacificModelPanel('origin'),/data-mall-target="origin" aria-pressed="true"/);
});
