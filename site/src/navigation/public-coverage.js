/** Visualize the same radius AND rectangular service envelope used by public access. */
export function publicCoverageRing(region){
 const [lng,lat]=region.center,r=region.radius_m,b=region.selection_bounds??region.bounds;
 let points=Array.from({length:128},(_,i)=>{const a=i*Math.PI/64;return[lng+Math.cos(a)*r/(111320*Math.cos(lat*Math.PI/180)),lat+Math.sin(a)*r/111320]});
 if(!b)return points;
 for(const [axis,value,sign]of [[0,b[0],1],[0,b[2],-1],[1,b[1],1],[1,b[3],-1]]){
  const output=[];for(let i=0;i<points.length;i++){const a=points[i],c=points[(i+1)%points.length],ai=(a[axis]-value)*sign>=0,ci=(c[axis]-value)*sign>=0;if(ai)output.push(a);if(ai!==ci){const t=(value-a[axis])/(c[axis]-a[axis]);output.push([a[0]+t*(c[0]-a[0]),a[1]+t*(c[1]-a[1])]);}}points=output;
 }
 return points;
}

export function publicCoverageRings(region){return (region.selection_envelopes?.length?region.selection_envelopes:[region.selection_bounds??region.bounds]).map(bounds=>publicCoverageRing({...region,selection_bounds:bounds}));}
