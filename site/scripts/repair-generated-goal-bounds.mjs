// Experimental only: intentionally absent from build-navigation.mjs.
import{readFileSync}from'node:fs';import{pathToFileURL}from'node:url';
export const generatedGoalAssets=['app-transit-worker-CaCMeUxU.js','intermodal-routing-D8vKT-lN.js'];
const helper=readFileSync(new URL('../src/navigation/generated-goal-bounds.js',import.meta.url),'utf8').replace('export function createGeneratedGoalBounds','function __hkCreateGeneratedGoalBounds');
const prefix='/* HK_EXPERIMENTAL_GENERATED_GOAL_V1 */\n'+helper+'\n/* END_HK_EXPERIMENTAL_GENERATED_GOAL_V1 */\n';
const pattern=/\/\* HK_EXPERIMENTAL_GENERATED_GOAL_V1 \*\/\n[\s\S]*?\/\* END_HK_EXPERIMENTAL_GENERATED_GOAL_V1 \*\/\n/;
const configurations=[
 {anchor:'function Dt(t,e){',pairs:[['const P=(h,I,k,A,w,Y=0)=>{','const hkGoalBound=__hkCreateGeneratedGoalBounds({connections:J,patterns:j,target:n,departureS:s,horizonEndS:f,walkPenalty:r,transferPenaltyS:d,score:M,resolveConnectionAt:e.resolveConnectionAt,validPoint:Pe});const P=(h,I,k,A,w,Y=0)=>{'],['S.push(i)};let B;','S.push(i),hkGoalBound?.observe(i)};let B;'],['h.settled=!0;const I=h.node,k=h.time;','h.settled=!0;if(hkGoalBound?.reject(h))continue;const I=h.node,k=h.time;']]},
 {anchor:'function Xe(o,r){',pairs:[['const x=(f,v,A,k,h,oe=0)=>{','const hkGoalBound=__hkCreateGeneratedGoalBounds({connections:Z,patterns:W,target:t,departureS:n,horizonEndS:l,walkPenalty:u,transferPenaltyS:p,score:b,resolveConnectionAt:r.resolveConnectionAt,validPoint:Ie});const x=(f,v,A,k,h,oe=0)=>{'],['P.push(e)};let F;','P.push(e),hkGoalBound?.observe(e)};let F;'],['f.settled=!0;const v=f.node,A=f.time;','f.settled=!0;if(hkGoalBound?.reject(f))continue;const v=f.node,A=f.time;']]}
];
function configuration(source){const found=configurations.filter(c=>source.includes(c.anchor));if(found.length!==1)throw Error('Generated-goal engine anchor drift');return found[0];}
function once(source,old,next){if(source.split(old).length!==2)throw Error('Generated-goal patch anchor drift: '+old);return source.replace(old,next);}
export function restoreGeneratedGoalBounds(source){if(!source.includes('HK_EXPERIMENTAL_GENERATED_GOAL_V1'))return source;const old=source.match(pattern)?.[0];if(!old)throw Error('Generated-goal helper marker drift');source=source.replace(old,'');for(const [before,after]of configuration(source).pairs)source=once(source,after,before);return source;}
export function patchGeneratedGoalBounds(source){
 if(source.includes('HK_EXPERIMENTAL_GENERATED_GOAL_V1')){restoreGeneratedGoalBounds(source);const old=source.match(pattern)[0];return{source:source.replace(old,prefix),changes:old===prefix?0:1};}
 const old=source;for(const [before,after]of configuration(source).pairs)source=once(source,before,after);source=prefix+source;return{source,changes:source===old?0:1};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 throw Error('Reproduction experiment only. Import the in-memory transforms from its test; never write a production runtime.');
}
