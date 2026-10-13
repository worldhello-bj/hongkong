/** Passive-only observer arithmetic. Never controls admission, heap or expansion. */
export function virtualGoalScore(label,potential,score,incumbent=Infinity){
 if(!potential||!Number.isSafeInteger(potential.time)||potential.time<0||potential.time>2**30||!Number.isSafeInteger(potential.walk)||potential.walk<0||potential.walk>2**30)return{supported:false,reason:'missing-or-invalid-potential'};
 if(!Number.isFinite(label.time)||label.time<0||label.time>2**40||!Number.isFinite(label.walk)||label.walk<0||label.walk>=2**50||!Number.isSafeInteger(label.transfers)||label.transfers<0||label.transfers>2**30||label.facilityPenalty!==0)return{supported:false,reason:'outside-audited-resource-domain'};
 const virtualTime=Math.max(label.time,Math.floor(label.time)+potential.time);
 const virtualWalk=Math.max(label.walk,Math.floor(label.walk)+potential.walk);
 // Pass the ORIGINAL engine score closure. Do not replace this with M+T+1.5W.
 const originalScore=score(label),boundScore=score({time:virtualTime,walk:virtualWalk,transfers:label.transfers,facilityPenalty:label.facilityPenalty});
 if(!Number.isFinite(originalScore)||!Number.isFinite(boundScore))return{supported:false,reason:'nonfinite-score'};
 const incumbentFinite=Number.isFinite(incumbent);
 return{supported:true,originalScore,boundScore,virtualTime,virtualWalk,timePotential:potential.time,walkPotential:potential.walk,incumbentFinite,wouldPrune:incumbentFinite&&boundScore>incumbent,equal:incumbentFinite&&boundScore===incumbent,currentScoreAboveIncumbent:incumbentFinite&&originalScore>incumbent};
}
export function loadTopologyPotentials(topology){
 return new Map(topology.allBounds.map(({node,time,walk})=>[node,{time,walk}]));
}
export const rawWorkerHooks=Object.freeze({
 originalScore:'const M=h=>h.time-s+(r-1)*h.walk+d*h.transfers+h.facilityPenalty',
 acceptedGoal:'S.push(i)',
 rootGoal:'S.push(E);',
 eligibleSettledPop:'h.settled=!0;const I=h.node,k=h.time;',
 existingProfileSettledPop:'h.settled=!0;++__sdSettled;const I=h.node,k=h.time;',
 existingProfileIncumbent:'__sdBestGoalScore',
 outgoingConnections:'J.get(h.node)??[]',
});

/** Passive observer, with exact owner/topology checks and bounded scalar aggregation.
 * It never returns an admission decision to the routing engine. No label is retained.
 */
export function createGoalBoundObserver(config,topology,domain,record,clock=()=>performance.now()){
 const begin=clock(),unsupported=reason=>{record({event:'goal-bound-shadow-unsupported',reason});return null;};
 const expected=topology.expectedRequest??{fromId:'journey:origin',toId:'journey:destination',departureS:28800,horizonS:21600,walkPenalty:2.5,transferPenaltyS:180,tripIds:385};
 if(!domain||domain.preference!=='fast'||domain.guarded)return unsupported('owner-domain');
 for(const [key,value]of Object.entries(expected))if(key!=='tripIds'&&config[key]!==value)return unsupported('request-'+key);
 if(!(config.boundary>config.departureS))return unsupported('boundary');
 const dynamic=new Set(domain.ids),wantedDynamic=new Set(topology.arcs.filter(e=>e.kind==='dynamic').map(e=>e.id));
 if(dynamic.size!==domain.ids.length||dynamic.size!==wantedDynamic.size||[...dynamic].some(id=>!wantedDynamic.has(id)))return unsupported('dynamic-ids');
 const arcs=[],ids=new Set(),nodes=new Set(),tripIds=new Set();
 for(const list of config.connections.values())for(const edge of list){
  if(ids.has(edge.id)||edge.kind!=='walk'||!Number.isFinite(edge.durationS)||edge.durationS<0)return unsupported('connection-domain');
  ids.add(edge.id);const seconds=dynamic.has(edge.id)?0:Math.floor(edge.durationS);arcs.push({kind:dynamic.has(edge.id)?'dynamic':'static',id:edge.id,from:edge.fromId,to:edge.toId,time:seconds,walk:seconds});nodes.add(edge.fromId);nodes.add(edge.toId);
 }
 const seen=new Map();
 for(const entries of config.patterns.values())for(const {p,trips}of entries){
  let sets=seen.get(p);if(!sets){sets=new Set();seen.set(p,sets);}if(sets.has(trips))continue;sets.add(trips);
  if(!trips.length)continue;for(const trip of trips)tripIds.add(trip.id);
  for(let i=0;i+1<p.stops.length;i++){
   let time=Infinity;for(const trip of trips)time=Math.min(time,Math.floor(trip.startS+p.stops[i+1].arrivalOffsetS)-Math.floor(trip.startS+p.stops[i].departureOffsetS));
   if(!Number.isSafeInteger(time)||time<0)return unsupported('pattern-domain');
   const from=p.stops[i].stopId,to=p.stops[i+1].stopId;arcs.push({kind:'pattern',id:p.id,from,to,time,walk:0});nodes.add(from);nodes.add(to);
  }
 }
 const fingerprint=values=>values.map(e=>JSON.stringify([e.kind,e.id,e.from,e.to,e.time,e.walk])).sort();
 if(JSON.stringify(fingerprint(arcs))!==JSON.stringify(fingerprint(topology.arcs)))return unsupported('exact-arcs');
 if(tripIds.size!==expected.tripIds)return unsupported('prepared-trip-count');
 const potentials=loadTopologyPotentials(topology);
 if(nodes.size!==potentials.size||[...nodes].some(node=>!potentials.has(node)))return unsupported('node-domain');
 const stateBound=2*nodes.size*(tripIds.size+1);if(!Number.isSafeInteger(stateBound)||stateBound>2**30)return unsupported('state-bound');
 const initial=()=>({expanded:0,wouldPrune:0,equal:0,noIncumbent:0,unsupported:0,currentScoreAboveIncumbent:0,outgoingResolverPotential:0,outgoingDynamicPotential:0,resolverCalls:0,resolverMs:0,dynamicResolverCalls:0,wouldPruneResolverCalls:0,wouldPruneResolverMs:0,wouldPruneDynamicResolverCalls:0,ftCalls:0,ftMs:0,wouldPruneFtCalls:0,wouldPruneFtMs:0,minOriginalScore:Infinity,maxOriginalScore:-Infinity,minVirtualScore:Infinity,maxVirtualScore:-Infinity,minIncumbent:Infinity,maxIncumbent:-Infinity});
 const totals=initial(),byNode=new Map([...nodes].map(node=>[node,{node,...initial()}]));let current=null,would=false,next=begin+10000,lastIncumbent=Infinity;
 const clean=value=>Object.fromEntries(Object.entries(value).map(([k,v])=>[k,typeof v==='number'&&!Number.isFinite(v)?null:v]));
 function snapshot(reason){const now=clock();record({event:'goal-bound-shadow',reason,elapsedMs:now-(config.startedMs??begin),observerElapsedMs:now-begin,incumbent:Number.isFinite(lastIncumbent)?lastIncumbent:null,...clean(totals),topNodes:[...byNode.values()].filter(n=>n.expanded).sort((a,b)=>b.wouldPruneResolverCalls-a.wouldPruneResolverCalls||b.wouldPrune-a.wouldPrune||b.expanded-a.expanded).slice(0,20).map(clean),interpretation:'Original-trace potential upper bound only; actual pruning changes memo eviction/replay. No expansion or callback is skipped.'});next=now+10000;}
 const maybe=()=>{if(clock()>=next)snapshot('ten-second');};
 record({event:'goal-bound-shadow-start',validated:true,nodes:nodes.size,connections:ids.size,dynamic:dynamic.size,static:ids.size-dynamic.size,arcs:arcs.length,preparedTripIds:tripIds.size,stateBound,topologyRuntime:topology.runtime,validationMs:clock()-begin});
 return{
  expansion(label,incumbent,outgoing){
   lastIncumbent=incumbent;current=byNode.get(label.node)??null;const result=virtualGoalScore(label,potentials.get(label.node),config.score,incumbent);would=result.supported&&result.wouldPrune;
   for(const stats of [totals,current])if(stats){stats.expanded++;if(!result.supported){stats.unsupported++;continue;}stats.wouldPrune+=Number(would);stats.equal+=Number(result.equal);stats.noIncumbent+=Number(!result.incumbentFinite);stats.currentScoreAboveIncumbent+=Number(result.currentScoreAboveIncumbent);stats.minOriginalScore=Math.min(stats.minOriginalScore,result.originalScore);stats.maxOriginalScore=Math.max(stats.maxOriginalScore,result.originalScore);stats.minVirtualScore=Math.min(stats.minVirtualScore,result.boundScore);stats.maxVirtualScore=Math.max(stats.maxVirtualScore,result.boundScore);if(result.incumbentFinite){stats.minIncumbent=Math.min(stats.minIncumbent,incumbent);stats.maxIncumbent=Math.max(stats.maxIncumbent,incumbent);}if(would){stats.outgoingResolverPotential+=outgoing.length;stats.outgoingDynamicPotential+=outgoing.reduce((n,e)=>n+Number(dynamic.has(e.id)),0);}}
   maybe();
  },
  resolve(owner,edge,time){
   const started=clock(),prior=globalThis.__profileActiveGoalBoundObserver;globalThis.__profileActiveGoalBoundObserver=this;
   try{return owner.resolveConnectionAt(edge,time);}finally{globalThis.__profileActiveGoalBoundObserver=prior;const elapsed=clock()-started;for(const stats of [totals,current])if(stats){stats.resolverCalls++;stats.resolverMs+=elapsed;stats.dynamicResolverCalls+=Number(dynamic.has(edge.id));if(would){stats.wouldPruneResolverCalls++;stats.wouldPruneResolverMs+=elapsed;stats.wouldPruneDynamicResolverCalls+=Number(dynamic.has(edge.id));}}maybe();}
  },
  walkQuery(ms){for(const stats of [totals,current])if(stats){stats.ftCalls++;stats.ftMs+=ms;if(would){stats.wouldPruneFtCalls++;stats.wouldPruneFtMs+=ms;}}},
  finish(){snapshot('scheduled-end');},
 };
}

export function instrumentGoalBoundObserver(source){
 const once=(a,b)=>{if(source.split(a).length!==2)throw Error('Goal-bound observer anchor drift: '+a);source=source.replace(a,b);};
 once('resolveConnectionAt:le,connectionOpeningTimesS:ze','resolveConnectionAt:((globalThis.__profileDynamicResolverDomains??=new WeakMap()).set(le,{ids:[...oe.keys()],preference:v,guarded:!!E.demo_connector_geography}),le),connectionOpeningTimesS:ze');
 once('const P=(h,I,k,A,w,Y=0)=>{',"const __gbObserver=globalThis.__profileWorkerId===5?globalThis.__profileCreateGoalBoundObserver({connections:J,patterns:j,fromId:o,toId:n,departureS:s,horizonS:c,walkPenalty:r,transferPenaltyS:d,boundary:p,score:M,startedMs:__sdStarted},globalThis.__profileGoalBoundTopology,globalThis.__profileDynamicResolverDomains?.get(e.resolveConnectionAt),event=>globalThis.__profile.record({sid:__sdSid,...event})):null;const P=(h,I,k,A,w,Y=0)=>{");
 once('h.settled=!0;++__sdSettled;const I=h.node,k=h.time;','h.settled=!0;++__sdSettled;const I=h.node,k=h.time;__gbObserver?.expansion(h,__sdBestGoalScore,J.get(h.node)??[]);');
 once('(++__sdResolveCalls,e.resolveConnectionAt(A,k))','(++__sdResolveCalls,__gbObserver?__gbObserver.resolve(e,A,k):e.resolveConnectionAt(A,k))');
 once('if(!B)return null;','__gbObserver?.finish();if(!B)return null;');
 return source;
}
