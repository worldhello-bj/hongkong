import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {canonicalStationEndpoint} from '../../src/navigation/station-identity.js';
import {patchStationIdentity} from '../../scripts/repair-station-identity.mjs';
const read=name=>JSON.parse(gunzipSync(fs.readFileSync(new URL('../../dist/area/'+name+'.json.gz',import.meta.url))));
const area=read('area-graph'), station=read('station-graph'), map=new Map(area.portals.map(p=>[p.id,p]));
test('HUH A3 same official amenity canonicalizes obsolete area anchor',()=>{
 assert.equal(map.get('HUH:portal:A3').node_id,'AUS:N:0a4bf0c0290473');
 assert.equal(canonicalStationEndpoint('HUH:portal:A3',map,station),'HUH:N:0fe5b92f02be54');
 assert.equal(map.get('HUH:portal:A3').network_association.distance_m,14.299);
 assert.equal(map.get('HUH:portal:A3').network_association.access_evidence,'UNVERIFIED');
});
test('different feature, station, source height, nearby node and absent identity are not conflated',()=>{
 const original=map.get('HUH:portal:A3').node_id;
 for(const mutate of [p=>p.source_feature_id+='-other',p=>p.station_id='AUS',p=>p.source_coordinates[2]+=1,p=>delete p.source_feature_id,p=>p.source_coordinates[0]+=.00001]){
  const copy=structuredClone(station);mutate(copy.portals.find(p=>p.id==='HUH:portal:A3'));
  assert.equal(canonicalStationEndpoint('HUH:portal:A3',map,copy),original);
 }
 const copy=structuredClone(station);copy.nodes.find(n=>n.id==='HUH:N:0fe5b92f02be54').coordinates[0]+=.00001;
 assert.equal(canonicalStationEndpoint('HUH:portal:A3',map,copy),original);
 assert.equal(canonicalStationEndpoint('UNKNOWN',map,station),'UNKNOWN');
});
test('bundle patches are narrow, idempotent and fail closed on anchor drift',()=>{
 for(const [name,worker] of [['intermodal-routing-D8vKT-lN.js',false],['app-transit-worker-CaCMeUxU.js',true]]){
  const source=fs.readFileSync(new URL('../../dist/assets/'+name,import.meta.url),'utf8');
  const patched=patchStationIdentity(source,worker); assert.equal(patchStationIdentity(patched,worker),patched);
  assert.ok(patched.includes('canonicalStationEndpoint('));
 }
 assert.throws(()=>patchStationIdentity('changed'),/anchor drift/);
});

test('exact HUH B2 lift and D6 can search existing A3 stop via station graph',async()=>{
 const {stationOutdoorCandidates}=await import('../../src/navigation/station-identity.js');
 for(const id of ['HUH:portal:B2-lift','HUH:portal:D6']){
  const point=station.portals.find(p=>p.id===id);
  assert.ok(stationOutdoorCandidates(point,map,station).some(p=>p.id==='HUH:portal:A3'));
 }
 assert.deepEqual(stationOutdoorCandidates({coordinates:[114.18,22.3]},map,station),[]);
});
