/** Run from repo root: node validation/playback-ci/timer-reproduction.mjs */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTrafficClock} from '../../src/navigation/traffic-clock.js';
const stall=()=>{const until=performance.now()+500;while(performance.now()<until){}};
async function reproduce(conditionDriven){
 const clock=createTrafficClock({date:'2026-10-13',timeS:29040,playing:false});let ticks=0;
 const interval=setInterval(()=>{ticks++;clock.tick(performance.now(),true)},100);
 try{
  clock.play(true);
  if(!conditionDriven){const paused=new Promise(resolve=>setTimeout(()=>{clock.play(false);resolve()},350));stall();await paused;assert.equal(ticks,1);assert.equal(clock.timeS,29040);}
  else{stall();const deadline=performance.now()+2000;while(clock.timeS<=29040&&performance.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));assert.ok(clock.timeS>29040,'condition-driven test still requires real playback');clock.play(false);assert.ok(ticks>=2);}
  return {conditionDriven,ticks,timeS:clock.timeS,playing:clock.playing};
 }finally{clearInterval(interval);}
}
console.log(JSON.stringify({runtime:JSON.parse(readFileSync('dist/build-meta.json')).version,intervalMs:100,eventLoopStallMs:500,fixedPauseMs:350,oldFixedSleep:await reproduce(false),conditionDriven:await reproduce(true)},null,2));
