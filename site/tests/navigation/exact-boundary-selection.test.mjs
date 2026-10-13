import test from 'node:test';
import assert from 'node:assert/strict';
import {preserveExactBoundaryGraph} from '../../src/navigation/exact-boundary-selection.js';
const graph={nodes:[{id:'EXC:B3',source_region_id:'EXC'},{id:'ADM:C1'},{id:'KOW:E1',source_region_id:'KOW'}],exc_b3_exact_boundary_join:{},kowloon_exact_boundary_join:{}};
test('EXC preserves its exact area composition in either direction with known area endpoints',()=>{
 const pair=[{node_id:'EXC:B3'},{node_id:'ADM:C1'}];assert.equal(preserveExactBoundaryGraph(graph,pair),true);assert.equal(preserveExactBoundaryGraph(graph,[...pair].reverse()),true);
 assert.equal(preserveExactBoundaryGraph(graph,[pair[0],{lon:114.17,lat:22.28}]),true);
 assert.equal(preserveExactBoundaryGraph(graph,[pair[0],{node_ids:['ADM:C1']}]),true);
});
test('EXC never discards a station-only paid platform or unresolved exact endpoint',()=>{
 for(const missing of [{node_id:'KOW:platform-area:TCL'},{node_id:'unknown'},{node_ids:['ADM:C1','KOW:platform-area:TCL']}]){
  assert.equal(preserveExactBoundaryGraph(graph,[missing,{node_id:'EXC:B3'}]),false);
  assert.equal(preserveExactBoundaryGraph(graph,[{node_id:'EXC:B3'},missing]),false);
 }
});
test('composition markers are required and original KOW selection behavior is unchanged',()=>{
 assert.equal(preserveExactBoundaryGraph({...graph,exc_b3_exact_boundary_join:undefined},[{node_id:'EXC:B3'},{node_id:'ADM:C1'}]),false);
 assert.equal(preserveExactBoundaryGraph(graph,[{node_id:'KOW:E1'},{node_id:'station-only'}]),true);
 assert.equal(preserveExactBoundaryGraph({...graph,kowloon_exact_boundary_join:undefined},[{node_id:'KOW:E1'},{node_id:'ADM:C1'}]),false);
 assert.equal(preserveExactBoundaryGraph(graph,[{node_id:'ADM:C1'},{lon:114.17,lat:22.28}]),false);
});
