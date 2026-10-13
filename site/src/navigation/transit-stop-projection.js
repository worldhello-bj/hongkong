/** A source transit stop is not necessarily a vertex of its road-centreline shape.
 * Preserve the source stop and the original shape, and disclose the small vehicle
 * display association. This never creates a pedestrian or vertical connection.
 * Scheduled arrival/departure, walking time and access constraints are untouched.
 */
export function alignTransitStopProjection(leg,pattern,fromStop,toStop){
 const source=(leg.geometry??[]).map(point=>point.slice()),mode=pattern?.geometryMode??'schematic';
 const result={coordinates:source,geometryMode:mode,metadata:{},warnings:[]};
 const xy=point=>Array.isArray(point)&&point.length===2&&point.every(Number.isFinite);
 const sourceStop=(stop,id)=>typeof id==='string'&&!id.startsWith('RAIL:')&&stop?.id===id&&xy(stop.coordinates)&&!stop.blocked&&!stop.node_id&&!stop.node_ids&&!stop.floorId&&!stop.floor_id&&!stop.floorName&&!stop.placeId;
 if(leg.blocked||!['bus','tram'].includes(leg.kind)||pattern?.mode!==leg.kind||!leg.patternId||pattern.id!==leg.patternId||source.length<2||!source.every(xy)||!sourceStop(fromStop,leg.fromId)||!sourceStop(toStop,leg.toId))return result;
 const calls=pattern.stops??[],from=calls.findIndex(call=>call.stopId===leg.fromId);
 if(from<0||!calls.slice(from+1).some(call=>call.stopId===leg.toId))return result;
 const same=(a,b)=>a[0]===b[0]&&a[1]===b[1],projections=[],coordinates=source.slice();
 if(!same(fromStop.coordinates,source[0])){
  const from=fromStop.coordinates.slice(),to=source[0].slice();coordinates.unshift(from);
  projections.push({source_stop_id:leg.fromId,role:'boarding',geometry_mode:'schematic',verified:false,geometry:{type:'LineString',coordinates:[from,to]}});
 }
 if(!same(source.at(-1),toStop.coordinates)){
  const from=source.at(-1).slice(),to=toStop.coordinates.slice();coordinates.push(to);
  projections.push({source_stop_id:leg.toId,role:'alighting',geometry_mode:'schematic',verified:false,geometry:{type:'LineString',coordinates:[from,to]}});
 }
 if(!projections.length)return result;
 return {coordinates,geometryMode:'schematic',metadata:{source_geometry:{type:'LineString',coordinates:source},source_geometry_mode:mode,stop_projections:projections,modeled_stop_projection:true},
  warnings:['巴士／电车站位与车行中心线的端部关联为示意投影，保留来源站点及原线路；不是已核验的步行、无障碍或上落客通道。车上时分沿用来源班次模型。']};
}
