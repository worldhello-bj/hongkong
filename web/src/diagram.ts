export type DiagramNode = {id:string;x:number;y:number;kind:string;name_tc:string;level_id:string};
export type DiagramLabel = {text:string;x:number;y:number;bounds:[number,number,number,number]};

/** Diagram-only layout. Never changes source coordinates or routing lengths. */
export function diagramLayout(nodes:DiagramNode[],endpoints:string[],selected?:string){
 const buses=nodes.filter(n=>n.kind==='bus_stop');
 const others=nodes.filter(n=>n.kind!=='bus_stop');
 const rows=Math.ceil(buses.length/9);
 const top=buses.length?125+Math.max(0,rows-1)*29:95;
 const xs=others.map(n=>n.x),ys=others.map(n=>n.y);
 const minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);
 const positions=new Map<string,[number,number]>();
 others.forEach(n=>positions.set(n.id,[110+(n.x-minx)/Math.max(1,maxx-minx)*640,top+(n.y-miny)/Math.max(1,maxy-miny)*(485-top)]));
 buses.forEach((n,i)=>positions.set(n.id,[120+(i%9)*73,58+Math.floor(i/9)*29]));
 const labels=new Map<string,DiagramLabel>();
 const boxes:[number,number,number,number][]=[];
 const important=new Set(['platform','entrance','process']);
 const priority=(n:DiagramNode)=>n.id===selected?0:endpoints.includes(n.id)?1:important.has(n.kind)?2:3;
 for(const n of [...nodes].sort((a,b)=>priority(a)-priority(b))){
  // Every marker remains focusable and has a full tooltip/name. Dense bus and
  // intermediate nodes reveal their full name on selection instead of colliding.
  if(priority(n)===3)continue;
  const p=positions.get(n.id)!;
  const chars=Array.from(n.name_tc);const text=chars.length>22?chars.slice(0,21).join('')+'…':n.name_tc;
  const width=Math.min(250,Array.from(text).reduce((sum,c)=>sum+(c.charCodeAt(0)>255?11:6.4),0)+12);
  for(const dy of [-30,25,-48,43]){
   const x=Math.max(85+width/2,Math.min(830-width/2,p[0]));
   const y=p[1]+dy;
   const bounds:[number,number,number,number]=[x-width/2,y-12,x+width/2,y+15];
   if(bounds[1]<12||bounds[3]>550)continue;
   if(boxes.some(b=>bounds[0]<b[2]+7&&bounds[2]>b[0]-7&&bounds[1]<b[3]+5&&bounds[3]>b[1]-5))continue;
   labels.set(n.id,{text,x:x-p[0],y:dy,bounds});boxes.push(bounds);break;
  }
 }
 return {positions,labels};
}
