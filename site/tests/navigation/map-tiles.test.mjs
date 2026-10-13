import test from 'node:test';
import assert from 'node:assert/strict';
import{readFile}from'node:fs/promises';
import{MAP_SOURCE,lonLatToLocal,localToLonLat,lonLatToTile,tileBounds,selectTiles,tileUrl,createTileStore,TILE_BYTES}from'../../src/navigation/map-tiles.js';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const tile=(key,visible=true)=>({key,visible,layer:'base',x:107102,y:57211,z:17});
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await sleep(2);}assert.ok(fn(),'bounded test condition');}

test('official standard XYZ sample is correctly registered at Admiralty',()=>{
 const xy=lonLatToTile(114.165,22.279,17);assert.deepEqual(xy.map(Math.floor),[107102,57211]);
 const b=tileBounds(107102,57211,17);assert.ok(b.x<=0&&b.x+b.w>0&&b.y<=0&&b.y+b.h>0);
 const east=tileBounds(107103,57211,17),south=tileBounds(107102,57212,17);
 assert.ok(Math.abs(b.x+b.w-east.x)<1e-8);assert.ok(Math.abs(b.y+b.h-south.y)<1e-8);
 assert.equal(tileUrl(tile('a')),MAP_SOURCE.base+'/17/107102/57211.png');
 assert.equal(tileUrl({...tile('a'),layer:'label'}),MAP_SOURCE.labels+'/17/107102/57211.png');
});
test('projection round trips actual locations on both shores',()=>{
 for(const p of [[114.165,22.279],[114.1823,22.3041],[114.166,22.306],[114.2,22.32]]){
  const q=localToLonLat(lonLatToLocal(p));assert.ok(Math.hypot(q[0]-p[0],q[1]-p[1])<1e-10);
 }
});
test('LOD gives continuous visible base and label coverage with bounded margins',()=>{
 for(const w of [120,450,1500,6500,35000])for(const px of [390,900,1920])for(const x of [-1700,1800]){
  const view={x,y:-3500,w,h:w*900/px},p=selectTiles(view,px);
  assert.ok(p.z>=10&&p.z<=20);assert.ok(p.tiles.length<=96);assert.ok(p.visibleCells<=40);
  assert.equal(new Set(p.tiles.map(t=>t.key)).size,p.tiles.length);
  const base=p.tiles.filter(t=>t.visible&&t.layer==='base'),labels=p.tiles.filter(t=>t.visible&&t.layer==='label');assert.equal(base.length,labels.length);
  for(const t of base)assert.ok(labels.some(l=>l.x===t.x&&l.y===t.y));
 }
});
test('higher zoom near buildings and invalid/out-of-region inputs stay safe',()=>{
 assert.ok(selectTiles({x:1000,y:-3000,w:450,h:400},900).z>selectTiles({x:1000,y:-3000,w:6500,h:4000},900).z);
 assert.equal(selectTiles({x:NaN,y:0,w:500,h:500},900).tiles.length,0);
 assert.equal(selectTiles({x:1e9,y:1e9,w:500,h:500},900).tiles.length,0);
});
test('cache reuses identical tile without new load; all transient payloads released',async()=>{
 let loads=0,released=0;const s=createTileStore({spacingMs:0,load:async()=>({url:String(++loads),bytes:100}),release:()=>released++});
 s.setWanted([tile('a')],{deferMs:0});await until(()=>s.stats().loaded===1);s.setWanted([tile('a')],{deferMs:0});await sleep(5);
 assert.equal(loads,1);assert.equal(s.stats().decodedBytesEstimate,TILE_BYTES);assert.equal(s.stats().compressedBytes,100);s.dispose();assert.equal(released,1);assert.equal(s.stats().cached,0);
});
test('LRU remains bounded across 40 pans and evicts nonvisible data',async()=>{
 let released=0;const s=createTileStore({maxEntries:4,spacingMs:0,load:async()=>({bytes:2}),release:()=>released++});
 for(let i=0;i<40;i++){s.setWanted([tile(String(i))],{deferMs:0});await until(()=>s.stats().loaded===i+1);assert.ok(s.stats().cached<=4);}
 assert.equal(s.stats().evicted,36);assert.equal(released,36);s.dispose();assert.equal(released,40);
});
test('concurrency cap and spacing survive repeated view replacement',async()=>{
 let running=0,peak=0;const starts=[];const s=createTileStore({concurrency:2,spacingMs:5,load:async()=>{running++;peak=Math.max(peak,running);starts.push(Date.now());await sleep(12);running--;return{};}});
 s.setWanted(Array.from({length:8},(_,i)=>tile(String(i))),{deferMs:0});await until(()=>s.stats().loaded===8);
 assert.ok(peak<=2);for(let i=1;i<starts.length;i++)assert.ok(starts[i]-starts[i-1]>=4);s.dispose();
});
test('obsolete response is released even if transport ignores cancellation',async()=>{
 const completions=new Map,signals=new Map;let releases=0;
 const s=createTileStore({spacingMs:0,load:(t,signal)=>new Promise(resolve=>{completions.set(t.key,resolve);signals.set(t.key,signal);}),release:()=>releases++});
 s.setWanted([tile('old')],{deferMs:0});await until(()=>completions.has('old'));s.setWanted([tile('new')],{deferMs:0});await until(()=>completions.has('new'));
 assert.ok(signals.get('old').aborted);completions.get('old')({});completions.get('new')({});await until(()=>s.stats().loaded===1);
 assert.deepEqual(s.entries().map(e=>e.tile.key),['new']);assert.equal(releases,1);assert.equal(s.stats().staleReleased,1);s.dispose();
});
test('fast A-B-A pan recovers an aborted in-flight tile without a ghost hole',async()=>{
 let count=0;const pending=[];const s=createTileStore({spacingMs:0,load:(t,signal)=>new Promise((resolve,reject)=>{count++;pending.push({resolve,reject,signal});signal.addEventListener('abort',()=>setTimeout(()=>reject(new Error('aborted')),4));})});
 s.setWanted([tile('A')],{deferMs:0});await until(()=>count===1);s.setWanted([tile('B')]);s.setWanted([tile('A')],{deferMs:0});await until(()=>count===2);pending[1].resolve({});await until(()=>s.stats().loaded===1);assert.equal(s.entries()[0].tile.key,'A');s.dispose();
});
test('failures do not spin and explicit retry is available',async()=>{
 let n=0;const s=createTileStore({spacingMs:0,load:async()=>{if(++n===1)throw new Error('offline');return{};}});
 s.setWanted([tile('a')],{deferMs:0});await until(()=>s.stats().failed===1);s.setWanted([tile('a')],{deferMs:0});await sleep(5);assert.equal(n,1);
 s.retry();await until(()=>s.stats().loaded===1);s.dispose();
});
test('suspending/disposal cancels pending and late responses never recreate cache',async()=>{
 let resolve;const s=createTileStore({spacingMs:0,load:()=>new Promise(r=>resolve=r)});s.setWanted([tile('a')],{deferMs:0});await until(()=>resolve);s.setWanted([]);s.dispose();resolve({});await sleep(5);assert.equal(s.stats().cached,0);s.setWanted([tile('b')]);await sleep(5);assert.equal(s.stats().started,1);
});
test('display modules are isolated from routes and source geometry is lazy',async()=>{
 const main=await readFile(new URL('../../src/navigation/main.recovered.js',import.meta.url),'utf8');
 const mobile=await readFile(new URL('../../dist/assets/mobile-navigation-DfEsS_7b.js',import.meta.url),'utf8');
 const features=JSON.parse(await readFile(new URL('../../dist/map-detail/admiralty.json',import.meta.url),'utf8'));
 assert.equal(features.length,5127);assert.ok(mobile.includes('function loadDetailedMap'));assert.ok(!mobile.includes('R2=JSON.parse(`'));
 assert.ok(main.includes('createMapTileLayer'));assert.ok(!main.includes('const m=!!z&&f.w<2500'));
 for(const name of ['app-walk-worker-jk5g-BMr.js','app-transit-worker-CaCMeUxU.js','metro-worker-BDEusPKL.js']){
  const text=await readFile(new URL('../../dist/assets/'+name,import.meta.url),'utf8');assert.ok(!text.includes('map-tiles'));assert.ok(!text.includes('map-detail'));
 }
});
