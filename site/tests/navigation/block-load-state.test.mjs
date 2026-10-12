import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../src/navigation/main.recovered.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('async function loadBlockData(){'),source.indexOf('\n\nfunction J1'));
test('successful optional block load refreshes the visible map status, not only internal flags',async()=>{
 const label={textContent:'官方街道 + 交通站点 · 街区补充暂未加载'},detail={edges:[]};
 const ctx={K1:async()=>detail,y1:false,Q:{},I1:{},publicWalkLinks:{},L1:{},g2:()=>({}),E2:()=>({}),s2:()=>[{id:'pacific-place'}],routeResultCache:new Map([['old',1]]),taxiPublicCache:new Map([['old',1]]),l2:'old',v2:[],window:{__navigationLoad:{}},pendingDetailRefresh:false,r:{stage:'home'},A:()=>label,x(){},Z(){},Set};
 vm.createContext(ctx);vm.runInContext(code,ctx);await ctx.loadBlockData();
 assert.equal(ctx.blockDataState,'ready');assert.equal(ctx.window.__navigationLoad.block,'ready');assert.equal(label.textContent,'金钟街区分层路网 + 交通站点');assert.equal(ctx.V[0].id,'pacific-place');assert.equal(ctx.routeResultCache.size,0);assert.equal(ctx.taxiPublicCache.size,0);
});
