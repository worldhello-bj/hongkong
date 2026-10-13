/** Expose the exact built engine predicate for audit; no routing or algorithm edits. */
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {digest} from './point-matrix-fixture.mjs';
export async function loadPointSourceEligibility(runtimeRoot){
 const file=resolve(runtimeRoot,'assets/mobile-navigation-DfEsS_7b.js'),original=readFileSync(file,'utf8');
 if(!original.includes('function re(e,r)')||!original.includes('A2 as v'))throw Error('Built source eligibility symbols changed; review audit binding before routing.');
 const rewritten=original.replace(/from\s*["'](\.\.?\/[^"']+)["']/g,(_,p)=>'from '+JSON.stringify(new URL(p,pathToFileURL(file)).href));
 const module=await import('data:text/javascript;base64,'+Buffer.from(rewritten+'\nexport {re as pointSourceEdgeAllowed};').toString('base64'));
 return {allows:edge=>module.pointSourceEdgeAllowed(edge,'accessible'),scheduleValid:module.v,provenance:{file:'assets/mobile-navigation-DfEsS_7b.js',sha256:digest(readFileSync(file)),method:'Original built module with only an audit export; exact source edge eligibility predicate and source schedule validator.'}};
}
const forbiddenKinds=new Set(['stairs','escalator','stairlift','travelator','rail','transfer','station_access','access_connector']);
export function strictSourceFailureReasons(edge,eligibility){
 if(!eligibility?.allows||!eligibility?.scheduleValid)return ['strict-engine-predicate-not-loaded'];
 if(eligibility.allows(edge))return [];
 const reasons=[];
 if(edge.disabled)reasons.push('disabled');
 if(edge.access_time_id!=null&&!eligibility.scheduleValid(edge))reasons.push('source-opening-rule-invalid-or-unparsed');
 if(edge.accessible_eligible!==true)reasons.push('source-not-explicitly-accessible-eligible');
 if(forbiddenKinds.has(edge.kind))reasons.push('strict-engine-forbidden-kind');
 if(edge.geometry_mode==='official'&&edge.wheelchair_barrier!==2)reasons.push('official-wheelchair-barrier-not-2');
 return reasons.length?reasons:['strict-engine-rejected-other-condition'];
}
