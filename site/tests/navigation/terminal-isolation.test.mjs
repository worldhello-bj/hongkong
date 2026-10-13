import test from 'node:test';
import assert from 'node:assert/strict';
import {createExactPublicTerminalPrecheck, TERMINAL_RESOLVER_POLICY_ID} from '../../src/navigation/terminal-isolation.js';
const coordinate = x => [114 + x / 100000, 22, 5.6];
const node = (id, x) => ({id, region_id: 'AUS', coordinates: coordinate(x)});
const edge = (id, from, to, extra = {}) => ({id, from_id: from, to_id: to, kind: 'stairs', geometry_mode: 'official', snap_eligible: false, location: 2, disabled: false, ...extra});
const portal = (id, n) => ({id, node_id: n.id, coordinates: n.coordinates, region_id: 'AUS'});
const point = p => ({...p, lon: p.coordinates[0], lat: p.coordinates[1], name: p.id});
const options = {taxiAllowed: false, detailState: 'ready', policyId: TERMINAL_RESOLVER_POLICY_ID};
function fixture() {
  const a = node('a', 0), b = node('b', 10), f = node('f', 20), l = node('l', 21);
  const origin = portal('AUS:portal:D2', a), destination = portal('AUS:portal:F', f);
  const graph = {schema_version: 1, version: 'source-v1', regions: [{id: 'AUS'}], nodes: [a, b, f, l],
    edges: [edge('a-b', 'a', 'b'), edge('f-l', 'f', 'l'), edge('l-f', 'l', 'f')], portals: [origin]};
  const input = {area: structuredClone(graph), station: {...structuredClone(graph), portals: [origin, destination], station_targets: {AUS: {TML: {node_id: 'b'}}}},
    detail: {schema_version: 1, version: 'detail-v1', regions: [], nodes: [], edges: [], portals: []},
    services: {version: 1, timezone: 'Asia/Hong_Kong', stops: [{id: 'public-stop', coordinates: [114,22]}], patterns: [{mode: 'bus', stops: [{stopId: 'public-stop'}]}], connections: []},
    walkLinks: {graph_version: 'source-v1', services_version: 1, preference: 'fast', connections: []}};
  const request = {origin: point(origin), destination: point(destination), mode: 'transit', need: 'escalator', departureS: 39600,
    departureDate: '2026-10-13', allowedTransitModes: ['metro', 'bus', 'tram']};
  return {input, request};
}
const freeze = o => { if (o && typeof o === 'object') { for (const v of Object.values(o)) freeze(v); Object.freeze(o); } return o; };
function check(modify) { const f = fixture(); modify?.(f); return createExactPublicTerminalPrecheck(f.input)(f.request, options); }

test('proves only a directed sealed terminal; preserves immutable request and source arrays', () => {
  const {input, request} = fixture(), before = JSON.stringify({input, request});
  const result = createExactPublicTerminalPrecheck(freeze(input))(freeze(request), options);
  assert.equal(result.failureStatus, 'NO_ROUTE');
  assert.deepEqual(result.terminalProof.closureNodeIds, ['f', 'l']);
  assert.equal(JSON.stringify({input, request}), before);
  assert.equal(result.terminalProof.allServiceTimesAdmitted, true);
});
test('disabled, closed, scheduled and preference-forbidden inward links still prevent proof', () => {
  for (const extra of [{}, {disabled: true}, {access_time_id: 7}, {kind: 'lift'}, {kind: 'stairs', wheelchair_barrier: 1}]) {
    assert.equal(check(({input}) => input.detail = {...input.detail, nodes: input.area.nodes, edges: [edge('new-in', 'a', 'f', extra)]}), null);
  }
});
test('directed outward edge does not falsely make terminal reachable', () => {
  assert.equal(check(({input}) => input.area.edges.push(edge('out', 'f', 'a')))?.failureStatus, 'NO_ROUTE');
  assert.equal(check(({input}) => input.area.edges.push(edge('in', 'a', 'f'))), null);
});
test('any admissible projection into terminal forces unchanged fallback', () => {
  assert.equal(check(({input}) => input.area.edges[1] = {...input.area.edges[1], kind: 'walk', location: 1, snap_eligible: true}), null);
  // A disabled projection is also admitted as a conservative all-time superset.
  assert.equal(check(({input}) => input.area.edges[1] = {...input.area.edges[1], kind: 'walk', location: 1, snap_eligible: true, disabled: true}), null);
});
test('all modeled external anchor families prevent proof', () => {
  const changes = [
    ({input}) => input.area.portals.push(input.station.portals[1]),
    ({input}) => input.station.station_targets.AUS.TML.node_id = 'f',
    ({input}) => input.services.stops.push({id: 'f', coordinates: [114,22]}),
    ({input}) => input.services.patterns[0].stops.push({stopId: 'AUS:portal:F'}),
    ({input}) => input.services.connections.push({fromId: 'public-stop', toId: 'f'}),
    ({input}) => input.walkLinks.connections.push({fromId: 'public-stop', toId: 'f'}),
    ({input}) => input.walkLinks.connections.push({fromId: 'public-stop', toId: 'x', route: {snapped_destination: {node_id: 'f'}}}),
    ({input}) => input.walkLinks.station_access_points = [{id: 'f', coordinates: [114,22], platform_ids: ['RAIL:AUS:TML']}],
    ({input}) => input.detail = {...input.detail, nodes: input.area.nodes, edges: [edge('modal', 'l', 'f', {kind: 'station_access'})]},
  ];
  for (const change of changes) assert.equal(check(change), null);
});
test('canonical/legacy portal alias admitted even if old anchor targets another node', () => {
  assert.equal(check(({input}) => {
    input.area.portals.push(portal('legacy', input.area.nodes[1]));
    input.station.portals.push(portal('legacy', input.station.nodes[2]));
  }), null);
});
test('unknown or partial graphs, modal input, policy, taxi, dates and endpoints fall through', () => {
  for (const change of [
    f => f.input.detail = undefined, f => f.input.services = undefined, f => f.input.walkLinks = undefined,
    f => f.input.area.schema_version = 2, f => f.input.walkLinks.graph_version = 'stale',
    f => f.input.services.patterns[0].mode = 'ferry', f => f.input.services.stops[0].node_id = 'f',
    f => f.request.destination.node_ids = ['f'], f => delete f.request.origin.node_id,
    f => f.request.destination.coordinates = [114,22,999], f => f.request.departureDate = '2026-02-30',
    f => f.request.departureS = NaN, f => f.request.need = 'accessible',
    f => f.request.allowedTransitModes.push('ferry'), f => f.input.area.nodes.push(node('a', 999)),
    f => f.input.area.edges.push(edge('missing', 'unknown', 'f')),
    f => f.input.detail = {...f.input.detail, nodes: [node('f', 999)]},
  ]) assert.equal(check(change), null);
  for (const patch of [{taxiAllowed:true}, {detailState:'loading'}, {policyId:'new-policy'}, {taxiAllowed:undefined}]) {
    const {input, request} = fixture(); assert.equal(createExactPublicTerminalPrecheck(input)(request, {...options,...patch}), null);
  }
});
test('immutable snapshot cache cannot outlive source identity; mutable source changes recompute', () => {
  const {input, request} = fixture(), evaluate = createExactPublicTerminalPrecheck(input);
  assert.equal(evaluate(request, options)?.failureStatus, 'NO_ROUTE');
  input.area.edges.push(edge('bridge', 'a', 'f'));
  assert.equal(evaluate(request, options), null);
  const later = fixture(); freeze(later.input);
  const second = createExactPublicTerminalPrecheck(later.input);
  assert.deepEqual(second(later.request, options), second(later.request, options));
});
test('closure optimization bound is UNKNOWN rather than a search-limit refusal', () => {
  assert.equal(check(({input}) => {
    for (let i=0; i<130; i++) { input.area.nodes.push(node('x'+i, 100+i)); input.area.edges.push(edge('chain'+i, 'x'+i, i ? 'x'+(i-1) : 'f')); }
  }), null);
});
test('preference and service clock do not remove edges from proof', () => {
  for (const need of ['ordinary','luggage','escalator','lift']) for (const departureS of [0,39600,86399]) {
    assert.equal(check(f => {f.request.need=need;f.request.departureS=departureS})?.failureStatus, 'NO_ROUTE');
  }
});

test('cooperative driver cancels, rejects stale/mutable sources, and only latest call progresses', async () => {
  const {runExactPublicTerminalPrecheck: run} = await import('../../src/navigation/terminal-isolation.js');
  const f=fixture();
  assert.equal(await run(createExactPublicTerminalPrecheck(f.input),f.request,options),null);
  // Enough inert source records to yield inside shape/consistency/index work.
  for(let i=0;i<2200;i++) f.input.area.nodes.push(node('padding'+i,1000+i));
  freeze(f.input);
  const evaluate=createExactPublicTerminalPrecheck(f.input), aborted=new AbortController();
  let yields=0;
  assert.equal(await run(evaluate,f.request,options,{signal:aborted.signal,yieldControl:async()=>{yields++;aborted.abort()}}),null);
  assert.ok(yields>=1);
  assert.equal(await run(evaluate,f.request,options,{isCurrent:()=>false}),null);
  let release;
  const older=run(evaluate,f.request,options,{yieldControl:()=>new Promise(resolve=>{release=resolve})});
  const newer=run(evaluate,f.request,options,{yieldControl:()=>Promise.resolve()});
  assert.equal((await newer)?.failureStatus,'NO_ROUTE');
  release();assert.equal(await older,null);
});

test('frozen topology still sees changed modal/target inputs, and mid-proof change invalidates result', async () => {
  const {runExactPublicTerminalPrecheck: run}=await import('../../src/navigation/terminal-isolation.js');
  const f=fixture();
  for(const graph of [f.input.area,f.input.station,f.input.detail])freeze(graph);
  const evaluate=createExactPublicTerminalPrecheck(f.input);
  assert.equal(evaluate(f.request,options)?.failureStatus,'NO_ROUTE');
  f.input.services.connections.push({fromId:'public-stop',toId:'f'});
  assert.equal(evaluate(f.request,options),null);
  f.input.services.connections.pop();
  assert.equal(evaluate(f.request,options)?.failureStatus,'NO_ROUTE');
  const g=fixture();for(let i=0;i<2200;i++)g.input.area.nodes.push(node('padding'+i,1000+i));
  for(const graph of [g.input.area,g.input.station,g.input.detail])freeze(graph);
  let changed=false;
  const result=await run(createExactPublicTerminalPrecheck(g.input),g.request,options,{yieldControl:async()=>{
    if(!changed){g.input.services.connections.push({fromId:'public-stop',toId:'f'});changed=true;}
  }});
  assert.equal(result,null);
});

test('cross-station and ordinary public-portal destinations fall through before any full-edge scan', () => {
  const f=fixture();
  f.input.area.portals.push(f.input.station.portals[1]);
  Object.defineProperty(f.input.area.edges,0,{get(){throw Error('Unexpected full-edge scan for ordinary portal');}});
  assert.equal(createExactPublicTerminalPrecheck(f.input)(f.request,options),null);
  const g=fixture();g.input.station.nodes[2].region_id='OTHER';
  Object.defineProperty(g.input.area.edges,0,{get(){throw Error('Unexpected full-edge scan for cross-station request');}});
  assert.equal(createExactPublicTerminalPrecheck(g.input)(g.request,options),null);
});

test('modal ABA cannot hide a terminal ingress anchor during a warm cooperative proof', async()=>{
  const {runExactPublicTerminalPrecheck:run}=await import('../../src/navigation/terminal-isolation.js');
  const f=fixture();for(let i=0;i<3000;i++)f.input.area.nodes.push(node('aba-padding'+i,1000+i));
  for(const g of [f.input.area,f.input.station,f.input.detail])freeze(g);
  const evaluate=createExactPublicTerminalPrecheck(f.input);
  assert.equal(evaluate(f.request,options)?.failureStatus,'NO_ROUTE');
  const original=f.input.services.stops;
  const withAnchor=[...original,{id:'f',coordinates:[114,22]}];f.input.services.stops=withAnchor;
  let yields=0;
  const result=await run(evaluate,f.request,options,{yieldControl:async()=>{
    if(++yields===1)f.input.services.stops=original;
    else if(yields===2)f.input.services.stops=withAnchor;
  }});
  assert.ok(yields>=2);assert.equal(result,null);assert.equal(evaluate(f.request,options),null);
});

test('mid-proof malformed modal input and optional proof errors fall through without stranding S1',async()=>{
  const {runExactPublicTerminalPrecheck:run}=await import('../../src/navigation/terminal-isolation.js');
  const f=fixture();for(let i=0;i<3000;i++)f.input.area.nodes.push(node('null-padding'+i,1000+i));
  for(const g of [f.input.area,f.input.station,f.input.detail])freeze(g);
  const evaluate=createExactPublicTerminalPrecheck(f.input);
  assert.equal(evaluate(f.request,options)?.failureStatus,'NO_ROUTE');
  assert.equal(await run(evaluate,f.request,options,{yieldControl:async()=>{f.input.services.stops=null}}),null);
  f.input.services.stops=[];
  assert.equal(await run(evaluate,f.request,options,{yieldControl:async()=>{throw Error('Optional precheck scheduling failed')}}),null);
});

test('request mutation cannot poison another destination through a cancelled proof',async()=>{
  const {runExactPublicTerminalPrecheck:run}=await import('../../src/navigation/terminal-isolation.js');
  const f=fixture(),bPortal=portal('AUS:portal:B',f.input.station.nodes.find(n=>n.id==='b'));
  f.input.station.portals.push(bPortal);
  for(let i=0;i<3000;i++)f.input.area.nodes.push(node('request-padding'+i,1000+i));
  freeze(f.input);
  const evaluate=createExactPublicTerminalPrecheck(f.input);let yields=0;
  assert.equal(await run(evaluate,f.request,options,{yieldControl:async()=>{if(++yields===1)f.request.destination=point(bPortal)}}),null);
  assert.ok(yields>=1);
  assert.equal(evaluate(f.request,options),null); // a→b exists; never use F's closure.
  assert.equal(createExactPublicTerminalPrecheck(f.input)(f.request,options),null);
});

test('a shallow-frozen graph cannot mutate and freeze an edge after a stale terminal cut was read',async()=>{
  const {runExactPublicTerminalPrecheck:run}=await import('../../src/navigation/terminal-isolation.js');
  const f=fixture();for(let i=0;i<3000;i++)f.input.area.nodes.push(node('edge-padding'+i,1000+i));
  const mutableEdge=f.input.area.edges[0];
  freeze(f.input.area.nodes);freeze(f.input.area.portals);freeze(f.input.area.regions);
  for(const edge of f.input.area.edges)if(edge!==mutableEdge)freeze(edge);
  Object.freeze(f.input.area.edges);Object.freeze(f.input.area);
  freeze(f.input.station);freeze(f.input.detail);
  let yields=0;
  const result=await run(createExactPublicTerminalPrecheck(f.input),f.request,options,{yieldControl:async()=>{
    if(++yields===1){mutableEdge.to_id='f';Object.freeze(mutableEdge);}
  }});
  assert.ok(yields>=1);assert.equal(result,null);
  assert.equal(createExactPublicTerminalPrecheck(f.input)(f.request,options),null);
});

test('4 ms and 100 ms browser scheduling waits never consume the next work slice', async t => {
  const {runExactPublicTerminalPrecheck:run}=await import('../../src/navigation/terminal-isolation.js');
  let clock=0;
  t.mock.method(performance,'now',()=>clock);
  const execute=async(delay,cancel=false)=>{
    const f=fixture();for(let i=0;i<10000;i++)f.input.area.nodes.push(node('timer-padding'+i,1000+i));
    freeze(f.input);const controller=new AbortController();let yields=0,slices=0;
    const result=await run(createExactPublicTerminalPrecheck(f.input),f.request,options,{
      signal:controller.signal,onSlice:()=>slices++,yieldControl:async()=>{
        ++yields;clock+=delay; // The event-loop wait, with zero proof CPU work.
        if(cancel&&yields===3)controller.abort();
      },
    });
    return {result,yields,slices};
  };
  const immediate=await execute(0);
  assert.equal(immediate.result?.failureStatus,'NO_ROUTE');
  assert.ok(immediate.yields>10&&immediate.yields<40);
  for(const delay of [4,100]) {
    const delayed=await execute(delay);
    assert.deepEqual(delayed.result,immediate.result);
    assert.equal(delayed.yields,immediate.yields,'Waiting must not reduce a 2048-record work slice to 64 records');
    assert.equal(delayed.slices,immediate.slices);
  }
  const cancelled=await execute(100,true);
  assert.equal(cancelled.result,null);assert.equal(cancelled.yields,3);assert.equal(cancelled.slices,3);
});

test('actual clamped timer tasks keep bounded work chunks and allow cancellation',async()=>{
  const {runExactPublicTerminalPrecheck:run}=await import('../../src/navigation/terminal-isolation.js');
  const f=fixture();for(let i=0;i<4096;i++)f.input.area.nodes.push(node('real-timer-padding'+i,1000+i));
  freeze(f.input);let yields=0;
  const result=await run(createExactPublicTerminalPrecheck(f.input),f.request,options,{
    yieldControl:()=>new Promise(resolve=>{yields++;setTimeout(resolve,5)}),
  });
  assert.equal(result?.failureStatus,'NO_ROUTE');
  assert.ok(yields<40,`Timer clamping amplified proof to ${yields} task waits`);
  const controller=new AbortController();let cancelledYields=0;
  assert.equal(await run(createExactPublicTerminalPrecheck(f.input),f.request,options,{
    signal:controller.signal,yieldControl:()=>new Promise(resolve=>setTimeout(()=>{cancelledYields++;controller.abort();resolve()},5)),
  }),null);
  assert.equal(cancelledYields,1);
});
