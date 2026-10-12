const root=fileURLToPath(new URL('../../../',import.meta.url));
const runtime=fileURLToPath(new URL('../runtime-2e2fcf795897/',import.meta.url));
const out=fileURLToPath(new URL('./',import.meta.url));
import{fileURLToPath}from'node:url';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const source=readFileSync(runtime+'assets/app-transit-worker-CaCMeUxU.js','utf8');
const get=name=>{const start=source.indexOf(`function ${name}(`);const end=source.indexOf('function ',start+9);return source.slice(start,end)};
const api=Function('Mt','__hkPreferenceCost',get('kt')+get('rt')+'return {kt,rt};')({},(_edge,duration)=>duration);
const Q=x=>Number((x/60).toFixed(6))*60;
const CAP=2**30;
const lower=arc=>{const q=api.kt(arc.edge);const d=(arc.edge.duration_s-(q?.wait??0))*arc.fraction;assert.ok(Number.isFinite(d)&&d>=0);return Math.min(CAP,Math.floor(d));};
const edge={kind:'lift',region_id:'R',lift_ride_id:'L',lift_wait_s:45,duration_s:48};
const a={edge,fraction:1};const first=api.rt(a,'','fast'),second=api.rt(a,first.ride,'fast');
assert.equal(first.duration,48);assert.equal(second.duration,3);assert.equal(lower(a),3);
const D=lower(a)+lower(a);assert.ok(Q(D)<=Q(first.duration+second.duration));
assert.equal(Q(2),1.99998);assert.equal(Math.floor(Q(2)),1);
for(const fraction of [0,.000001,.25,.9999999999999999,1]){
 const arc={edge,fraction};for(const previous of ['',first.ride])assert.ok(lower(arc)<=api.rt(arc,previous,'fast').duration);
}
const edge2={kind:'walk',duration_s:2};assert.equal(lower({edge:edge2,fraction:1}),2);
console.log(JSON.stringify({source:'production rt/kt in memory',lift:{first:first.duration,continuing:second.duration,integerEach:lower(a)},rounding:{inner:2,outer:Q(2),integerOuter:Math.floor(Q(2))},fractionalCases:5}));
