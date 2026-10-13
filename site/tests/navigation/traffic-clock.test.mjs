import test from 'node:test';import assert from 'node:assert/strict';
import {createTrafficClock} from '../../src/navigation/traffic-clock.js';
test('shared clock advances at declared speed only while foreground',()=>{const c=createTrafficClock();c.tick(100);assert.equal(c.tick(200),28801);c.tick(10000,false);c.tick(20000);assert.equal(c.timeS,28801);assert.equal(c.tick(20100),28802);});
test('clock pauses, steps, resets without background catch-up or long-frame leap',()=>{const c=createTrafficClock();c.tick(0);assert.equal(c.tick(10000),28802.5);c.play(false);c.tick(20000);assert.equal(c.step(),28862.5);c.reset(39600);c.play(true);c.tick(50000);assert.equal(c.tick(50100),39601);});
test('one clock owns Hong Kong date, displayed time, service time and order epoch',()=>{
 const c=createTrafficClock({date:'2026-10-13',timeS:28800,playing:false});
 const now=c.snapshot();assert.equal(now.departureDate,'2026-10-13');assert.equal(now.departureS,28800);assert.equal(now.date,'2026-10-13');assert.equal(now.time,'08:00:00');assert.equal(now.epochMs,Date.parse('2026-10-13T08:00:00+08:00'));assert.ok(Object.isFrozen(now));
 c.step(61);assert.equal(c.time,'08:01:01');assert.equal(c.snapshot().epochMs-now.epochMs,61000);assert.equal(now.time,'08:00:00','plan snapshots cannot drift with global clock');
});
test('seek atomically changes the global clock, pauses and rejects older async revision tokens',()=>{
 let c;const observed=[];c=createTrafficClock({date:'2026-10-13',timeS:28800,onSeek:snapshot=>observed.push({snapshot,actual:c.snapshot()})});
 const token=c.snapshot().revision;c.tick(0);c.tick(100);
 const next=c.seek({date:'2026-10-14',timeS:36005});
 assert.equal(next.revision,token+1);assert.equal(c.date,'2026-10-14');assert.equal(c.time,'10:00:05');assert.equal(c.playing,false);assert.notEqual(token,c.revision,'late consumers must reject the previous generation');assert.deepEqual(observed[0].snapshot,observed[0].actual);
 c.tick(100000);assert.deepEqual(c.snapshot(),next);c.seek({date:'2026-10-14',timeS:36005});assert.equal(c.revision,token+2,'same time seek creates a fresh scenario instance');
});
test('midnight changes displayed date without rewinding the continuous vehicle timeline',()=>{
 const c=createTrafficClock({date:'2026-12-31',timeS:86399,playing:false});c.step(2);
 assert.equal(c.date,'2027-01-01');assert.equal(c.time,'00:00:01');assert.equal(c.timeS,86401);assert.equal(c.baseDate,'2026-12-31');assert.equal(c.snapshot().timeOfDayS,1);assert.equal(c.epochMs,Date.parse('2027-01-01T00:00:01+08:00'));
 c.seek({date:c.date,timeS:c.snapshot().timeOfDayS});assert.equal(c.timeS,1);assert.equal(c.baseDate,'2027-01-01');assert.equal(c.epochMs,Date.parse('2027-01-01T00:00:01+08:00'));
});
test('invalid global date/time selections leave the current state intact',()=>{
 const c=createTrafficClock({date:'2026-10-13',timeS:28800});const before=c.snapshot();
 for(const value of [{date:'2026-02-30',timeS:0},{date:'2026-10-13',timeS:NaN},{date:'2026-10-13',timeS:-1},{date:'2026-10-13',timeS:86400}]){assert.throws(()=>c.seek(value));assert.deepEqual(c.snapshot(),before);}
 assert.throws(()=>c.reset(Infinity));assert.deepEqual(c.snapshot(),before);
});
test('pause stops every derived consumer and resume has no wall-clock catch-up',()=>{
 const c=createTrafficClock({date:'2026-10-13',timeS:28800});c.tick(100);c.tick(200);c.play(false);
 const paused=c.snapshot();c.tick(100000);assert.deepEqual(c.snapshot(),paused);c.play(true);c.tick(200000);assert.equal(c.timeS,paused.departureS);c.tick(200100);assert.equal(c.timeS,paused.departureS+1);
});
test('application has one live clock and no independent departure or taxi playback controls',async()=>{
 const {readFile}=await import('node:fs/promises');const source=await readFile(new URL('../../src/navigation/main.recovered.js',import.meta.url),'utf8');
 assert.equal((source.match(/createTrafficClock\(/g)||[]).length,1);
 assert.doesNotMatch(source,/\b(?:w1|c1|taxiClockS|taxiPlaying|trafficInputKey)\b/);
 assert.doesNotMatch(source,/data-action="taxi-(?:play|step)"|模拟起始时间/);
 assert.match(source,/now:\(\)=>trafficClock\.epochMs/);
 assert.match(source,/dateInput\.value=trafficClock\.date/);assert.match(source,/timeInput\.value=trafficClock\.time/);
});
