import {KOW_C1_CORRIDOR as D} from './kow-c1-corridor-data.js?v=0f6587f77445';
const cache=new WeakMap(),cross=(a,b)=>a[0]*b[1]-a[1]*b[0],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]];
const same=(a,b)=>a?.length===3&&b?.length===3&&a.every((v,i)=>Math.abs(v-b[i])<(i===2?.001:1e-8));
function on(p,a,b){return Math.abs(cross(sub(p,a),sub(b,a)))<1e-14&&p[0]>=Math.min(a[0],b[0])-1e-10&&p[0]<=Math.max(a[0],b[0])+1e-10&&p[1]>=Math.min(a[1],b[1])-1e-10&&p[1]<=Math.max(a[1],b[1])+1e-10;}
function intersects(a,b,c,d){const v=sub(b,a),w=sub(d,c),den=cross(v,w);if(Math.abs(den)<1e-20)return on(a,c,d)||on(b,c,d)||on(c,a,b)||on(d,a,b);const t=cross(sub(c,a),w)/den,u=cross(sub(c,a),v)/den;return t>=0&&t<=1&&u>=0&&u<=1;}
function inside(p,rings){let value=false;for(const ring of rings)for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i];if(on(p,a,b))return true;if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])value=!value;}return value;}
export function corridorGeometryAllowed(coordinates,sourceGraph){
 if(!Array.isArray(coordinates)||coordinates.length<2||coordinates.some(p=>p.length!==3||p.some(v=>!Number.isFinite(v))||Math.abs(p[2]-13.5)>.001))return false;
 const closed=new Set((sourceGraph?.closures??[]).flatMap(c=>c.physical_ids??[]));
 const forbidden=(sourceGraph?.edges??[]).filter(e=>e.disabled||e.wheelchair_barrier===1||closed.has(e.physical_id));
 for(let i=1;i<coordinates.length;i++){
  const a=coordinates[i-1],b=coordinates[i];
  for(const polygon of D.barriers){if(inside(a,polygon.rings)||inside(b,polygon.rings))return false;for(const ring of polygon.rings)for(let j=1;j<ring.length;j++)if(intersects(a,b,ring[j-1],ring[j]))return false;}
  for(const edge of forbidden)for(let j=1;j<(edge.coordinates?.length??0);j++){
   const c=edge.coordinates[j-1],d=edge.coordinates[j];if(c.length<3||d.length<3||!Number.isFinite(c[2])||!Number.isFinite(d[2])){if(intersects(a,b,c,d))return false;continue;}if(Math.min(c[2],d[2])>14.5||Math.max(c[2],d[2])<12.5)continue;
   if(intersects(a,b,c,d)){
    const v=sub(b,a),w=sub(d,c),den=cross(v,w);
    // A plan-view crossing with a different storey is not a blocked U3 corridor.
    if(Math.abs(den)<1e-20){if(Math.min(c[2],d[2])<=14.25&&Math.max(c[2],d[2])>=12.75)return false;}
    else{const u=cross(sub(c,a),v)/den,z=c[2]+u*(d[2]-c[2]);if(Math.abs(z-13.5)<=.75)return false;}
   }
  }
 }
 return true;
}
/** Added only to the already filtered demo graph, never certified for accessibility. */
export function addKowloonModeledCorridor(graph,sourceGraph=graph){
 if(!graph?.nodes||!graph?.edges)return graph;
 if(cache.has(graph))return cache.get(graph);
 const from=graph.nodes.find(n=>n.id===D.fromId),to=graph.nodes.find(n=>n.id===D.toId);
 if(!same(from?.coordinates,D.coordinates[0])||!same(to?.coordinates,D.coordinates.at(-1))||!corridorGeometryAllowed(D.coordinates,sourceGraph))return graph;
 const base={physical_id:'DEMO:KOW:C1:U3:CORRIDOR',region_id:from.region_id,kind:'access_connector',name:'圆方L1公共走廊绕行 · 模型接驳待确认',length_m:D.lengthM,duration_s:D.lengthM/1.2,source_id:'MODELED-MTR-ELEMENTS-CORRIDOR',geometry_mode:'schematic',snap_eligible:false,accessible_eligible:false,wheelchair_barrier:null,disabled:false,location:2,direction:0,access_evidence:'UNVERIFIED',model_evidence:'Official MTR/Elements same-floor corridor shape; turns and clearance modeled',needs_facility_confirmation:true,source_urls:D.sources};
 const edges=[{...base,id:base.physical_id,from_id:from.id,to_id:to.id,coordinates:D.coordinates.map(p=>[...p])},{...base,id:base.physical_id+':r',from_id:to.id,to_id:from.id,coordinates:D.coordinates.toReversed().map(p=>[...p])}];
 const result={...graph,version:graph.version+':kow-c1-demo-v1',edges:[...graph.edges,...edges],modeled_corridors:[...(graph.modeled_corridors??[]),{id:base.physical_id,length_m:D.lengthM,level:'U3 / ELEMENTS L1',elevation_m:13.5,confidence:'modeled',needsConfirmation:true,sources:D.sources}]};
 cache.set(graph,result);return result;
}
