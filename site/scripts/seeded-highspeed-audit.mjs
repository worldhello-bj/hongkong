import {mkdirSync,writeFileSync} from 'node:fs';
import {HIGH_SPEED_STATIONS} from '../src/navigation/highspeed-service.js';
import {planHighSpeedJourney} from '../src/navigation/highspeed-routing.js';
const seed=20261013;let s=seed;const random=()=>{s=(1664525*s+1013904223)>>>0;return s/4294967296;};
const preferences=['ordinary','luggage','escalator','lift'],rows=[];
for(let i=0;i<8;i++){
 const reverse=i%2===1,origin=HIGH_SPEED_STATIONS[reverse?1:0],destination=HIGH_SPEED_STATIONS[reverse?0:1],departureS=Math.floor((5+random()*19)*60)*60;
 const request={origin,destination,departureDate:'2026-10-13',departureS,need:preferences[i%4]};
 const result=await planHighSpeedJourney({request,graph:{nodes:[],edges:[],regions:[]}}),ride=result.timedLegs?.find(l=>l.kind==='highspeed');
 const checks={complete:result.journey?.complete===true,unknownFare:result.pricingUnavailable===true,orderedTimes:result.arrivalS>=departureS&&ride?.arrivalS>ride?.departureS&&ride.departureS>=departureS,noFakeWalkGeometry:!(result.lines??[]).some(l=>['walk','transfer'].includes(l.kind)),identifiedHighSpeedModel:result.highSpeed===true};
 rows.push({origin:origin.id,destination:destination.id,need:request.need,departureS,arrivalS:result.arrivalS,minutes:result.totalMinutes,train:result.highSpeedTrip?.trainCode,waitMinutes:result.waitMinutes,checks,pass:Object.values(checks).every(Boolean)});
}
const out=new URL('../validation/seeded-routes/',import.meta.url);mkdirSync(out,{recursive:true});writeFileSync(new URL('highspeed-sample.json',out),JSON.stringify({seed,method:'Fixed-seed terminal/time procedural model queries; no local walking route claim, no live ticket or exact railway geometry.',rows},null,2)+'\n');
console.log(JSON.stringify({total:rows.length,pass:rows.filter(r=>r.pass).length}));if(rows.some(r=>!r.pass))process.exitCode=1;
