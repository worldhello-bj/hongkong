import {journeyScore} from "./journey-score.js?v=ac80b061436c";
/** All public transport remains enabled. Taxi only widens the search. */
export const PUBLIC_MODES = Object.freeze(['metro', 'bus', 'tram']);
export const SEARCH_VARIANTS = Object.freeze(['transit', 'walk', 'metro']);
const rideModes = new Set(['metro', 'rail', 'bus', 'tram', 'taxi', 'highspeed']);
export function journeyModeChain(segments = []) {
  const chain = [];
  for (const segment of segments) {
    if (['wait','procedure'].includes(segment.kind) || ['wait','procedure'].includes(segment.mode)) continue;
    const kind = segment.kind ?? segment.mode;
    const mode = kind === 'rail' ? 'metro' : rideModes.has(kind) ? kind : 'walk';
    if (chain.at(-1) !== mode) chain.push(mode);
  }
  return chain;
}
export function rankJourneys(choices, priority = 'time', need = 'ordinary', weights = {}) {
  return [...choices].sort((a,b)=>Number(b.available)-Number(a.available)
    || (need==='luggage'?Number(!!a.result?.luggageCarryRequired)-Number(!!b.result?.luggageCarryRequired):0)
    || journeyScore(a,priority,need,weights).total-journeyScore(b,priority,need,weights).total
    || (a.minutes??Infinity)-(b.minutes??Infinity)
    || (a.cost??Infinity)-(b.cost??Infinity)
    || (a.transfers??Infinity)-(b.transfers??Infinity)
    || String(a.id??'').localeCompare(String(b.id??'')));
}
export function deduplicateJourneys(choices) {
  const seen = new Set();
  return choices.filter(choice => {
    if (!choice.available) return true;
    const steps = choice.result?.journey?.steps ?? [];
    const key = JSON.stringify([choice.minutes, steps.map(step => [step.kind,
      step.guidance?.edge_ids ?? [], step.guidance?.geometry?.coordinates ?? []])]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
/** Actual service arrival, before the following exit/walking leg. Never infer a road pickup. */
export function publicArrivalAnchors(result) {
  return (result?.timedLegs ?? []).flatMap((leg, index) => {
    if (!rideModes.has(leg.kind) || leg.kind === 'taxi') return [];
    const coordinate = leg.geometry?.at(-1);
    if (!coordinate || !Number.isFinite(leg.arrivalS)) return [];
    return [{id: leg.toId, name: leg.toName ?? leg.label ?? leg.toId,
      coordinates: coordinate.slice(0, 2), arrivalS: leg.arrivalS,
      legIndex: index, publicMode: leg.kind, requiresExitWalk: true}];
  });
}
/** Fast routes may reuse stable public connections, never a newly closed indoor edge. */
export function compatibleWithOverlay(result,baseGraph,blockGraph){
  if(!result.journey?.complete||!blockGraph)return !!result.journey?.complete;
  const originals=new Map(baseGraph.edges.map(edge=>[edge.id,edge]));
  const latest=new Map(blockGraph.edges.map(edge=>[edge.id,edge]));
  const closed=new Set((blockGraph.closures??[]).flatMap(closure=>closure.physical_ids??[]));
  const authoritative=new Set([...(blockGraph.authoritative_physical_ids??[]),...(blockGraph.admiralty_block_authoritative_physical_ids??[])]);
  for(const step of result.journey.steps??[])for(const id of step.guidance?.edge_ids??[]){
    const sourceId=id.replace(/:split:\d+$/,''),old=originals.get(sourceId),now=latest.get(sourceId);
    if(!now&&authoritative.has(old?.physical_id))return false;
    if(now?.disabled||closed.has(now?.physical_id??old?.physical_id))return false;
    if(now&&JSON.stringify(now.access_schedule??null)!==JSON.stringify(old?.access_schedule??null))return false;
  }
  return true;
}
/** A request runs at most two search branches at a time. */
export async function runBounded(tasks,limit=2){
  let next=0;
  const results=[];
  const consume=async()=>{
    while(next<tasks.length){const index=next++;try{results[index]={status:'fulfilled',value:await tasks[index]()};}catch(reason){results[index]={status:'rejected',reason};}}
  };
  await Promise.all(Array.from({length:Math.min(limit,tasks.length)},consume));
  return results;
}
const geographyCache=new WeakMap();
const hkProject=coordinate=>[(coordinate[0]-114.165)*102900,-(coordinate[1]-22.279)*111320];
const finitePoint=p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1]);
/** Parse the existing authoritative context's polygon-only SVG format; reject curves/unknown commands. */
export function parseContextRings(path){
 if(typeof path!=='string'||/[^MLZmlz\d.,\s+\-eE]/.test(path))return null;
 // Context paths use absolute M/L/Z exclusively. Relative geometry is not guessed.
 if(/[mlz]/.test(path))return null;
 const tokens=path.match(/[MLZ]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g)??[];
 const rings=[];let ring=null,index=0,command;
 while(index<tokens.length){
  const token=tokens[index];
  if(token==='Z'){if(!ring||ring.length<3)return null;rings.push(ring);ring=null;command=undefined;index++;continue;}
  if(token==='M'||token==='L'){command=token;index++;if(command==='M'){if(ring)return null;ring=[];}}
  if(!ring||!['M','L'].includes(command)||index+1>=tokens.length)return null;
  const point=[Number(tokens[index]),Number(tokens[index+1])];if(!finitePoint(point))return null;ring.push(point);index+=2;command='L';
 }
 return ring||!rings.length?null:rings;
}
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function onSegment(a,b,p){return Math.abs(cross(a,b,p))<1e-7&&p[0]>=Math.min(a[0],b[0])-1e-7&&p[0]<=Math.max(a[0],b[0])+1e-7&&p[1]>=Math.min(a[1],b[1])-1e-7&&p[1]<=Math.max(a[1],b[1])+1e-7;}
function intersects(a,b,c,d){
 const abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);
 return abC*abD<0&&cdA*cdB<0||onSegment(a,b,c)||onSegment(a,b,d)||onSegment(c,d,a)||onSegment(c,d,b);
}
function inRing(point,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
 const a=ring[i],b=ring[j];if(onSegment(a,b,point))return true;
 if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
}return inside;}
function throughPolygon(a,b,rings){
 if(rings.reduce((inside,ring)=>inside!==inRing(a,ring),false)||rings.reduce((inside,ring)=>inside!==inRing(b,ring),false))return true;
 return rings.some(ring=>ring.some((c,index)=>intersects(a,b,c,ring[(index+1)%ring.length])));
}
/** No wall-clock/distance cutoff: reject water, known closures, and unknown context instead. */
export function createModeledConnectorGuard({geography,contextFeatures=geography,graph,detail,barrierLines=[],project=hkProject}={}){
 if(!Array.isArray(contextFeatures)||!contextFeatures.length)return ()=>false;
 let context=geographyCache.get(contextFeatures);
 if(!context){
  const water=[],points=[];let valid=true;
  for(const feature of contextFeatures){
   const rings=parseContextRings(feature.d);if(!rings){valid=false;break;}
   points.push(...rings.flat());if(feature.kind==='water'||feature.kind==='barrier')water.push(rings);
  }
  const bounds=points.length?[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))]:null;
  context={water,bounds,valid:valid&&!!bounds&&water.length>0};geographyCache.set(contextFeatures,context);
 }
 if(!context.valid)return ()=>false;
 const barriers=[...barrierLines];
 for(const data of [graph,detail].filter(Boolean)){
  const closed=new Set((data.closures??[]).flatMap(c=>c.physical_ids??[]));
  for(const edge of data.edges??[])if(edge.disabled||closed.has(edge.physical_id))barriers.push(edge.coordinates);
 }
 const projected=barriers.map(line=>Array.isArray(line)&&line.every(finitePoint)?line.map(project):null);
 if(projected.some(line=>!line||line.some(p=>!finitePoint(p))))return ()=>false;
 return (before,after)=>{
  if(!finitePoint(before)||!finitePoint(after))return false;
  const a=project(before),b=project(after),bounds=context.bounds;if(!finitePoint(a)||!finitePoint(b))return false;
  if([a,b].some(p=>p[0]<bounds[0]||p[0]>bounds[2]||p[1]<bounds[1]||p[1]>bounds[3]))return false;
  if(context.water.some(rings=>throughPolygon(a,b,rings)))return false;
  return !projected.some(line=>line.some((c,i)=>i>0&&intersects(a,b,line[i-1],c)));
 };
}
/** Ordinary-trip connectors remain explicit simulations, never step-free certification. */
export function addShortDemoConnectors(journey,route,request,context={}){
 if(journey.complete||request.need==='accessible')return false;
 const blocked=journey.steps.filter(step=>step.blocked);if(!blocked.length)return false;
 const isAllowed=context.isConnectorAllowed??createModeledConnectorGuard(context),patches=[];
 const distance=(a,b)=>Math.hypot((a[0]-b[0])*102900,(a[1]-b[1])*111320);
 for(const step of blocked){
  const index=step.guidance?.leg_index,leg=route.legs[index];
  if(!leg||leg.kind!=='access_connector'||!Number.isFinite(leg.distance_m)||leg.distance_m<0)return false;
  const local=leg.local_access_geometry??leg.geometry;
  const localPoints=local?.type==='LineString'?local.coordinates:undefined;
  // Internal access belongs to its subjourney. Never substitute the whole trip's pins.
  let before=localPoints?.[0]??(index===0?request.origin.coordinates:undefined);
  let after=localPoints?.at(-1)??(index===route.legs.length-1?request.destination.coordinates:undefined);
  if(!before&&index===route.legs.length-1)before=route.legs[index-1]?.geometry?.coordinates?.at(-1);
  if(!after&&index===0)after=route.legs[index+1]?.geometry?.coordinates?.[0];
  if(index===0&&request.origin.demoSourceCoordinates)before=request.origin.demoSourceCoordinates;
  if(index===route.legs.length-1&&request.destination.demoSourceCoordinates)after=request.destination.demoSourceCoordinates;
  if(!finitePoint(before)||!finitePoint(after))return false;
  const path=localPoints?.length>2?localPoints.map(p=>p.slice()):[before,after];path[0]=before;path[path.length-1]=after;
  if(path.some(p=>!finitePoint(p))||path.slice(1).some((p,i)=>!isAllowed(path[i],p,{leg,request})))return false;
  if(Number.isFinite(before[2])&&Number.isFinite(after[2])&&Math.abs(before[2]-after[2])>1)return false; // Never invent a vertical connector.
  const pathMeters=path.slice(1).reduce((total,p,i)=>total+distance(path[i],p),0);
  if(Math.abs(pathMeters-leg.distance_m)>Math.max(2,leg.distance_m*.05))return false; // Preserve distance/time consistency.
  const meters=Math.ceil(Math.max(leg.distance_m,pathMeters)),minutes=Number.isFinite(leg.minutes)?leg.minutes:meters/72;
  if(minutes<0||meters>0&&minutes===0)return false;
  patches.push({step,leg,before:before.slice(),after:after.slice(),path,meters,minutes}); // Preserve known source elevations in modeled geometry.
 }
 for(const {step,leg,before,after,path,meters,minutes} of patches){
  // Keep the route engine's existing duration/arrival/service connections intact.
  // The displayed distance is rounded only; no extra time is added twice.
  if(!Number.isFinite(leg.minutes))leg.minutes=minutes;
  step.blocked=false;step.context='演示步行接驳 · 未实地核验';step.guidance={...step.guidance,minutes,instruction:`估算步行接驳 ${meters} 米 · 约 ${Math.ceil(minutes)} 分钟（未实地核验）`,geometry_mode:'schematic',geometry:{type:'LineString',coordinates:path}};
 }
 if(!Number.isFinite(journey.knownMinutes)&&Number.isFinite(route.total_minutes))journey.knownMinutes=route.total_minutes;
 journey.complete=true;journey.demoConnectors=true;return true;
}
