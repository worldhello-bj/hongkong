import test from 'node:test';import assert from 'node:assert/strict';
import {scoreParameters,updateScoreParameter,resetScoreParameters,scoreParameterPanel,SCORE_PARAMETER_FIELDS} from '../../src/navigation/score-parameters.js';
import {journeyScore,JOURNEY_WEIGHTS,validatedJourneyWeights} from '../../src/navigation/journey-score.js';
import {rankJourneys} from '../../src/navigation/integrated-navigation.js';
const route=(id,minutes,cost)=>({id,title:id,available:true,minutes,cost,walkMinutes:2,transfers:0,result:{waitMinutes:1,segments:[]}});
test('bounded finite weights, corrupt persistence recovery and reset preserve preset defaults',()=>{
 for(const priority of Object.keys(JOURNEY_WEIGHTS))assert.deepEqual(scoreParameters(undefined,priority),JOURNEY_WEIGHTS[priority]);
 for(const value of ['',NaN,Infinity,-1,10.01])assert.throws(()=>updateScoreParameter({},'time','cost',value));
 const zeros=Object.fromEntries(SCORE_PARAMETER_FIELDS.map(f=>[f.key,0]));assert.throws(()=>validatedJourneyWeights('time',zeros));
 assert.throws(()=>updateScoreParameter({},'unknown','cost',1));assert.throws(()=>updateScoreParameter({},'time','unknown',1));
 const saved=updateScoreParameter({},'time','cost','2.25'),copy=JSON.parse(JSON.stringify(saved));assert.equal(scoreParameters(copy).cost,2.25);
 assert.deepEqual(scoreParameters({time:{cost:null}}),JOURNEY_WEIGHTS.time);
 assert.equal(scoreParameters(resetScoreParameters(saved,'time')).cost,.75);assert.equal(saved.time.cost,2.25,'reset is immutable');
});
test('cached geometry is reused but every adjusted score and winner is recomputed',()=>{
 const publicRoute=route('public',35,5),taxi=route('taxi',10,50),candidates=[publicRoute,taxi];
 const cheapTime={...JOURNEY_WEIGHTS.time,cost:0};assert.equal(rankJourneys(candidates,'time','ordinary',cheapTime)[0],taxi);
 const priceSensitive={...JOURNEY_WEIGHTS.time,cost:2};assert.equal(rankJourneys(candidates,'time','ordinary',priceSensitive)[0],publicRoute);
 const score=journeyScore(taxi,'time','ordinary',priceSensitive);assert.equal(score.terms.cost,100);assert.equal(score.total,Object.values(score.terms).reduce((a,b)=>a+b,0));assert.equal(taxi.minutes,10);assert.equal(taxi.cost,50);
 const blocked={...route('blocked',0,0),available:false};assert.equal(rankJourneys([blocked,publicRoute],'time','accessible',cheapTime)[0],publicRoute,'weights never make an unavailable hard-constrained route available');
 const carrying={...route('carry',1,0),result:{waitMinutes:0,segments:[],luggageCarryRequired:true}};assert.equal(rankJourneys([carrying,publicRoute],'time','luggage',cheapTime)[0],publicRoute);
});
test('compact collapsed panel exposes exact formula, units and route-level production contributions',()=>{
 const html=scoreParameterPanel({choices:[route('<script>',20,7)],escape:s=>s.replaceAll('<','&lt;').replaceAll('>','&gt;')});
 assert.match(html,/全程时间已包含步行、候车/);assert.match(html,/综合分钟 \/ HK\$/);assert.match(html,/data-score-weight="transfers"/);assert.match(html,/价格 5.3/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.doesNotMatch(html,/<details[^>]*\bopen\b/);assert.match(html,/严格无障碍/);
});
