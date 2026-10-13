// Externalize only existing display geometry; leave every routing graph byte untouched.
import{readFile,writeFile,mkdir}from'node:fs/promises';
const root=new URL('../',import.meta.url),path=new URL('dist/assets/mobile-navigation-DfEsS_7b.js',root);
let source=await readFile(path,'utf8');
if(!source.includes('function loadDetailedMap')){
 const match=source.match(/,R2=JSON\.parse\(`([^`]+)`\)/);if(!match)throw new Error('Display geometry boundary changed');
 const raw=match[1],features=JSON.parse(raw);if(features.length!==5127)throw new Error('Unexpected source feature count');
 await mkdir(new URL('dist/map-detail/',root),{recursive:true});await writeFile(new URL('dist/map-detail/admiralty.json',root),raw);
 source=source.replace(match[0],';let R2=[]');
 const svg=source.match(/,y6=(R2\.map\(e=>\{.+?\}\));R2\.filter/);
 const canvas=source.match(/const L6=(R2\.map\(e=>\{.+?\}\)),i4=/);
 const points=source.match(/,p6=(R2\.filter\(.+?\)\)\)),U1=/);
 if(!svg||!canvas||!points)throw new Error('Display index boundary changed');
 source=source.replace(svg[0],';let y6=[];R2.filter').replace(canvas[0],'let L6=[];const i4=').replace(points[0],';let p6=[];const U1=');
 source+=`\nlet detailedMapPromise;\nfunction loadDetailedMap(){return detailedMapPromise??=(async()=>{const response=await fetch('/map-detail/admiralty.json');if(!response.ok)throw new Error('Detailed display map '+response.status);const data=await response.json();if(!Array.isArray(data)||data.length!==5127)throw new Error('Invalid detailed display map');R2=data;y6=${svg[1]};L6=${canvas[1]};p6=${points[1]};T2.clear();return true;})().catch(error=>{detailedMapPromise=undefined;throw error;});}\n`;
 source=source.replace('export{J4 as L,','export{loadDetailedMap,J4 as L,');
 await writeFile(path,source);
}else await readFile(new URL('dist/map-detail/admiralty.json',root));
console.log('Display geometry is independently lazy-loaded; route data unchanged.');
