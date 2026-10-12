import {performance} from 'node:perf_hooks';
import {createTaxiSimulation} from '../../src/taxi/roaming.js';
const results=[];
for(const fleetSize of [12,24,48]){
 const init=performance.now(),sim=createTaxiSimulation({fleetSize,seed:4200+fleetSize});const initMs=performance.now()-init;
 let t=performance.now();for(let i=0;i<10000;i++)sim.simulateAt(i%250);const sampleMeanMs=(performance.now()-t)/10000;
 t=performance.now();sim.offerQuotes({passengerReadyS:300});const quoteMs=performance.now()-t;
 t=performance.now();sim.offerQuotes({passengerReadyS:305});const cachedQuoteMs=performance.now()-t;
 let maxSegments=0;for(let time=0;time<=14400;time+=300){sim.prepareUntil(time+300);sim.simulateAt(time+300);maxSegments=Math.max(maxSegments,...sim.getCars().map(c=>c.segments.length));}
 results.push({fleetSize,initMs:+initMs.toFixed(2),sampleMeanMs:+sampleMeanMs.toFixed(4),quoteMs:+quoteMs.toFixed(2),cachedQuoteMs:+cachedQuoteMs.toFixed(2),maxSegmentsPerCarDuring4Hours:maxSegments,retainedRange:sim.getPreparedRange()});
}
console.log(JSON.stringify(results,null,2));
