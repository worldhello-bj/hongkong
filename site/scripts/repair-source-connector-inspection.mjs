import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const path=root+'dist/assets/mobile-navigation-DfEsS_7b.js';
let text=await readFile(path,'utf8');
const marker='/* HK_SOURCE_CONNECTOR_INSPECTION_V1 */';
const anchor='showStationExample(s){';
if(!text.includes(marker)){
 if(text.split(anchor).length!==2)throw new Error('Source connector renderer anchor changed');
 text=text.replace(anchor,`${marker}focusSourceEdge(id){const edge=c1.get(id);if(!edge||edge.source_id!=="CSDI-INDOOR"||edge.geometry_mode!=="official"||edge.disabled||!r.regions.some(region=>region.id===edge.region_id)||!Array.isArray(edge.coordinates)||edge.coordinates.length<2||!edge.coordinates.every(point=>Array.isArray(point)&&point.length>=3&&point.slice(0,3).every(Number.isFinite)))return false;_++;ge();l=false;d2(edge.region_id);Ze({type:"LineString",coordinates:edge.coordinates});a.textContent="官方 XYZ 设施原始路段 · 来源高程，非实时通行证明";e.dataset.sourceInspectionEdge=id;e.dataset.sourceInspectionStation=edge.region_id;i1();return true;},${anchor}`);
 await writeFile(path,text);
}
console.log('Source connector inspection renderer ready.');
