import test from'node:test';import assert from'node:assert/strict';import{readFileSync,writeFileSync,mkdtempSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';import{pathToFileURL}from'node:url';import vm from'node:vm';
import{alignTransitStopProjection}from'../../src/navigation/transit-stop-projection.js';
import{patchTransitStopProjection,restoreTransitStopProjection,transitProjectionAssets}from'../../scripts/repair-transit-stop-projection.mjs';
const data=JSON.parse(readFileSync(new URL('../../dist/transit/services.json',import.meta.url),'utf8')),pattern=data.patterns.find(p=>p.id==='td:1326:1:287'),from=data.stops.find(s=>s.id==='td:4025'),to=data.stops.find(s=>s.id==='td:9013');
const calls=pattern.stops,origin=calls.find(c=>c.stopId===from.id),destination=calls.find(c=>c.stopId===to.id),leg={kind:'bus',patternId:pattern.id,fromId:from.id,toId:to.id,geometry:pattern.shape.slice(origin.shapeIndex,destination.shapeIndex+1),departureS:40800,arrivalS:41492,durationS:692};
test('actual KMB8 source stops stay exact; both centreline projections remain explicitly unverified',()=>{
 const original=structuredClone({leg,pattern,from,to}),aligned=alignTransitStopProjection(leg,pattern,from,to);
 assert.deepEqual(aligned.coordinates[0],from.coordinates);assert.deepEqual(aligned.coordinates.at(-1),to.coordinates);assert.deepEqual(aligned.coordinates.slice(1,-1),leg.geometry);
 assert.equal(aligned.metadata.stop_projections.length,2);assert.equal(aligned.geometryMode,'schematic');assert.equal(aligned.metadata.source_geometry_mode,'official');assert.deepEqual(aligned.metadata.source_geometry.coordinates,leg.geometry);
 assert.ok(aligned.metadata.stop_projections.every(p=>p.verified===false&&p.geometry_mode==='schematic'));assert.match(aligned.warnings[0],/不是已核验/);assert.deepEqual({leg,pattern,from,to},original);assert.equal(leg.durationS,692);
});
test('matching shapes add no duplicate points or warnings; rail, unknown source identities and all vertical constraints are not bridged',()=>{
 const exact={...leg,geometry:[from.coordinates,to.coordinates]},aligned=alignTransitStopProjection(exact,pattern,from,to);assert.deepEqual(aligned.coordinates,exact.geometry);assert.deepEqual(aligned.metadata,{});assert.deepEqual(aligned.warnings,[]);
 const cases=[[{...leg,kind:'metro'},pattern,from,to],[leg,{...pattern,id:'other'},from,to],[leg,pattern,{...from,id:'other'},to],[leg,pattern,{...from,coordinates:[...from.coordinates,0]},to],[leg,pattern,from,{...to,floorId:'L1'}],[leg,pattern,{...from,node_id:'curb'},to],[{...leg,geometry:leg.geometry.map(p=>[...p,0])},pattern,from,to],[leg,pattern,{...from,coordinates:[NaN,22]},to],[{...leg,patternId:undefined},pattern,from,to]];
 for(const args of cases)assert.deepEqual(alignTransitStopProjection(...args).metadata,{});
 const tram={...leg,kind:'tram'},tramPattern={...pattern,mode:'tram'};assert.equal(alignTransitStopProjection(tram,tramPattern,from,to).metadata.stop_projections.length,2);
});
test('both ride assemblers patch narrowly, reversibly and idempotently',()=>{
 for(const file of transitProjectionAssets){const source=restoreTransitStopProjection(readFileSync(new URL('../../dist/assets/'+file,import.meta.url),'utf8')),patched=patchTransitStopProjection(source);assert.equal(patched.changes,1);assert.equal(patchTransitStopProjection(patched.source).changes,0);assert.equal(restoreTransitStopProjection(patched.source),source)}
 assert.throws(()=>patchTransitStopProjection('drift'),/anchor/);
});
const dir=mkdtempSync(join(tmpdir(),'hk-transit-projection-'));
globalThis.document??={createElement:()=>({relList:{supports:()=>true}})};
async function load(file,patched){
 const url=new URL('../../dist/assets/'+file,import.meta.url);let source=restoreTransitStopProjection(readFileSync(url,'utf8'));if(patched)source=patchTransitStopProjection(source).source;
 if(file.startsWith('app-')){
  const context={self:{},setTimeout,clearTimeout,DOMException,console};for(const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)";/g)){const module=await import(new URL(match[2],url).href);for(const binding of match[1].split(',')){const[name,alias]=binding.trim().split(/\s+as\s+/);context[alias??name]=module[name]}}
  source=source.replace(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)";/g,'').replace('let tt;self.onmessage','globalThis.engine={router:jt,prepare:Ae};let tt;self.onmessage');vm.createContext(context);vm.runInContext(source,context);return context.engine;
 }
 source=source.replace(/from\s*["'](\.\.?\/[^"']+)["']/g,(_,p)=>'from '+JSON.stringify(new URL(p,url).href));source+='\nexport{ft as router,Ae as prepare};';const path=join(dir,file+(patched?'-patched':'-original')+'.mjs');writeFileSync(path,source);return import(pathToFileURL(path).href);
}
const engines=await Promise.all(transitProjectionAssets.map(async file=>({file,original:await load(file,false),patched:await load(file,true)})));
test('actual worker and fallback preserve scheduled route, constraints and timing while all rendered boundaries agree',async()=>{
 for(const{file,original,patched}of engines){
  const nodes=Array.from({length:9},(_,i)=>i).map(i=>({id:'n'+i,region_id:'R',coordinates:[114.16+i*.001,22.28,0]})),edges=[];
  for(let i=0;i<8;i++)for(const[a,b]of[[i,i+1],[i+1,i]])edges.push({id:`e${a}-${b}`,physical_id:`e${a}-${b}`,region_id:'R',from_id:'n'+a,to_id:'n'+b,kind:i===3?'stairs':'walk',name:'walk',length_m:100,duration_s:20,coordinates:[nodes[a].coordinates,nodes[b].coordinates],source_id:'CSDI-INDOOR',geometry_mode:'official',snap_eligible:true,accessible_eligible:true,disabled:false});
  nodes.push({id:'isolated',region_id:'R',coordinates:[...nodes[0].coordinates]},{id:'__area_origin__',region_id:'R',coordinates:[...nodes[0].coordinates]},{id:'upper',region_id:'R',coordinates:[114.16,22.28,20]});
  const area={version:'projection-fixture',regions:[{id:'R',center:[114.164,22.28],radius_m:10000}],nodes,edges,portals:nodes.map((n,i)=>({id:'s'+i,node_id:n.id,region_id:'R',coordinates:n.coordinates,name:n.id,offset_m:0})),warnings:[]};
  const stops=[1,7].map(i=>({id:'s'+i,name:'source stop '+i,coordinates:nodes[i].coordinates.slice(0,2)})),services={stops,connections:[],patterns:[{id:'bus',routeId:'bus',label:'bus',mode:'bus',direction:'forward',geometryMode:'official',stops:[{stopId:'s1',arrivalOffsetS:0,departureOffsetS:0,shapeIndex:0},{stopId:'s7',arrivalOffsetS:10,departureOffsetS:10,shapeIndex:1}],shape:[[114.1611,22.28],[114.1669,22.28]],schedule:{departuresS:[40,100,200,500]},provenance:{sourceUrl:'fixture',scheduleKind:'scheduled',timingNote:'fixture'}}]},links={graph_version:area.version,preference:'fast',connections:[],warnings:[]};
  const a=original.router(original.prepare(structuredClone(area)),structuredClone(services),structuredClone(links)),b=patched.router(patched.prepare(structuredClone(area)),structuredClone(services),structuredClone(links)),request={origin:{lon:114.16,lat:22.28,node_id:'n0'},destination:{lon:114.168,lat:22.28,node_id:'n8'},preference:'fast',departureS:0,departureDate:'2026-10-12',horizonS:1200,allowedModes:['bus'],walkPenalty:2.5};
  const old=structuredClone(await a.route(request)),next=structuredClone(await b.route(request));assert.equal(old.status,'CONDITIONAL',file);assert.equal(next.status,old.status);for(const key of['departureS','arrivalS','durationS','waitS','walkS','score','transfers','timedLegs','scheduled','snapped_origin','snapped_destination'])assert.deepEqual(next[key],old[key],file+'/'+key);
  const ride=next.legs.find(l=>l.kind==='bus');assert.ok(ride,file);assert.equal(next.legs.length,old.legs.length);assert.deepEqual(ride.geometry.coordinates[0],stops[0].coordinates);assert.deepEqual(ride.geometry.coordinates.at(-1),stops[1].coordinates);assert.deepEqual(ride.source_geometry,old.legs.find(l=>l.kind==='bus').geometry);assert.equal(ride.geometry_mode,'schematic');
  const feature=next.geometry.features.find(f=>f.properties.kind==='bus');assert.deepEqual(feature.geometry,ride.geometry);assert.deepEqual(feature.properties.stop_projections,ride.stop_projections);assert.equal(feature.properties.geometry_mode,'schematic');
 }
});
test.after(()=>rmSync(dir,{recursive:true,force:true}));
