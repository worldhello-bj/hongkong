import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {focusTicketPage} from '../../src/navigation/ticket-page.js';
const source=readFileSync(new URL('../../src/navigation/main.recovered.js',import.meta.url),'utf8');
const helpers=source.slice(source.indexOf('let ticketLastPointerAt='),source.indexOf('function ticketContextNow(){'));
const transition=source.slice(source.indexOf('function H(e,L=!1){'),source.indexOf('function N('));
function context(){
 let time=0,focused=0,renders=0;const sheet={top:628,scrollTo({top}){this.top=top}},model={top:485,scrollTo({top}){this.top=top}};
 const c=vm.createContext({performance:{now:()=>time},P:{querySelector:()=>sheet,classList:{remove(){}}},A:()=>model,
  r:{stage:'routes'},a1:0,l1:false,ticketPage:{suspend(){}},syncTraffic(){},trafficClock:{play(){}},u1(){},
  normalizeAppStage:e=>e,availableUiState:()=>({}),writeAppHistory(){},x(){renders++},
  requestAnimationFrame:fn=>fn(),focusTicketPage:()=>{focused++;sheet.scrollTo({top:0})}});
 vm.runInContext(helpers+transition,c);
 return {c,sheet,model,setTime:t=>time=t,run:s=>vm.runInContext(s,c),get focused(){return focused},get renders(){return renders}};
}
test('ticket focus resets the actual sheet ancestor and keeps heading focus from scrolling again',()=>{
 const calls=[],sheet={scrollTo:x=>calls.push(['sheet',x])};
 const host={closest:selector=>{assert.equal(selector,'.na-sheet');return sheet},querySelector:()=>({focus:x=>calls.push(['focus',x])}),scrollTo:()=>assert.fail('panel is not the scroll container')};
 focusTicketPage(host);assert.deepEqual(calls,[['focus',{preventScroll:true}],['sheet',{top:0,behavior:'instant'}]]);
});
test('standalone ticket fixture still resets its own host when no sheet exists',()=>{
 const calls=[];focusTicketPage({querySelector:()=>null,closest:()=>null,scrollTo:x=>calls.push(x)});assert.deepEqual(calls,[{top:0,behavior:'instant'}]);
});
test('pointer click-through is rejected after a phase replacement, later edits and keyboard stay usable',()=>{
 const h=context();assert.equal(h.run('ticketUiActivationAllowed({detail:1})'),true);
 h.setTime(120);assert.equal(h.run('ticketUiActivationAllowed({detail:1})'),false,'newly mounted edit button cannot absorb the same rapid gesture');
 assert.equal(h.run('ticketUiActivationAllowed({detail:2})'),false);
 assert.equal(h.run('ticketUiActivationAllowed({detail:0})'),true,'keyboard remains immediate');
 h.setTime(400);assert.equal(h.run('ticketUiActivationAllowed({detail:1})'),true,'deliberate later edit is allowed');
 h.setTime(450);assert.equal(h.run('ticketUiActivationAllowed({detail:0})'),true);
});
test('genuine ticket entry resets scroll, same-stage and background rerenders preserve reading position',()=>{
 const h=context();h.run('H("tickets")');assert.equal(h.sheet.top,0);assert.equal(h.focused,1);
 h.sheet.top=220;h.run('H("tickets");x()');assert.equal(h.sheet.top,220);assert.equal(h.focused,1);
 h.run('H("routes");H("tickets")');assert.equal(h.sheet.top,0);assert.equal(h.focused,2);
});
test('entering a model resets both independent scroll containers without resetting same-stage updates',()=>{
 const h=context();h.run('H("station")');assert.equal(h.sheet.top,0);assert.equal(h.model.top,0);
 h.sheet.top=150;h.model.top=480;h.run('H("station");x()');assert.equal(h.sheet.top,150);assert.equal(h.model.top,480);
});
test('actual handlers guard ticket actions and reset model scroll on a station identity change',()=>{
 assert.match(source,/if\(t\.dataset\.ticketAction\)\{if\(!ticketUiActivationAllowed\(e\)\)return/);
 assert.match(source,/if\(a===\"tickets\"\)\{if\(!ticketUiActivationAllowed\(e\)\)return/);
 assert.match(source,/if\(t\.dataset\.station\)\{const changed=[^}]+if\(changed\)resetSecondaryScroll\(\)/);
 const restore=source.slice(source.indexOf('function restoreAppLocation'),source.indexOf('Y(window,"popstate"'));
 assert.match(restore,/r\.stage!==previousStage&&\["station","mall"\]\.includes\(r\.stage\)\)resetSecondaryScroll/);
 assert.match(restore,/r\.stage==="tickets"&&previousStage!=="tickets"\)requestAnimationFrame/);
});
