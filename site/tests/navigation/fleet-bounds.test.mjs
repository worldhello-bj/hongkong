import test from 'node:test';import assert from 'node:assert/strict';
import {createTaxiSimulation,ROAD_GRAPH,nearestRoadNode} from '../../src/taxi/roaming.js';
import {FLEET_DEMO_BOUNDS,insideBounds} from '../../src/navigation/taxi-map.js';
const background=[114.13,22.255,114.215,22.3346603];
test('seed42 fleet and complete synthetic polylines stay inside display at0,10min,1h',()=>{
 const nowS=39600,sim=createTaxiSimulation({seed:42,fleetSize:48,nowS,roamingBounds:FLEET_DEMO_BOUNDS});
 for(const elapsed of [0,600,3600]){
  sim.prepareUntil(nowS+elapsed+300);const cars=sim.simulateAt(nowS+elapsed);
  assert.equal(cars.length,48);assert.equal(cars.filter(car=>!insideBounds(car.position,FLEET_DEMO_BOUNDS)).length,0,'showcase '+elapsed);
  assert.equal(cars.filter(car=>!insideBounds(car.position,background)).length,0,'background '+elapsed);
  for(const car of sim.getCars())for(const segment of car.segments){
   if(!['roaming','existingorder'].includes(segment.state))continue;
   const edge=ROAD_GRAPH.edges[segment.edgeId],geometry=edge?.geometry??[ROAD_GRAPH.nodes[segment.fromId],ROAD_GRAPH.nodes[segment.toId]];
   for(const coordinate of geometry)assert.ok(insideBounds(coordinate,FLEET_DEMO_BOUNDS),car.id+' '+segment.state+' full polyline');
  }
 }
});
test('requested trip outside fleet showcase retains full route and continuous dropoff',()=>{
 const nowS=39600,sim=createTaxiSimulation({seed:42,fleetSize:48,nowS,roamingBounds:FLEET_DEMO_BOUNDS});
 const pickup=nearestRoadNode([114.15848,22.28441]),destination=nearestRoadNode([114.232,22.310]);
 assert.equal(destination.covered,true);assert.equal(insideBounds(destination.coordinate,FLEET_DEMO_BOUNDS),false);
 const quote=sim.offerQuotes({pickup,destination,passengerReadyS:nowS+60,nowS})[0];assert.ok(quote);
 sim.reserveQuote(quote.id);sim.prepareUntil(quote.dropoffS+60);
 const car=sim.simulateAt(quote.dropoffS+1).find(car=>car.id===quote.carId),last=quote.passengerRoute.geometry.at(-1);
 assert.ok(Math.hypot(car.position[0]-last[0],car.position[1]-last[1])<1e-8);
 assert.ok(quote.passengerRoute.geometry.some(point=>!insideBounds(point,FLEET_DEMO_BOUNDS)));
});
