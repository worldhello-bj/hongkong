import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {STATIONS,validStation,parseNavigationLocation,navigationUrl} from '../../src/navigation/ui-navigation.js';
import {PACIFIC_PLACE_BUILDING_ID,buildPacificPlaceModel,pacificPlaceModelSvg} from '../../src/navigation/pacific-place-model.js';
const source=readFileSync(new URL('../../src/navigation/main.recovered.js',import.meta.url),'utf8');
const start=source.indexOf('function resolveInspectionTarget('),end=source.indexOf('function updateInspectionLabel(',start);
assert.ok(start>=0&&end>start);
const resolveInspectionTarget=new Function('STATIONS','PACIFIC_PLACE_BUILDING_ID','return '+source.slice(start,end))(STATIONS,PACIFIC_PLACE_BUILDING_ID);
const block=JSON.parse(gunzipSync(readFileSync(new URL('../../dist/area/admiralty-block-graph.json.gz',import.meta.url))));
const station=JSON.parse(gunzipSync(readFileSync(new URL('../../dist/area/station-graph.json.gz',import.meta.url))));
const mallEdge=block.edges.find(edge=>edge.building_id===PACIFIC_PLACE_BUILDING_ID&&edge.id.endsWith(':r'));
const outdoor=block.edges.find(edge=>!edge.building_id&&edge.source_id==='CSDI-PEDESTRIAN');
const adm=station.edges.find(edge=>edge.region_id==='ADM'&&edge.source_id==='CSDI-INDOOR');
const huh=station.edges.find(edge=>edge.region_id==='HUH'&&edge.source_id==='CSDI-INDOOR');
const guidance=edges=>({guidance:{edge_ids:edges.map(edge=>edge.id),geometry_mode:'official',geometry:{type:'LineString',coordinates:edges.flatMap(edge=>edge.coordinates)}}});

test('exact mall edge IDs resolve from block overlay even when journey graph omits building metadata',()=>{
  const step=guidance([mallEdge]);
  for(const graph of [{edges:[]},{edges:[{...mallEdge,building_id:undefined}]}]){
    const target=resolveInspectionTarget(step,graph,block);
    assert.equal(target.stage,'mall');assert.equal(target.mixed,false);assert.equal(target.geometry,step.guidance.geometry);
    assert.ok(target.focusIds.includes(mallEdge.id));assert.ok(target.focusIds.includes(mallEdge.physical_id));
  }
  const model=buildPacificPlaceModel(block),svg=pacificPlaceModelSvg(model,{highlight:resolveInspectionTarget(step,{edges:[]},block).focusIds});
  assert.match(svg,/<polyline[^>]+stroke="#fff"/,'reverse route edge highlights retained physical model edge');
});

test('journey-owned source mall edge works without block lookup; nearby or named points cannot trigger mall',()=>{
  assert.equal(resolveInspectionTarget(guidance([mallEdge]),{edges:[mallEdge]},undefined).stage,'mall');
  assert.equal(resolveInspectionTarget(guidance([outdoor]),{edges:[outdoor]},block),null);
  assert.equal(resolveInspectionTarget({name:'太古广场',guidance:{edge_ids:['missing'],geometry_mode:'official',geometry:guidance([mallEdge]).guidance.geometry}},{edges:[]},block),null);
  assert.equal(resolveInspectionTarget({guidance:{}},{edges:[mallEdge]},block),null);
});

test('mixed mall/station/outdoor instruction highlights only source mall edges and never projects whole mixed geometry',()=>{
  const step=guidance([adm,outdoor,mallEdge]);
  const target=resolveInspectionTarget(step,{edges:[adm,outdoor]},block);
  assert.equal(target.stage,'mall');assert.equal(target.mixed,true);assert.equal(target.geometry,null);
  assert.ok(target.focusIds.includes(mallEdge.physical_id));assert.ok(!target.focusIds.includes(adm.id));assert.ok(!target.focusIds.includes(outdoor.id));
  const unresolved=resolveInspectionTarget({...step,guidance:{...step.guidance,edge_ids:[mallEdge.id,'missing']}},{edges:[]},block);
  assert.equal(unresolved.mixed,true);assert.equal(unresolved.geometry,null);
});

test('ordinary indoor railway instructions keep their actual station and mixed stations do not share geometry',()=>{
  for(const edge of [adm,huh]){const step=guidance([edge]),target=resolveInspectionTarget(step,{edges:[edge]},block);assert.equal(target.stage,'station');assert.equal(target.station,edge.region_id);assert.deepEqual(target.focusIds,[edge.id]);assert.equal(target.geometry,step.guidance.geometry)}
  const target=resolveInspectionTarget(guidance([huh,adm]),{edges:[huh,adm]},block);
  assert.equal(target.station,'HUH');assert.equal(target.mixed,true);assert.equal(target.geometry,null);assert.deepEqual(target.focusIds,[huh.id]);
});

test('actual 10:00 Tamar to Pacific Place L2 instruction selects mall without changing source graphs',{timeout:15000},async()=>{
  globalThis.document={createElement:()=>({relList:{supports:()=>true}})};
  const engine=await import('../../dist/assets/mobile-navigation-DfEsS_7b.js');
  const ready=engine.p(block),place=block.places.find(p=>p.id==='pacific-place'),park=block.places.find(p=>p.id==='tamar-park'),floor=place.floors.find(f=>f.name==='L2');
  const endpoint=(p,ids)=>({...p,lon:p.coordinates[0],lat:p.coordinates[1],node_ids:ids.map(id=>block.portals.find(p=>p.id===id).node_id)});
  const route=engine.d(ready,{origin:endpoint(park,park.entrance_ids),destination:endpoint(place,floor.entrance_ids),preference:'fast',mode:'walk',departureS:36000,departureDate:'2026-10-12'});
  assert.equal(route.status,'CONDITIONAL');
  const journey=engine.a(ready,route,'添马公园 → 太古广场 L2');assert.equal(journey.complete,true);
  const byId=new Map(block.edges.map(edge=>[edge.id,edge]));
  const steps=journey.steps.filter(step=>step.guidance?.edge_ids?.some(id=>byId.get(id)?.building_id===PACIFIC_PLACE_BUILDING_ID));
  assert.ok(steps.length>0);
  assert.equal(resolveInspectionTarget(journey.steps[8],journey.graph,block)?.stage,'mall','the reported ninth instruction targets Pacific Place, not ADM station');
  for(const step of steps){const result=resolveInspectionTarget(step,journey.graph,block);assert.equal(result.stage,'mall');assert.ok(result.focusIds.length>0)}
  console.log('Actual source route:',journey.steps.length,'instructions;',steps.length,'exact mall-source instructions resolved');
});

// Every source-backed rail model must be reachable from the shared UI registry.
test('all bundled official station models are selectable and preserve deep links',()=>{
  const coverage=JSON.parse(readFileSync(new URL('../../dist/preview/station-model-coverage.json',import.meta.url)));
  for(const [id,model] of Object.entries(coverage.rail)){
    assert(STATIONS.some(station=>station.id===id),`${id} source model is missing from the UI registry`);
    assert.equal(validStation(id),id);
    assert.equal(parseNavigationLocation({hash:`#station?station=${id}`}).station,id);
    assert.equal(parseNavigationLocation({pathname:'/metro.html',search:`?station=${id}`}).station,id);
    assert.equal(navigationUrl({stage:'station',station:id}),`/#station?station=${id}`);
    assert(model.levelCount>0);
  }
});

test('every station source route can inspect its own exact 3D edges, including East Tsim Sha Tsui',()=>{
  const regions=[...new Set(station.edges.filter(edge=>edge.source_id==='CSDI-INDOOR').map(edge=>edge.region_id))];
  assert(regions.includes('ETS'));
  for(const region of regions){
    for(const kind of ['walk','lift','escalator']){
      const edge=station.edges.find(edge=>edge.region_id===region&&edge.source_id==='CSDI-INDOOR'&&edge.kind===kind);
      assert(edge,`${region} missing expected source ${kind}`);
      const step=guidance([edge]),target=resolveInspectionTarget(step,{edges:[edge]},block);
      assert.equal(target?.stage,'station');
      assert.equal(target.station,region);
      assert.deepEqual(target.focusIds,[edge.id]);
      assert.equal(target.geometry,step.guidance.geometry);
    }
  }
});
