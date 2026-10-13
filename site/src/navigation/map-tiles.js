/** Display-only Lands Department XYZ tiles. Never supplies routing edges or facilities. */
export const MAP_SOURCE = Object.freeze({
  base:'https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/basemap/WGS84',
  labels:'https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/label/hk/sc/WGS84',
  attribution:'地图资料：香港地政总署 / CSDI Portal',
  terms:'https://portal.csdi.gov.hk/csdi-webpage/doc/TNC',
  docs:'https://portal.csdi.gov.hk/csdi-webpage/apidoc/TopographicMapAPI',
});
export const TILE_BYTES = 256*256*4;
const NS='http://www.w3.org/2000/svg';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const localToLonLat=([x,y])=>[114.165+x/102900,22.279-y/111320];
export const lonLatToLocal=([lon,lat])=>[(lon-114.165)*102900,-(lat-22.279)*111320];
export function lonLatToTile(lon,lat,z){
  return[(lon+180)/360*2**z,(1-Math.asinh(Math.tan(clamp(lat,-85,85)*Math.PI/180))/Math.PI)/2*2**z];
}
export function tileBounds(x,y,z){
  const lon=n=>n/2**z*360-180,lat=n=>Math.atan(Math.sinh(Math.PI*(1-2*n/2**z)))*180/Math.PI;
  const nw=lonLatToLocal([lon(x),lat(y)]),se=lonLatToLocal([lon(x+1),lat(y+1)]);
  return{x:nw[0],y:nw[1],w:se[0]-nw[0],h:se[1]-nw[1]};
}
export function tileUrl(tile){return `${tile.layer==='label'?MAP_SOURCE.labels:MAP_SOURCE.base}/${tile.z}/${tile.x}/${tile.y}.png`;}
export function intersects(a,b){return a.x+a.w>b.x&&a.x<b.x+b.w&&a.y+a.h>b.y&&a.y<b.y+b.h;}
function cellsAt(view,z,pad=0){
  const nw=localToLonLat([view.x,view.y]),se=localToLonLat([view.x+view.w,view.y+view.h]);
  const a=lonLatToTile(...nw,z),b=lonLatToTile(...se,z),cx=(a[0]+b[0])/2,cy=(a[1]+b[1])/2,n=2**z;
  // The display is Hong Kong-only. Bounds avoid unbounded requests after a very long pan.
  const hkNW=lonLatToTile(113.75,22.65,z),hkSE=lonLatToTile(114.55,22.1,z),out=[];
  for(let y=Math.max(0,Math.floor(a[1])-pad,Math.floor(hkNW[1]));y<=Math.min(n-1,Math.floor(b[1])+pad,Math.floor(hkSE[1]));y++)
    for(let x=Math.max(0,Math.floor(a[0])-pad,Math.floor(hkNW[0]));x<=Math.min(n-1,Math.floor(b[0])+pad,Math.floor(hkSE[0]));x++){
      const bounds=tileBounds(x,y,z);out.push({x,y,z,bounds,visible:intersects(bounds,view),distance:(x+.5-cx)**2+(y+.5-cy)**2});
    }
  return out.sort((a,b)=>Number(b.visible)-Number(a.visible)||a.distance-b.distance||a.y-b.y||a.x-b.x);
}
export function selectTiles(view,width,{maxVisibleCells=40,maxCells=48}={}){
  if(![view?.x,view?.y,view?.w,view?.h,width].every(Number.isFinite)||view.w<=0||view.h<=0||width<=0)return{z:0,tiles:[],visibleCells:0};
  let z=clamp(Math.round(Math.log2(360*102900/(256*view.w/width))),10,20);
  while(z>10&&cellsAt(view,z).length>maxVisibleCells)z--;
  const cells=cellsAt(view,z,1).slice(0,maxCells),tiles=[];
  for(const layer of ['base','label'])for(const cell of cells)tiles.push({...cell,layer,key:`${layer}/${z}/${cell.x}/${cell.y}`,priority:(cell.visible?0:1000)+(layer==='label'?100:0)+cell.distance});
  tiles.sort((a,b)=>a.priority-b.priority);
  return{z,tiles,visibleCells:cells.filter(t=>t.visible).length};
}

/** Injectable bounded request/cache engine; no DOM, network, or timers in route code. */
export function createTileStore({load,release=()=>{},onChange=()=>{},maxEntries=96,concurrency=4,spacingMs=85,now=()=>Date.now(),schedule=(fn,ms)=>setTimeout(fn,ms),unschedule=clearTimeout}={}){
  if(typeof load!=='function')throw new Error('tile load function required');
  const cache=new Map(),active=new Map(),failures=new Map();let wanted=new Map(),queue=[],timer=null,disposed=false,lastStart=-Infinity;
  const counts={started:0,loaded:0,failed:0,aborted:0,evicted:0,cacheHits:0,bytesReceived:0,staleReleased:0};
  const notify=()=>{if(!disposed)onChange();};
  function evict(){
    while(cache.size>maxEntries){
      const candidates=[...cache].filter(([key])=>!wanted.get(key)?.visible);
      const entry=(candidates.length?candidates:[...cache]).sort((a,b)=>a[1].used-b[1].used)[0];
      cache.delete(entry[0]);release(entry[1].resource);counts.evicted++;
    }
  }
  function pump(){
    if(timer!==null)unschedule(timer);timer=null;if(disposed||active.size>=concurrency||!queue.length)return;
    const delay=spacingMs-(now()-lastStart);if(delay>0){timer=schedule(pump,delay);return;}
    const tile=queue.shift();if(!wanted.has(tile.key)||cache.has(tile.key)||active.has(tile.key)){pump();return;}
    const controller=new AbortController();active.set(tile.key,{controller});lastStart=now();counts.started++;
    Promise.resolve().then(()=>load(tile,controller.signal)).then(resource=>{
      if(disposed||controller.signal.aborted||!wanted.has(tile.key)){release(resource);counts.staleReleased++;return;}
      cache.set(tile.key,{tile,resource,used:now()});counts.loaded++;counts.bytesReceived+=resource.bytes??0;failures.delete(tile.key);evict();
    }).catch(error=>{if(!controller.signal.aborted&&!disposed){counts.failed++;failures.set(tile.key,now()+30000);if(failures.size>maxEntries*2)failures.delete(failures.keys().next().value);}}).finally(()=>{active.delete(tile.key);if(!disposed&&controller.signal.aborted&&wanted.has(tile.key)&&!cache.has(tile.key)&&!queue.some(t=>t.key===tile.key))queue.push(wanted.get(tile.key));notify();pump();});
    notify();if(queue.length&&active.size<concurrency)timer=schedule(pump,spacingMs);
  }
  function setWanted(tiles,{deferMs=120}={}){
    if(disposed)return;
    wanted=new Map(tiles.slice(0,maxEntries).map(t=>[t.key,t]));
    for(const [key,request]of active)if(!wanted.has(key)&&!request.controller.signal.aborted){request.controller.abort();counts.aborted++;}
    queue=[];
    for(const tile of wanted.values())if(cache.has(tile.key)){cache.get(tile.key).used=now();counts.cacheHits++;}
    else if(!active.has(tile.key)&&!(failures.get(tile.key)>now()))queue.push(tile);
    if(timer!==null)unschedule(timer);timer=null;
    evict();if(queue.length)timer=schedule(pump,deferMs);notify();
  }
  return{setWanted,
    entries:()=>[...cache.values()],
    retry(){failures.clear();setWanted([...wanted.values()],{deferMs:0});},
    stats:()=>({...counts,cached:cache.size,active:active.size,queued:queue.length,decodedBytesEstimate:cache.size*TILE_BYTES,compressedBytes:[...cache.values()].reduce((n,e)=>n+(e.resource.bytes??0),0)}),
    dispose(){if(disposed)return;disposed=true;if(timer!==null)unschedule(timer);for(const request of active.values())request.controller.abort();for(const entry of cache.values())release(entry.resource);cache.clear();wanted.clear();queue=[];failures.clear();},
  };
}

async function loadBrowserTile(tile,signal){
  const abort=new AbortController(),cancel=()=>abort.abort();signal.addEventListener('abort',cancel,{once:true});
  const timeout=setTimeout(cancel,12000);let url;
  try{
    const response=await fetch(tileUrl(tile),{signal:abort.signal,credentials:'omit',referrerPolicy:'no-referrer',cache:'default'});
    if(!response.ok||response.status===204)throw new Error(`Map tile HTTP ${response.status}`);
    const blob=await response.blob();if(!blob.type.startsWith('image/')||blob.size>2*1024*1024)throw new Error('Unexpected map tile');
    // A revoked object URL also releases the browser's reference to this transient payload.
    url=URL.createObjectURL(blob);
    const img=new Image();img.decoding='async';img.src=url;
    await new Promise((resolve,reject)=>{const stop=()=>{img.src='';finish(new DOMException('Cancelled','AbortError'));};const finish=error=>{abort.signal.removeEventListener('abort',stop);img.onload=null;img.onerror=null;error?reject(error):resolve();};img.onload=()=>finish();img.onerror=()=>finish(new Error('Map image decode failed'));abort.signal.addEventListener('abort',stop,{once:true});if(abort.signal.aborted)stop();else if(img.complete&&img.naturalWidth)finish();});
    if(signal.aborted||abort.signal.aborted)throw new DOMException('Cancelled','AbortError');
    if(img.naturalWidth!==256||img.naturalHeight!==256)throw new Error('Unexpected tile dimensions');
    return{url,bytes:blob.size};
  }catch(error){if(url)URL.revokeObjectURL(url);throw error;}
  finally{clearTimeout(timeout);signal.removeEventListener('abort',cancel);}
}

export function createMapTileLayer({layer,status,details,map,onCoverage=()=>{}}){
  let view=null,plan={tiles:[],visibleCells:0,z:0},key='',enabled=true,disposed=false,renderFrame=0,lastCoverage=false,frameProbe=0,probeUntil=0,lastFrame=0;
  const nodes=new Map(),frames=[];let cpuMs=0;
  function diagnostics(){
    const s=store.stats(),sorted=[...frames].sort((a,b)=>a-b),p95=sorted[Math.ceil(sorted.length*.95)-1];
    Object.assign(layer.dataset,{cached:String(s.cached),active:String(s.active),queued:String(s.queued),evicted:String(s.evicted),aborted:String(s.aborted),bytes:String(s.bytesReceived),decodedBytesEstimate:String(s.decodedBytesEstimate),zoom:String(plan.z),frameSamples:String(frames.length),frameP95Ms:p95?.toFixed(1)??'',renderCpuMs:cpuMs.toFixed(2)});
    if(details)details.textContent=`按视野 LOD ${plan.z} · 缓存 ${s.cached}/${window.innerWidth<=760?96:144} 张 · 解码预算估算 ${(s.decodedBytesEstimate/1048576).toFixed(1)} MiB · 本次传输 ${(s.bytesReceived/1048576).toFixed(2)} MiB · 进行中 ${s.active} · 已取消 ${s.aborted} · 已淘汰 ${s.evicted}${p95?` · ${frames.length} 个前台帧间隔 P95 ${p95.toFixed(1)} ms`:''}。解码数不含浏览器/GPU开销，帧间隔不是纯 GPU 时间；底图不扩展导航或室内覆盖。`;
  }
  function requestRender(){if(!disposed&&!renderFrame)renderFrame=requestAnimationFrame(render);}
  const store=createTileStore({load:loadBrowserTile,release:r=>URL.revokeObjectURL(r.url),maxEntries:window.innerWidth<=760?96:144,onChange:requestRender});
  function render(){
    renderFrame=0;if(disposed||!view)return;const start=performance.now();
    const entries=store.entries().filter(e=>intersects(e.tile.bounds,view)),desired=new Set(plan.tiles.map(t=>t.key));
    // Existing coarser tiles remain underneath during zoom and after individual failures.
    const visible=entries.filter(e=>desired.has(e.tile.key)||(e.tile.layer==='base'&&e.tile.z<plan.z)).sort((a,b)=>(a.tile.layer==='label')-(b.tile.layer==='label')||a.tile.z-b.tile.z);
    const keep=new Set(visible.map(e=>e.tile.key));for(const[k,node]of nodes)if(!keep.has(k)){node.remove();nodes.delete(k);}
    for(let index=0;index<visible.length;index++){const entry=visible[index],t=entry.tile;let node=nodes.get(t.key);if(!node){node=document.createElementNS(NS,'image');node.setAttribute('href',entry.resource.url);node.setAttribute('preserveAspectRatio','none');node.dataset.tile=t.key;node.setAttribute('x',t.bounds.x);node.setAttribute('y',t.bounds.y);node.setAttribute('width',t.bounds.w+.01);node.setAttribute('height',t.bounds.h+.01);node.setAttribute('pointer-events','none');nodes.set(t.key,node);}if(layer.children[index]!==node)layer.insertBefore(node,layer.children[index]??null);}
    const loaded=new Set(entries.map(e=>e.tile.key)),base=plan.tiles.filter(t=>t.visible&&t.layer==='base'),complete=base.length>0&&base.every(t=>loaded.has(t.key));
    if(complete!==lastCoverage){lastCoverage=complete;onCoverage(complete);}
    const n=base.filter(t=>loaded.has(t.key)).length,s=store.stats();
    if(status)status.textContent=!base.length?'超出香港底图范围':complete?'街道建筑 · 按视野加载':s.active||s.queued?`底图 ${n}/${base.length} · 载入中`:'在线底图暂未完成 · 保留本地背景';
    cpuMs=performance.now()-start;diagnostics();
  }
  function probe(t){frameProbe=0;if(disposed||!enabled||document.hidden)return;if(lastFrame&&t-lastFrame<1000){frames.push(t-lastFrame);if(frames.length>180)frames.shift();}lastFrame=t;if(t<probeUntil)frameProbe=requestAnimationFrame(probe);else{lastFrame=0;diagnostics();}}
  return{
    update(nextView,width){if(disposed)return;view={...nextView};if(!enabled)return;plan=selectTiles(view,width);const nextKey=plan.tiles.map(t=>t.key).join('|');if(nextKey!==key){key=nextKey;store.setWanted(plan.tiles);}requestRender();},
    interaction(){probeUntil=performance.now()+1000;if(!frameProbe&&!document.hidden)frameProbe=requestAnimationFrame(probe);},
    setActive(value){if(disposed||value===enabled)return;enabled=value;if(!enabled){store.setWanted([],{deferMs:0});key='';if(frameProbe)cancelAnimationFrame(frameProbe);frameProbe=0;lastFrame=0;}else if(view)this.update(view,map.clientWidth||900);},
    retry:()=>store.retry(),
    dispose(){disposed=true;store.dispose();if(renderFrame)cancelAnimationFrame(renderFrame);if(frameProbe)cancelAnimationFrame(frameProbe);layer.replaceChildren();nodes.clear();},
  };
}
