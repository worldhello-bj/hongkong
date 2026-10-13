# OD36 bounded certificate audit

This audit made no production pruning change. It used the frozen 2e2fcf795897 data/source, read-only input preparation, tiny two-engine oracles, and independently retained small experimental artifacts. The actual ft and Dt searches were disabled with sentinels when capturing the real macro topology. No new OD search ran.

## Decision

The zero-dynamic relaxation is NOT all zero and has a defensible, narrow Worker-only supported domain. A passive, bounded scalar probe is justified. Production pruning is not yet recommended: the descriptor/guards are not implemented, and no existing non-goal scalar sample establishes actual strict-bound rejection counts. These are concrete implementation/measurement steps, not a requirement for a novel all-times walk-duration theorem.

The old statement that an early generated goal is unobserved is superseded: final 2e observed the first at Dt+2.785703 s, score 18315.64713, with a later incumbent 18186.92919 and 311 generated goals.

## Actual zero-dynamic topology

The actual factory construction yielded 307 connections: 147 internally dynamic connections, assigned time/walk weight zero, and 160 static connections, with floor(durationS) weights. All 307 kinds are walk and IDs are unique. There are 16 input patterns; eight have allowed, prepared trips in the selected six-hour window. The 385 distinct prepared trip IDs and 100 reachable macro node identities give a conservative predecessor-state bound 2*100*(385+1)=77200.

Pattern weights are the minimum, over actual prepared trips, of floor(next absolute arrival)-floor(current absolute departure), using original arithmetic. Every dynamic arc remains present, regardless of whether it happens to resolve at one time. Separate saturated integer reverse time/walk potentials are calculated.

72/100 macro nodes have positive time potentials; 51/100 have positive walk potentials. AUS D1/D2/D3/B1/B2/B3 and AUS:TML have T=840,W=0. HUH:TML/EAL have T=420,W=0. Several retained bus nodes have T=1189..1485,W=100. Of the saved top20 node rows, 11561/12842 retained labels belong to nodes with positive T. This is a topology count, NOT a count of prunable labels.

At AUS, the existing virtual-resource formula adds about 839..840 to the original score. It can reject only when that label's original score is around 17346.93..17347.93 or higher relative to incumbent 18186.92919. Existing top-node rows contain only time extrema, not per-label walk/transfers/score. Time-only lower scores for all those rows remain below the incumbent. No actual rejection count can be inferred.

Artifacts: topology.mjs/json and prepared-state-bound.mjs/json.

## Supported production contract

1. Opt in only the internally created Worker jt/le resolver through a private WeakMap descriptor. Unknown callable resolvers disable pruning; assigning their arcs zero is not a purity certificate.
2. Require private structured-cloned plain requests/services/walk-links; Ae-prepared immutable graphs; ordinary trusted intrinsics; no getters/proxies/user callbacks. Inputs and prior result objects must not be externally mutated. Worker postMessage cloning isolates the owned caches; generic module/public-factory use remains fallback unless separately certified.
3. Require fast preference, no demo_connector_geography, final R connection kinds all walk, unique connection IDs, valid endpoint schemas, valid prepared patterns/provenance/geometry and finite static values. Preserve original validation order; a failed certificate returns fallback rather than hiding a delayed validation exception.
4. Require p>s, 0<=s<=f<=2^40, horizon<=604800, coefficients<=2^20, and N=2*macroNodeCount*(preparedTripIdCount+1)<=2^30. Fast resolved facility penalties must be zero from finite minutes.
5. Keep original heap, admission/invalidation, ancestor rules and goal-pop check. Observe a goal only after original acceptance. After original settled assignment, skip expansion only for finite original-score evaluation on virtual resources strictly greater than the current accepted-goal incumbent. Equality is retained.
6. Preserve original Pt and Ke cancellation boundaries. The private resolver/search/evidence segment is synchronous and non-reentrant. Native abort state cannot change inside it without an excluded callback; Worker termination semantics remain external and unchanged.

Inspected cache values are history-independent within this domain: unguarded Et key covers snapping inputs; repaired ee/H and station Lt keys include original clock/date; graph/preference/timing/reverse/destination caches derive from fixed inputs; unique IDs avoid paired-memo alias ambiguity; eviction replays the same selected evidence at its exact original clock. Prior result/network mutation is specifically excluded because nested objects can be shared with caches.

The actual three source graphs passed the production ot checks, schedule/warning scans and nonnegative lift-residual checks. Station has six recognized lift arcs with minimum residual 2.3093 s. Max physical durations are area1009.868527, block211.807727, station85.754 s. All 272 walk-link routes passed finite nonnegative minute and warning/edge-ID array checks. No source-data delayed-validation blocker was found in this domain. Ordinary memory/resource exhaustion is outside the semantic certificate.

## Numerical replacement for the static experiment's >=1s rule

With p>s, the original ancestor guard makes every accepted predecessor chain unique in (node,boarded,onboardTrip). Its length is bounded by N; this is a proof bound, not a new search cutoff.

A successfully admitted connection has nonnegative duration and fl(time+duration)<=f, hence duration<=604801 in the stated clock range. At most N such additions bound accumulated walk by N*604802<2^50, allowing a conservative rounding margin. floor(walk)+2^30<2^51 and floor(time)+2^30<2^41 are exactly representable integer additions. Transfers<=N; with nonnegative finite coefficients and F=0 the original score stays finite.

Thus dynamic zero/subsecond durations are allowed. Every actual transition dominates its integer relaxed weights. Potentials are history independent, transition-consistent and same-node dominance-monotone. The original score evaluated on max(time,floor(time)+T), max(walk,floor(walk)+W), and unchanged transfers/F is an admissible monotone lower bound, without reassociating floating-point arithmetic. A skipped label/descendant cannot dominate a possibly winning label, because that would contradict these monotonic bounds.

zero-dynamic-oracle.mjs ran both actual engines: 14 paired outputs/viable-state comparisons; 12 strictly losing expansions omitted; dynamic duration 0,0.00006,0.25,1,2,5; equality retained. Unknown exception/cancellation callbacks preserve the original behavior through fallback. Deliberately falsely branding an effectful callback hides its exception, confirming why a brand alone without the contract is invalid.

## Next passive observation, not pruning

After source J/j construction and a successful certificate, compute the zero-dynamic T/W once. At each ORIGINAL active, unsettled, non-goal expansion, retain execution unchanged and count:
- visits before an incumbent; certified/uncertified visits;
- original score and virtual score finite/nonfinite checks;
- strict virtualScore>currentIncumbent, equality, and per-node strict counts;
- sanity count originalScore>currentIncumbent (expected zero);
- at most ten scalar witnesses: node,time,walk,transfers,F,originalScore,T,W,virtualScore,incumbent;
- preparation and counter overhead.

Do not store labels/predecessors/geometries, change admission/heap/callbacks, or interpret baseline strict counts as final end-to-end speedup. One separately authorized bounded OD observation is sufficient to decide whether this weak relaxation merits implementation. No such observation was started here.

## Guarded-height cache side finding

The generic guarded engine has a real Et key omission: demoSourceCoordinates[2] affects candidate filtering but is absent from the key. A real-guard, two-node ft oracle gives warm high-Z CONDITIONAL vs cold NO_ROUTE. Honest XYZ final validation rejects it, but an XY request with only demoSourceCoordinates high-Z can pass. Current UI and all 44 distributed data files have no producer of that field and create fresh demo owners; this is not the W5 cause. A guarded finite-Z key component fixes the isolated dependency and leaves unguarded/missing/nonfinite behavior unchanged. See guarded-snap-runtime.mjs/json and guarded-snap-key-only.mjs/json.

If positive dynamic walk bounds become necessary later, scalars.mjs documents the separate all-time integer-duration relaxation: minimum continuing-lift duration per physical arc, full endpoint overlay, saturated integer distance D, then floor(Number((D/60).toFixed(6))*60). Existing preference-cost bounds cannot be substituted. It is not needed to obtain the current nonzero static potentials.
