/** Fixed fleet showcase area; requested trips still use the full road graph. */
export const FLEET_DEMO_BOUNDS=Object.freeze([114.142,22.267,114.205,22.326]);
export const boundsCorners=([west,south,east,north])=>[[west,south],[west,north],[east,north],[east,south]];
export function insideBounds([x,y],[west,south,east,north]){return x>=west&&x<=east&&y>=south&&y<=north;}
export function createRoadContext(graph,project){
  const seen=new Set(),records=[];
  for(const edge of graph.edges){
    const key=edge.way+':'+[edge.from,edge.to].sort().join(':');if(seen.has(key))continue;seen.add(key);
    const coordinates=edge.geometry??[graph.nodes[edge.from],graph.nodes[edge.to]],points=coordinates.map(project);
    const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
    records.push({west:Math.min(...xs),east:Math.max(...xs),north:Math.min(...ys),south:Math.max(...ys),
      tunnel:graph.ways[edge.way]?.tunnel==='yes',d:points.map(([x,y],i)=>(i?'L':'M')+x.toFixed(1)+','+y.toFixed(1)).join('')});
  }
  let lastKey='',lastResult;
  return view=>{
    const key=[view.x,view.y,view.w,view.h,view.width].join(':');if(key===lastKey)return lastResult;
    const threshold=view.w/Math.max(1,view.width)*1.5,margin=threshold*8;
    const visible=records.filter(r=>r.east>=view.x-margin&&r.west<=view.x+view.w+margin&&r.south>=view.y-margin&&r.north<=view.y+view.h+margin&&Math.max(r.east-r.west,r.south-r.north)>=threshold);
    lastKey=key;lastResult={roads:visible.filter(r=>!r.tunnel).map(r=>r.d).join(''),tunnels:visible.filter(r=>r.tunnel).map(r=>r.d).join(''),count:visible.length};return lastResult;
  };
}
export function visibleFleet(cars,project,view){
  const pad=view.w/Math.max(1,view.width)*12;
  return cars.filter(car=>{const [x,y]=project(car.position);return x>=view.x-pad&&x<=view.x+view.w+pad&&y>=view.y-pad&&y<=view.y+view.h+pad});
}
