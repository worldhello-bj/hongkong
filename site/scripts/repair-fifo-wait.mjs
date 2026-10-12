import {readFile,writeFile} from 'node:fs/promises';
const helper=(await readFile(new URL('../src/navigation/fifo-wait.js',import.meta.url),'utf8')).replace('export function earliestOpenWait','function __hkEarliestOpenWait');
for(const file of ['app-walk-worker-jk5g-BMr.js','mobile-navigation-DfEsS_7b.js','metro-worker-BDEusPKL.js','app-transit-worker-CaCMeUxU.js']){
 const url=new URL('../dist/assets/'+file,import.meta.url);let s=await readFile(url,'utf8');if(s.includes('HK_FIFO_WAIT_V1')){s=s.replace(/if\(([\w$]+)\)continue;let ([\w$]+)=([\w$]+)\.get\(([\w$]+)\);/g,'if($1&&!hkFifoWaiting)continue;let $2=$3.get($4);');await writeFile(url,s);continue;}
 const head=s.match(/const ([\w$]+)=\[\.\.\.([\w$]+)\.edges,([\w$]+)\.origin,\3\.destination\],([\w$]+)=([^;]+);let ([\w$]+)=0;/);
 if(!head)throw Error('Missing scheduled search header '+file);
 const [,list,graph,request,timeMode,,lastOpening]=head;
 s=s.replace(head[0],`const hkFifoWaiting=${request}.preference==="fast"&&${graph}.nodes.every(node=>node.waiting_allowed!==false&&node.wait_allowed!==false)&&${graph}.edges.every(edge=>edge.waiting_allowed!==false&&edge.wait_allowed!==false);`+head[0]);
 const opening=s.match(new RegExp(`if\\(${timeMode}\\)for\\(const ([\\w$]+) of ${list}\\)for\\(const ([\\w$]+) of ([\\w$]+)\\([^;]+?${lastOpening}=Math.max\\(${lastOpening},\\2\\);`));
 if(!opening)throw Error('Missing opening scan '+file);const openFn=opening[3];s=s.replace(opening[0],opening[0]+`if(hkFifoWaiting)${lastOpening}=0;`);
 const expansion=s.match(/const ([\w$]+)=([\w$]+)\(([\w$]+),([\w$]+),([\w$]+)\.preference\);if\(!([\w$]+)\(\3\.edge,\5\.departureS===void 0\?void 0:\5\.departureS\+\(([\w$]+)\.elapsed\?\?0\),([\w$]+)\.duration,\5\.departureDate\)\|\|\3\.to===([\w$]+)&&!\6\(\5\.destination,[^;]+?\)\)continue;/);
 if(!expansion)throw Error('Missing relaxation '+file);
 const [,metric,metricFn,arc,ride,req,valid,label,,target]=expansion;
 const originalCheck=expansion[0].slice(expansion[0].indexOf('if('));
 s=s.replace(expansion[0],`const ${metric}=${metricFn}(${arc},${ride},${req}.preference);let hkWait=0;if(hkFifoWaiting&&${timeMode}&&${req}.departureS!==void 0){hkWait=__hkEarliestOpenWait({edge:${arc}.edge,destination:${arc}.to===${target}?${req}.destination:null,arrivalS:${req}.departureS+(${label}.elapsed??0),durationS:${metric}.duration,date:${req}.departureDate,horizonS:14400-(${label}.elapsed??0),canTraverse:${valid},openingTimes:${openFn}});if(hkWait===null)continue;}else ${originalCheck}`);
 s=s.replace(`cost:${label}.cost+(${arc}.accessSide?0:${metric}.cost),elapsed:(${label}.elapsed??0)+${metric}.duration`, `cost:${label}.cost+(${arc}.accessSide?0:${metric}.cost)+hkWait,elapsed:(${label}.elapsed??0)+${metric}.duration+hkWait`);
 s=s.replace(`{arc:${arc},from:${label}.id}`,`{arc:hkWait?{...${arc},hkWait}:${arc},from:${label}.id}`);
 const reconstruct=s.match(/for\(const ([\w$]+) of ([\w$]+)\)\{const ([\w$]+)=([\w$]+)\(\1,([\w$]+),([\w$]+)\.preference\);\5=\1.accessSide\?"":\3.ride;const ([\w$]+)=\1.edge,([\w$]+)=\3.duration,([\w$]+)=[^;]+;if\(([\w$]+)\+=\8,/);
 if(!reconstruct)throw Error('Missing reconstruction '+file);
 const [whole,step,,,fn,prev,rq,edge,duration,dist,total]=reconstruct;
 const preceding=s.slice(0,reconstruct.index);const legs=preceding.match(/const ([\w$]+)=\[\],([\w$]+)=\[\];let [\w$]+=0,[\w$]+=0,[\w$]+="";$/)?.[2];if(!legs)throw Error('Missing legs '+file);
 const insert=`if(${step}.hkWait){${total}+=${step}.hkWait;${legs}.push({kind:"wait",label:"等候通道开放",minutes:0,seconds:${step}.hkWait,raw_distance:0,geometry_mode:"official",edge_ids:[],source_id:"MODELED-OPENING-WAIT"});}`;
 const pos=reconstruct.index+whole.lastIndexOf('if(');s=s.slice(0,pos)+insert+s.slice(pos);
 s=s.replace(/if\(([\w$]+)\)continue;let ([\w$]+)=([\w$]+)\.get\(([\w$]+)\);/g,'if($1&&!hkFifoWaiting)continue;let $2=$3.get($4);');
 s='/* HK_FIFO_WAIT_V1 */\n'+helper+'\n'+s;
 await writeFile(url,s);console.log('Enabled FIFO opening waits:',file);
}
