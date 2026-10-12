import{readFileSync,writeFileSync}from'node:fs';import{fileURLToPath,pathToFileURL}from'node:url';
export const scheduledLabelAssets=['app-transit-worker-CaCMeUxU.js','intermodal-routing-D8vKT-lN.js'];
const helper=readFileSync(new URL('../src/navigation/scheduled-label-buckets.js',import.meta.url),'utf8').replace('export function getScheduledLabelBucket','function __hkGetScheduledLabelBucket').replace('export function setScheduledLabelBucket','function __hkSetScheduledLabelBucket');
const prefix='/* HK_SCHEDULED_LABEL_BUCKETS_V1 */\n'+helper+'\n/* END_HK_SCHEDULED_LABEL_BUCKETS_V1 */\n';
const prefixPattern=/\/\* HK_SCHEDULED_LABEL_BUCKETS_V1 \*\/\n[\s\S]*?\/\* END_HK_SCHEDULED_LABEL_BUCKETS_V1 \*\/\n/;
const configurations=[
 {anchor:'function Dt(t,e){',pairs:[['u.set(o,[E]),S.push(E);','__hkSetScheduledLabelBucket(u,o,s,p,[E]),S.push(E);'],['ie=u.get(I)??[]','ie=__hkGetScheduledLabelBucket(u,I,k,p)??[]'],['ie.push(i),u.set(I,ie),S.push(i)','ie.push(i),__hkSetScheduledLabelBucket(u,I,k,p,ie),S.push(i)']]},
 {anchor:'function Xe(o,r){',pairs:[['c.set(s,[I]),P.push(I);','__hkSetScheduledLabelBucket(c,s,n,w,[I]),P.push(I);'],['K=c.get(v)??[]','K=__hkGetScheduledLabelBucket(c,v,A,w)??[]'],['K.push(e),c.set(v,K),P.push(e)','K.push(e),__hkSetScheduledLabelBucket(c,v,A,w,K),P.push(e)']]}
];
function configuration(source){const matches=configurations.filter(c=>source.includes(c.anchor));if(matches.length!==1)throw Error('Scheduled label engine anchor drift');return matches[0];}
function once(source,old,next){if(source.split(old).length!==2)throw Error('Scheduled label patch anchor drift: '+old);return source.replace(old,next);}
export function restoreScheduledLabelBuckets(source){
 if(!source.includes('HK_SCHEDULED_LABEL_BUCKETS_V1'))return source;
 const prefix=source.match(prefixPattern)?.[0];if(!prefix)throw Error('Scheduled label helper marker drift');source=source.replace(prefix,'');
 for(const [old,next]of configuration(source).pairs)source=once(source,next,old);
 return source;
}
export function patchScheduledLabelBuckets(source){
 if(source.includes('HK_SCHEDULED_LABEL_BUCKETS_V1')){
  restoreScheduledLabelBuckets(source);const prior=source.match(prefixPattern)[0];return{source:source.replace(prior,prefix),changes:prior===prefix?0:1};
 }
 const original=source;source=restoreScheduledLabelBuckets(source);
 for(const [old,next]of configuration(source).pairs)source=once(source,old,next);
 source=prefix+source;return{source,changes:source===original?0:1};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const root=process.argv[2]??fileURLToPath(new URL('../',import.meta.url));
 for(const file of scheduledLabelAssets){const path=root+'/dist/assets/'+file,result=patchScheduledLabelBuckets(readFileSync(path,'utf8'));if(result.changes)writeFileSync(path,result.source);console.log(file+': '+result.changes+' exact scheduled label index changes');}
}
