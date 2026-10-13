import test from 'node:test';import assert from 'node:assert/strict';
import {FLEET_DEMO_BOUNDS,boundsCorners,insideBounds,createRoadContext,visibleFleet} from '../../src/navigation/taxi-map.js';
const project=([x,y])=>[(x-114.165)*102900,-(y-22.279)*111320];
test('fleet display region fits entirely within restored geographic background',()=>{
 const background=[114.13,22.255,114.215,22.3346603];
 for(const corner of boundsCorners(FLEET_DEMO_BOUNDS))assert.equal(insideBounds(corner,background),true);
 assert.ok(FLEET_DEMO_BOUNDS[1]<22.294&&FLEET_DEMO_BOUNDS[3]>22.294);
});
test('viewport culling uses the map projection and leaves vehicle positions unchanged',()=>{
 const cars=[{id:'a',position:[114.165,22.279]},{id:'b',position:[114.25,22.35]}],before=structuredClone(cars);
 const visible=visibleFleet(cars,project,{x:-100,y:-100,w:200,h:200,width:600});assert.deepEqual(visible.map(c=>c.id),['a']);assert.deepEqual(cars,before);
});
test('extended road context renders original polylines, distinguishes tunnels and caches stable views',()=>{
 const graph={nodes:{a:[114.165,22.279],b:[114.166,22.28],c:[114.167,22.281]},ways:{one:{},two:{tunnel:'yes'}},edges:[{way:'one',from:'a',to:'b',geometry:[[114.165,22.279],[114.1655,22.2798],[114.166,22.28]]},{way:'two',from:'b',to:'c',geometry:[[114.166,22.28],[114.1663,22.2808],[114.167,22.281]]}]};
 const context=createRoadContext(graph,project),view={x:-400,y:-400,w:800,h:800,width:600},a=context(view),b=context(view);
 assert.equal(a,b);assert.equal(a.count,2);assert.ok(a.roads.includes('L51.4,-89.1'));assert.ok(a.tunnels.length>0);
 assert.equal(context({x:10000,y:10000,w:100,h:100,width:600}).count,0);
});
