import test from'node:test';import assert from'node:assert/strict';import{preferenceCost}from'../../src/navigation/preference-routing.js';
const profiles=['fast','luggage','escalator_first','lift_first','accessible'];
function lowerBounds(edges,goal,profile){const d=new Map([[goal,0]]);for(let i=0;i<10;i++){let change=false;for(const edge of edges){const value=(d.get(edge.to)??Infinity)+preferenceCost(edge,Math.max(0,edge.duration-(edge.wait??0)),profile,{continuingLift:true});if(value<(d.get(edge.from)??Infinity)){d.set(edge.from,value);change=true}}if(!change)break}return d}
function solve(edges,profile,heuristic=new Map(),initial={node:0,time:0,ride:'',paid:false,rail:false},requireRail=false){
 const queue=[{...initial,cost:0}],best=new Map();const key=s=>JSON.stringify([s.node,s.time,s.ride,s.paid,s.rail]);best.set(key(initial),0);
 while(queue.length){queue.sort((a,b)=>(a.cost+(heuristic.get(a.node)??0))-(b.cost+(heuristic.get(b.node)??0)));const s=queue.shift();if(s.cost!==best.get(key(s)))continue;if(s.node===6&&(!requireRail||s.rail))return s.cost;
  const next=[];if(s.time<60)next.push({...s,time:s.time+1,cost:s.cost+1});
  for(const e of edges.filter(e=>e.from===s.node)){
   if(e.disabled||e.paidOnly&&!s.paid||profile==='accessible'&&e.accessible===false)continue;
   const continuing=!!e.ride&&e.ride===s.ride,duration=e.duration-(continuing?e.wait??0:0),cost=preferenceCost(e,duration,profile,{continuingLift:continuing});assert.ok(cost>=0);assert.ok(duration>=0);
   if(s.time+duration>60||e.window&&(s.time<e.window[0]||s.time+duration>e.window[1]||s.time>=e.window[1]))continue;
   next.push({node:e.to,time:s.time+duration,ride:e.ride??'',paid:e.gate?!s.paid:s.paid,rail:s.rail||e.kind==='rail',cost:s.cost+cost});
  }
  for(const n of next)if(n.cost<(best.get(key(n))??Infinity)){best.set(key(n),n.cost);queue.push(n)}
 }
 return Infinity;
}
test('admissible A* equals full state/time Dijkstra for all five profiles, opening waits, lift continuity, paid/rail state and zero edges',()=>{
 let seed=4281;const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n};
 for(let sample=0;sample<12;sample++){
  const edges=[{from:0,to:1,kind:'unknown',duration:0},{from:1,to:2,kind:'lift',duration:7,ride:'A',wait:4},{from:2,to:3,kind:'lift',duration:7,ride:'A',wait:4},{from:3,to:4,kind:'lift',duration:8,ride:'B',wait:4},{from:4,to:5,kind:'walk',duration:0,gate:true},{from:5,to:6,kind:'rail',duration:4,paidOnly:true,window:[20,58]},{from:0,to:6,kind:'stairs',duration:9,accessible:false}];
  for(let i=0;i<7;i++){const from=rand(6),to=from+1+rand(6-from),kind=['walk','stairs','escalator','unknown'][rand(4)];edges.push({from,to,kind,duration:rand(12),accessible:kind!=='stairs'&&kind!=='escalator',window:rand(2)?[rand(15),40+rand(20)]:null,disabled:rand(12)===0})}
  for(const profile of profiles){const h=lowerBounds(edges,6,profile);for(const requireRail of [false,true]){
   const initial={node:0,time:0,ride:'',paid:false,rail:false},oracle=solve(edges,profile,new Map(),initial,requireRail),astar=solve(edges,profile,h,initial,requireRail);assert.equal(astar,oracle,`${sample}/${profile}/${requireRail}`);assert.ok((h.get(0)??0)<=oracle);
  }
  for(const initial of [{node:2,time:12,ride:'A',paid:false,rail:false},{node:4,time:20,ride:'B',paid:true,rail:false}])assert.ok((h.get(initial.node)??0)<=solve(edges,profile,new Map(),initial));
  }
 }
});
