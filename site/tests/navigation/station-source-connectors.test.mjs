import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {stationSourceConnectors,sourceConnectorPanel,inspectSourceConnector,renderSourceConnectorHost} from '../../src/navigation/station-source-connectors.js';
const graph=JSON.parse(gunzipSync(readFileSync(new URL('../../dist/area/station-graph.json.gz',import.meta.url))));
const source=readFileSync(new URL('../../src/navigation/main.recovered.js',import.meta.url),'utf8');

test('every official station exposes exact deduplicated cross-level facilities without mutation',()=>{
 const before=JSON.stringify(graph);
 for(const station of ['ADM','EXC','HUH','ETS','AUS','KOW']){
  const items=stationSourceConnectors(graph,station);assert(items.length>0);
  assert.equal(new Set(items.map(item=>item.physicalId)).size,items.length);
  for(const item of items){assert(graph.edges.includes(item.edge));assert.equal(item.edge.region_id,station);assert(Math.abs(item.to-item.from)>=.4);}
 }
 assert.equal(JSON.stringify(graph),before);
 assert.deepEqual(stationSourceConnectors(graph,'HSR:WEK'),[]);
});

test('disabled, schematic, malformed, same-level and unrelated edges never become facility connections',()=>{
 const edge=stationSourceConnectors(graph,'ETS')[0].edge;
 for(const change of [{disabled:true},{geometry_mode:'schematic'},{source_id:'modeled'},{region_id:'ADM'},{coordinates:[[1,2],[1,2,3]]},{coordinates:[[1,2,0],[1,2,0]]},{coordinates:[[1,2,0],[1,2,NaN]]}])assert.deepEqual(stationSourceConnectors({edges:[{...edge,...change}]},'ETS'),[]);
});

test('floor and type filters show original source segments and empty states without guessing alternatives',()=>{
 const items=stationSourceConnectors(graph,'ETS'),item=items.find(item=>item.kind==='lift');assert(item);
 const html=sourceConnectorPanel(graph,'ETS',{floor:String(item.from),kind:'lift',edgeId:item.id});
 assert(html.includes(`value="${item.id}" selected`));assert.match(html,/来源高程/);assert.match(html,/不等于设备台数/);
 assert.match(sourceConnectorPanel(graph,'ETS',{floor:'99999'}),/当前筛选无来源换层路段/);
 assert.equal(sourceConnectorPanel(graph,'HSR:FUT'), '');
 assert.doesNotMatch(sourceConnectorPanel(graph,'ETS',{edgeId:'<img onerror=alert(1)>'}),/<img/);
});

test('selection invokes only the exact authorized station source edge and reports renderer failure',()=>{
 const item=stationSourceConnectors(graph,'ETS')[0],calls=[];
 const model={focusSourceEdge(id){calls.push(id);return true;}};
 assert.equal(inspectSourceConnector(graph,'ETS',item.id,model),true);assert.deepEqual(calls,[item.id]);
 assert.equal(inspectSourceConnector(graph,'ADM',item.id,model),false);
 assert.equal(inspectSourceConnector(graph,'ETS','missing',model),false);
 assert.equal(inspectSourceConnector(graph,'ETS',item.id,{}),false);
 assert.equal(inspectSourceConnector(graph,'ETS',item.id,{focusSourceEdge:()=>false}),false);
 assert.deepEqual(calls,[item.id]);
});

test('source connector renderer locks exact station and geometry rather than nearest overlapping region',()=>{
 const bundle=readFileSync(new URL('../../dist/assets/mobile-navigation-DfEsS_7b.js',import.meta.url),'utf8');
 const start=bundle.indexOf('focusSourceEdge(id){'),end=bundle.indexOf(',showStationExample(s){',start);
 assert(start>0&&end>start);
 const item=stationSourceConnectors(graph,'ETS')[0], calls=[];
 const c1=new Map(graph.edges.map(edge=>[edge.id,edge])),host={dataset:{}},caption={};
 const method=new Function('c1','r','ge','d2','Ze','a','e','i1',`let l=true,_=0; const focus=({${bundle.slice(start,end)}}).focusSourceEdge; return Object.assign(focus,{revision:()=>_});`)(c1,graph,()=>calls.push('clear'),station=>calls.push(station),geometry=>calls.push(geometry),caption,host,()=>calls.push('draw'));
 assert.equal(method.revision(),0);assert.equal(method(item.id),true);assert.equal(method.revision(),1);assert.equal(calls[1],'ETS');assert.equal(calls[2].coordinates,item.edge.coordinates);assert.equal(host.dataset.sourceInspectionEdge,item.id);assert.equal(host.dataset.sourceInspectionStation,'ETS');
 const length=calls.length;assert.equal(method('unknown'),false);assert.equal(method.revision(),1);assert.equal(calls.length,length);
 assert(source.includes('renderSourceConnectorPanel()'));assert(source.includes('inspectSourceConnector(L1,r.station,edgeId,stationModel)'));
});


test('panel rerenders retain keyboard focus and recover to floor filter when selection is disabled',()=>{
 for(const dataset of [{sourceControl:'floor'},{sourceControl:'kind'},{sourceControl:'edge'},{action:'inspect-source-connector'}]){
  const active={dataset},calls=[],focus={focus:options=>calls.push(options)};
  const host={ownerDocument:{activeElement:active},contains:value=>value===active,querySelector:()=>focus};
  renderSourceConnectorHost(host,graph,'ETS',{});assert.equal(calls.length,1);assert.deepEqual(calls[0],{preventScroll:true});
 }
 const active={dataset:{sourceControl:'edge'}},calls=[],fallback={focus:()=>calls.push('floor')};
 const host={ownerDocument:{activeElement:active},contains:()=>true,querySelector:selector=>selector.includes('floor')?fallback:{disabled:true}};
 renderSourceConnectorHost(host,graph,'ETS',{floor:'99999'});assert.deepEqual(calls,['floor']);
 const external={ownerDocument:{activeElement:active},contains:()=>false,querySelector:()=>assert.fail('must not steal outside focus')};
 renderSourceConnectorHost(external,graph,'ETS',{});
});
