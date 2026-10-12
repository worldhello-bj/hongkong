import {readFile,writeFile} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
export const CORRECTED_LIFT_IDS=new Set([1000859480,1000860708,1000859708,1000861503,1000862126,1000860957,1000862720].map(id=>'ADM:I:'+id));
/** Only the seven audited official lift features; preserve later overrides and closures. */
export function reconcileLiftOverlay(overlay,station){
 const source=new Map(station.edges.map(e=>[e.id,e])),closed=new Set((overlay.closures??[]).flatMap(c=>c.physical_ids??[]));
 let corrected=0;
 for(const e of overlay.edges){
  const current=source.get(e.id),p=e.source_properties;
  if(!CORRECTED_LIFT_IDS.has(e.physical_id)||!current||e.eligibility_correction||e.accessible_eligible!==false||closed.has(e.physical_id))continue;
  if(e.disabled||current.disabled||current.accessible_eligible!==true||e.kind!=='lift'||current.kind!=='lift'||e.wheelchair_barrier!==2||current.wheelchair_barrier!==2)continue;
  if(e.source_id!=='CSDI-INDOOR'||e.source_id!==current.source_id||e.source_feature_id!==current.source_feature_id||e.from_id!==current.from_id||e.to_id!==current.to_id||e.direction!==current.direction||e.access_time_id!==current.access_time_id||JSON.stringify(e.access_schedule??null)!==JSON.stringify(current.access_schedule??null)||JSON.stringify(e.coordinates)!==JSON.stringify(current.coordinates))continue;
  if(p?.PedestrianRouteID!==e.source_feature_id||p.FeatureType!==10||p.WheelchairBarrier!==2||p.Enabled!==1||p.Direction!==e.direction||p.AccessTimeID!==e.access_time_id)continue;
  e.accessible_eligible=true;e.eligibility_correction={reason:'Audited official lift eligibility supersedes stale blanket lift exclusion',source_feature_id:e.source_feature_id,source_url:e.source_url};corrected++;
 }
 return corrected;
}
export async function applyStationOverlayRepair(){
 const root=new URL('../dist/area/',import.meta.url),path=new URL('admiralty-block-graph.json.gz',root);
 const overlay=JSON.parse(gunzipSync(await readFile(path))),station=JSON.parse(gunzipSync(await readFile(new URL('station-graph.json.gz',root))));
 const count=reconcileLiftOverlay(overlay,station);
 if(count){delete overlay.version;overlay.version=createHash('sha256').update(JSON.stringify(overlay)).digest('hex').slice(0,16);await writeFile(path,gzipSync(JSON.stringify(overlay)));}
 console.log('Audited lift overlay eligibility corrections:',count,'(seven physical features only; closures and barriers preserved).');
}
