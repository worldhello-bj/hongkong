import{readFileSync,writeFileSync}from'node:fs';import{fileURLToPath,pathToFileURL}from'node:url';
const helper=readFileSync(new URL('../src/navigation/transit-stop-projection.js',import.meta.url),'utf8').replace('export function alignTransitStopProjection','function __hkAlignTransitStopProjection');
const begin='\n/* HK_TRANSIT_STOP_PROJECTION_V1_BEGIN */\n',end='/* HK_TRANSIT_STOP_PROJECTION_V1_END */\n';
export const transitProjectionAssets=['app-transit-worker-CaCMeUxU.js','intermodal-routing-D8vKT-lN.js'];
const sets=[
 ['x=C?.geometryMode??"schematic",F=(l.geometry??[]).map(ye=>[...ye])','hkRideProjection=__hkAlignTransitStopProjection(l,C,w.get(l.fromId),w.get(l.toId)),x=hkRideProjection.geometryMode,F=hkRideProjection.coordinates',
  'geometry_mode:x,edge_ids:[z]','geometry_mode:x,...hkRideProjection.metadata,edge_ids:[z]',
  'geometry_mode:x,source_id:C?.provenance.sourceUrl,estimated:!0','geometry_mode:x,...hkRideProjection.metadata,source_id:C?.provenance.sourceUrl,estimated:!0',
  'C&&W.push(C.provenance.timingNote','W.push(...hkRideProjection.warnings),C&&W.push(C.provenance.timingNote'],
 ['M=_?.geometryMode??"schematic",N=(a.geometry??[]).map(we=>[...we])','hkRideProjection=__hkAlignTransitStopProjection(a,_,h.get(a.fromId),h.get(a.toId)),M=hkRideProjection.geometryMode,N=hkRideProjection.coordinates',
  'geometry_mode:M,edge_ids:[C]','geometry_mode:M,...hkRideProjection.metadata,edge_ids:[C]',
  'geometry_mode:M,source_id:_?.provenance.sourceUrl,estimated:!0','geometry_mode:M,...hkRideProjection.metadata,source_id:_?.provenance.sourceUrl,estimated:!0',
  '_&&$.push(_.provenance.timingNote','$.push(...hkRideProjection.warnings),_&&$.push(_.provenance.timingNote']
];
function replaceOnce(source,a,b){if(source.split(a).length!==2)throw Error('Transit stop projection anchor drift: '+a.slice(0,60));return source.replace(a,b)}
export function restoreTransitStopProjection(source){
 if(!source.includes(begin))return source;
 const at=source.indexOf(begin),last=source.indexOf(end,at);if(last<0)throw Error('Missing transit projection helper end');source=source.slice(0,at)+source.slice(last+end.length);
 const set=sets.find(s=>source.includes(s[1]));if(!set)throw Error('Missing transit projection output anchor');
 for(let i=0;i<set.length;i+=2)source=replaceOnce(source,set[i+1],set[i]);return source;
}
export function patchTransitStopProjection(source){
 const original=source;source=restoreTransitStopProjection(source);const set=sets.find(s=>source.includes(s[0]));if(!set)throw Error('Missing transit ride output anchor');
 for(let i=0;i<set.length;i+=2)source=replaceOnce(source,set[i],set[i+1]);source+=begin+helper+end;return{source,changes:source===original?0:1};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const root=process.argv[2]??fileURLToPath(new URL('../',import.meta.url));for(const file of transitProjectionAssets){const path=root+'/dist/assets/'+file,result=patchTransitStopProjection(readFileSync(path,'utf8'));if(result.changes)writeFileSync(path,result.source);console.log(file+': '+result.changes+' disclosed transit stop projection changes')}}
