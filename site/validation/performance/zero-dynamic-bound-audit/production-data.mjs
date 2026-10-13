const root=fileURLToPath(new URL('../../../',import.meta.url));
const runtime=fileURLToPath(new URL('../runtime-2e2fcf795897/',import.meta.url));
const out=fileURLToPath(new URL('./',import.meta.url));
import{fileURLToPath}from'node:url';
import {readFileSync}from'node:fs';import {gunzipSync}from'node:zlib';import vm from'node:vm';
const url=new URL('file://'+runtime+'assets/app-transit-worker-CaCMeUxU.js');let source=readFileSync(url,'utf8');const context={self:{},console,setTimeout,clearTimeout,DOMException};
for(const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)";/g)){const module=await import(new URL(match[2],url).href);for(const binding of match[1].split(',')){const[name,alias]=binding.trim().split(/\s+as\s+/);context[alias??name]=module[name];}}
source=source.replace(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)";/g,'').replace('let tt;self.onmessage','globalThis.audit={validate:ot,lift:kt,schedule:be};let tt;self.onmessage');vm.createContext(context);vm.runInContext(source,context);
const read=path=>JSON.parse(path.endsWith('.gz')?gunzipSync(readFileSync(root+path)):readFileSync(root+path,'utf8'));
const problems=[],results=[];const strings=x=>Array.isArray(x)&&x.every(y=>typeof y==='string');
for(const path of ['dist/area/area-graph.json.gz','dist/area/admiralty-block-graph.json.gz','dist/area/station-graph.json.gz']){
 const g=read(path);context.audit.validate(g);let liftCount=0,minLift=Infinity,maxDuration=0,maxLength=0,maxZ=0,zeroDuration=0,subsecondDuration=0,scheduled=0;const residuals=[];
 if(g.warnings!==undefined&&!strings(g.warnings))problems.push([path,'graph.warnings']);
 for(const p of g.portals??[])if(p.warnings!==undefined&&!strings(p.warnings))problems.push([path,'portal.warnings',p.id]);
 for(const e of g.edges){
  if(e.warnings!==undefined&&!strings(e.warnings))problems.push([path,'edge.warnings',e.id]);
  if(e.access_time_id!=null){scheduled++;if(!context.audit.schedule(e))problems.push([path,'failclosed schedule',e.id]);}
  const l=context.audit.lift(e);if(l){liftCount++;const residual=e.duration_s-l.wait;minLift=Math.min(minLift,residual);if(!Number.isFinite(residual)||residual<0)problems.push([path,'lift residual',e.id,residual]);if(residual<1)residuals.push([e.id,residual]);}
  maxDuration=Math.max(maxDuration,e.duration_s);maxLength=Math.max(maxLength,e.length_m??0);for(const p of e.coordinates)maxZ=Math.max(maxZ,Math.abs(p[2]??0));if(e.duration_s===0)zeroDuration++;else if(e.duration_s<1)subsecondDuration++;
 }
 results.push({path,validation:'actual production ot passed',nodes:g.nodes.length,edges:g.edges.length,demoGuard:!!g.demo_connector_geography,liftCount,minLift,maxDuration,maxLength,maxZ,zeroDuration,subsecondDuration,scheduled,smallLiftResiduals:residuals});
}
const links=read('dist/transit/walk-links.json.gz');for(const c of links.connections){const r=c.route;if(!Number.isFinite(r.total_minutes)||r.total_minutes<0)problems.push(['links duration',c.id]);if(!strings(r.warnings))problems.push(['links warnings',c.id]);for(const l of r.legs)if(!strings(l.edge_ids??l.source_edge_ids)||!Number.isFinite(l.minutes)||l.minutes<0)problems.push(['links leg',c.id]);}
console.log(JSON.stringify({results,walkLinks:links.connections.length,problems},null,2));
