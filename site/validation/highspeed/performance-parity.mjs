/** Run from the repository root: node validation/highspeed/performance-parity.mjs */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createTransitVehicleModel as before} from './transit-vehicles-before.mjs';
import {createTransitVehicleModel as after} from '../../src/navigation/transit-vehicles.js';
globalThis.document={createElement:()=>({relList:{supports:()=>true}})};
const version=JSON.parse(readFileSync('dist/build-meta.json','utf8')).version;
const {b:buildRouter}=await import('../../dist/assets/intermodal-routing-D8vKT-lN.js?v='+version);
const {p:prepare}=await import('../../dist/assets/mobile-navigation-DfEsS_7b.js?v='+version);
const read=path=>{const bytes=readFileSync('dist/'+path);return JSON.parse(path.endsWith('.gz')?gunzipSync(bytes):bytes)};
const network=buildRouter(prepare(read('area/area-graph.json.gz')),read('transit/services.json'),read('transit/walk-links.json.gz'),prepare(read('area/station-graph.json.gz'))).network;
let count=0,seed=71173;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
const dates=['2026-10-12','2026-10-13','2026-10-18','2026-10-11','2026-11-02','2026-10-13'];
const times=[-86400,-220,-50,-0.125,0,0.125,10,650,999.5,1000,1050,1119.999,1120,1220,86399.999,86400,86410,87050,7*86400+50,...Array.from({length:64},()=>rand()*12*86400-3*86400)];
for(const maxVehicles of [0,3,5,160,1000]){const a=before(network,{maxVehicles}),b=after(network,{maxVehicles});for(const date of dates)for(const time of times){assert.deepEqual(b.at(time,date),a.at(time,date),`at ${maxVehicles} ${date} ${time}`);count++;const stop=network.stops[Math.floor(rand()*network.stops.length)].id,options={limit:8,horizonS:[0,300,86400,7*86400][Math.floor(rand()*4)]};assert.deepEqual(b.departures(stop,time,date,options),a.departures(stop,time,date,options),`departures ${stop} ${date} ${time}`);count++;}}
console.log(JSON.stringify({version,equivalentQueries:count,networkPatterns:network.patterns.length,networkStops:network.stops.length,matched:'deepStrictEqual pre-change vs cached model'}));
