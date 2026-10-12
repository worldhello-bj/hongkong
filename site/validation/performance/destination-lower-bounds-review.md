# Exact destination lower bounds: implementation and independent audit

Reviewed 2026-10-12. Implementation: `src/navigation/destination-lower-bounds.js`; narrow asset transform: `scripts/repair-destination-lower-bounds.mjs`; semantic oracle: `tests/navigation/destination-lower-bounds.test.mjs`.

## Scope and unchanged behavior

The transform prepends an optional optimized lookup to the original timed-query `remainingCache.get`. It leaves the entire original reverse-bound construction and exact-OD cache as the fallback. The helper returns `undefined` for unprepared graphs, coincident synthetic origin/destination IDs, unexpected ID overlap, unproved overlay topology, or unsupported numeric edge costs.

It does not change graph preparation, graph preference filtering, endpoint validation, endpoint snapping, candidate selection, source-node/floor fields, candidate order, access distances, scheduled opening rules, paid waiting, no-wait labels, lift ride state, actual traversal costs, forward search ordering, tie-breaking, result reconstruction, geometry, hard constraints, search limits, or route completeness. No cutoff or pruning is introduced.

The per-edge lower-bound cost and walk-mode exclusion are copied from the original production expression, including lift wait subtraction, fractional multiplication, preference cost and `continuingLift:true`. The original production heap class is passed through. The forward search receives exactly the same `.get(id)` numeric values and missing entries.

## Exact decomposition proof

Let C contain graph nodes, destination-only synthetic candidate nodes and the synthetic destination O. Let L contain only the actual synthetic origin candidate IDs, determined from candidate roles rather than string prefixes. Let B be the synthetic origin root.

The helper validates:

1. B and O are different, neither is a graph-node ID, and synthetic candidate IDs do not overlap graph nodes, B, O or the opposing candidate set.
2. Every included base edge connects two graph nodes.
3. Every included overlay edge belongs to one of C→C, L→C, or B→(L∪C), with B's targets additionally restricted to its actual origin candidates.
4. Weights are numeric and nonnegative. NaN and negative weights request the unchanged fallback. Positive infinity is preserved and cannot pass the original strict relaxation against infinity.

Consequently the reversed graph has no edge from L or B into C. Removing L and B cannot change any core relaxation or core distance. It only removes queue work that leads farther into terminal origin branches. The core is computed with the same heap, the same zero seed at O, the same stale-entry equality check, and the same `current.cost + edge.seconds` followed by strict `<`.

Base reversed adjacency is generated in original adjacency/list order. For each overlay destination, the helper copies its existing base array and appends overlay arcs in original order. Other base arrays are read directly. Cached arrays are never modified.

After the core is known, each l∈L has exactly the distance obtained by taking the strict minimum of `coreDistance[target] + edgeWeight` over its outgoing arcs. B then takes the strict minimum of `candidateDistance + edgeWeight` over its outgoing arcs. This is the original reverse-relaxation recurrence, with the same operand order and grouping. A same-physical-edge direct origin-to-destination-candidate shortcut belongs to L→C and is recalculated on every request.

Floating-point additions are never reassociated. The branch elimination does not replace edge-wise accumulation with a differently grouped path sum. Nonnegative floating-point addition is monotone, so discarding an intermediate worse distance cannot produce a better predecessor than the smaller distance does. Equal minima represent the same numeric value. Zero cycles cannot lower a value; positive-infinite proposals are not inserted. Missing values remain missing. The existing compact representation preserves numeric bit-level distinctions such as signed zero, NaN, and infinities if they are stored; production reverse relaxation never creates NaN or positive-infinite entries.

The forward heap and its lexical tie-breaking are untouched. Since every heuristic lookup is unchanged, the optimization does not change forward priorities or route choice.

## Key, owner, mode and preference isolation

The destination key includes the complete original target object via `JSON.stringify([request.destination, request.mode])`, including source node IDs, node-ID arrays, source/floor metadata and schedule fields. It additionally includes the actual O ID and the ordered `(from, to, exact weight)` sequence of every core overlay arc. Signed zero and nonfinite weights have explicit signature representations. A change in candidate IDs, cost, order or any origin-dependent core overlay therefore cannot reuse a different core result.

The helper uses the existing prepared graph's per-preference index. `fast`, luggage, lift, escalator, accessibility and few-stairs owners cannot share a cache. The stored graph identity is checked before reuse. Unprepared mutable graphs always fall back.

Core keys keep the original mode. Base reverse adjacency has two partitions: walk, and all edges. This normalization is justified only by the original lower-bound exclusion `mode === "walk" && excludedKinds.has(kind)`; undefined and metro modes have the same base reverse edges. Metro state and all other mode rules remain in the unchanged forward engine.

Reserved-looking real IDs are supported: the original allocator chooses fresh actual IDs, and the helper checks those actual IDs. There is no prefix blacklist or presumed global naming convention. A real ID collision, cross-role overlap, core→origin edge, origin-leaf→origin-leaf edge, root return edge or unknown endpoint fails a guard and uses the exact legacy path. An additional core→core overlay edge is safe because its full ordered structure is part of the cache key; if origin-dependent, it naturally creates a distinct cache entry.

## Ownership and retained-memory audit

The existing module WeakMap owns a graph's per-preference index. The new index field owns its graph identity, dense node-ID index, two possible base reverse maps and bounded core-result cache. The graph reference back from the WeakMap value does not independently root an otherwise unreachable graph. No process-global graph cache was added.

Base reverse entries hold only source ID and numeric seconds, not graph-edge objects, request objects or geometry. Core cache values use the existing compact representation: typed numeric array, presence bitmap and a small synthetic-ID map. Their lookup closure needs the node-ID map and value storage, not the prepared owner or graph. Returned query views contain only a core result and a small origin-extra map; their method uses `this` and does not close over the configuration, candidate arrays, overlay, request callbacks or Dijkstra heap. No query result is inserted into the destination cache.

Transient work includes the request's validated overlay lists, its structural key, a few copied reverse arrays, a Dijkstra heap and distance Map on core misses, and per-query origin extras. Creating a compact entry happens before FIFO eviction, so compaction may briefly retain one extra array entry, as the existing legacy helper also does.

### Important aggregate memory boundary

The new and old caches have separate budgets. Each permits up to 64 entries and up to 16 MiB of typed-array storage, with at least one entry allowed for a graph larger than the nominal byte budget. The old exact-OD cache is only populated when the helper falls back. If one owner receives enough optimized and fallback requests, both can fill simultaneously. Neither budget covers Map/list overhead, keys, node-ID indices, reverse adjacency or transient work.

For the observed 27,512-node graph, one compact entry is 223,535 bytes:

- 37 destination entries: 8,270,795 bytes, approximately 7.89 MiB.
- One full 64-entry cache: 14,306,240 bytes, approximately 13.64 MiB.
- Two full 64-entry caches together: 28,612,480 bytes, approximately 27.29 MiB.

If both pathways are used, the old and new metadata also own separate dense node-ID maps. Base reversed adjacency may have one or two retained mode partitions. Its heap footprint is implementation-dependent and must be measured; the array totals above are not a total-memory claim.

The recorded OD36 trace has 37 exact destination/mode keys, 116 exact OD/mode keys, and no coincident-root case. On that trace, if all topology guards pass, the new process should leave the old cache empty and use 37 core computations instead of the previous 2,185 reverse-bound rebuilds. This is a structural opportunity, not a runtime or memory guarantee for unobserved queries. Probe data must establish actual hits, guard fallbacks, time and retained memory.

A possible later improvement is a combined old/new storage budget or shared dense node-ID metadata. Neither was introduced during this audit, because it would change retention policy and should be separately tested after the active performance comparison.

## Verification

The independent small-graph oracle uses the original production heap and original full reverse construction. It compares every requested/discovered key with `Object.is`, plus map size.

- 2,000 randomized distance comparisons: zero cycles, disconnected graphs, fractional costs, subnormal values, infinities, signed-zero edges, mode filtering, reordered/duplicate graph edges, multi-candidate origins/destinations, direct fractional shortcuts and real nodes occupying reserved synthetic names.
- 2,616 exact paired complete-engine queries across six preferences, multiple departure times/dates, open/closed target schedules, no-wait graphs, coordinate/node-ID/node-ID-array endpoints, target metadata, synthetic collisions and same-place fallback.
- 108 additional paired complete-engine queries across undefined/metro/walk modes, two regions, 3D nodes and explicit paid-lift ride metadata.
- Guard rejection, graph replacement, owner isolation, target-key completeness, mode separation, FIFO eviction, bounded old/new cache coexistence, helper refresh and four-asset reversible/idempotent transforms.
- All four transformed production bundles pass `node --check`.

No real-graph benchmark was run by this audit. Real OD36 performance validation is handled separately from this report.

## Read-only follow-on: outer `Dt` waiting and dominance

This section proposes no production change. The destination helper remains frozen for the live comparison.

In `app-transit-worker-CaCMeUxU.js`, inner `ft` reconstruction adds each `hkWait` to its total `le`, emits an opening-wait leg, and returns `total_minutes = round(le / 60, 6)`. `Ht` wraps the entire `total_minutes * 60` as a single outer connection with `kind:"walk"`. `Dt` therefore adds the inner opening wait both to time and to accumulated `walk`. Its score is elapsed time plus `(walkPenalty - 1) * walk`, transfers and facility penalties. An inner opening-wait second is consequently charged at the walking weight, whereas an explicit transit-wait leg is charged only through elapsed time.

This prevents the naïve FIFO argument that an earlier outer label can always wait to reproduce a later label at no additional walking burden. For example, two otherwise comparable labels at times 0 and 100 can both reach an onward opening at 100 plus ten seconds' movement. The first resolver can report a 110-second walking connection, the second a ten-second walking connection. Their final arrival times can match while their accumulated walking dimensions differ by 100 seconds. Changing that accounting, adding a new freely waiting action, or replacing `p` with departure time would alter the current algorithm rather than merely reuse work.

The global `p` is the latest supplied connection opening within the outer horizon, so unrelated graph regions can keep the comparison conservative. No general cross-departure resolver-result reuse has been proved. Even a known path requires exact schedule revalidation and preservation of the minute-to-second rounding; interpolating or subtracting departure differences is insufficient evidence.

A separate, exact indexing opportunity follows directly from the existing predicate `me(a,b) = a <= b && (a === b || a >= p)`:

- If either candidate time is below `p`, both forward dominance and reverse invalidation can be true only at exactly equal times below `p`.
- A candidate at or above `p` can only dominate or be dominated by another label at or above `p`.
- Thus a node's labels can be stored in `Map<exact pre-p time, label[]>` plus one post-p array, without changing any eligible comparison. The original `ee`, `me`, active-state and numeric-dimension tests can remain unchanged inside the selected bucket.
- Preserve relative insertion order within each bucket, the original heap, every predecessor and the original ancestor-cycle test. No label is pruned beyond the original predicate. Finite times are already required; Map's treatment of positive and negative zero agrees with `===`.

This skips only predicate-false scans, rather than strengthening dominance. A separately authorized candidate is now implemented in `src/navigation/scheduled-label-buckets.js`, `scripts/repair-scheduled-label-buckets.mjs` and `tests/navigation/scheduled-label-buckets.test.mjs`. It is not part of the frozen destination-helper comparison. Bucket storage has overhead, especially for singleton times.

The bucket implementation modifies exactly three accesses in each of the two scheduled engines: initial-label storage, candidate-list lookup and accepted-label storage. A node owns a Map keyed by `time < p ? time : p`; the boundary key represents the post-opening array. Missing lookups do not allocate persistent buckets. Each accepted label is referenced by exactly one bucket, including inactive labels. The original predicates, array insertion order within every eligible comparison set, predecessor checks, queue, counters, resolver calls and cost arithmetic remain unchanged.

Eight targeted test groups pass. In addition to direct helper and transform checks, 200 randomized paired complete scheduled-engine runs compare the entire output, every accepted-label snapshot, each inactive-state transition, every heap pop and the exact resolver call sequence. Deterministic cases cover equality and boundary times, signed zero, finite-clock/NaN validation, same-time replacement, modes and transfer states. Cancellation oracles cover resolver exceptions with identical call/state prefixes and the full asynchronous router's existing pre-work and cooperative-yield cancellation points. Both production engine variants are exercised.

The buckets do not retain an old flat array alongside the new index. They add one Map per visited node and one array/Map entry per distinct pre-opening time, plus at most one post-opening array per node; every nonempty bucket contains at least one existing label. Labels, predecessor chains and route geometry are not duplicated. This storage belongs only to the current scheduled invocation and is not persisted in a graph or result cache. Its additional overhead still needs real-process assessment. The optimization preserves the full label count and cannot itself resolve an intrinsically excessive number of labels.

One existing limitation must not be used as a new proof premise: the outer opening list is built from graph edges, while inner `ft` also checks endpoint schedules. Likewise, the existing `ee` resolver memo omits departure/date only when the origin region has no graph edge with `access_time_id`; its condition does not independently test endpoint schedules. These are source-level observations, not a reproduced failure for the current OD36 graph. They reinforce retaining full endpoint/time semantics in any later reuse proposal.

## Read-only next design: reduce resolver calls with a certified goal bound

No implementation or real-graph experiment has been performed for this proposal.

### Prefer strict incumbent pruning before changing the queue

The existing scheduled heap orders by score, transfers, arrival time, then insertion sequence. Replacing it with A* changes expansion and insertion order and can change which exactly tied itinerary is returned. A safer first design retains that heap and all original tie-breaking. Use an upper bound only from a complete goal label already generated by the original `P` transition procedure. Skip a transition or expansion only when a certified lower bound on its final score is strictly greater than the incumbent score; equality must remain untouched.

An independently supplied physically feasible itinerary is not automatically an upper bound on this exact algorithm's output: it may not satisfy the algorithm's ancestor-state restrictions or may interact differently with its existing dominance rules. A same-run generated goal has already passed those rules. Once generated, its feasible witness remains an upper bound even if another goal later dominates it.

The lower bound should be consistent along every actual transition and monotone in every dimension used by same-node dominance. This gives a stronger equivalence argument than admissibility alone: a strictly rejected label cannot generate a potentially winning descendant, nor can it invalidate an unpruned label with a potentially winning score. Removing such work only compresses heap sequence numbers and does not change the relative insertion order of retained labels.

### Why the current floating lower bound cannot simply be added to score

In real arithmetic, the existing inner lower-bound preference cost does not exceed outer connection duration plus facility penalty. The lower bound removes lift waiting, charges zero for endpoint access, and omits the continuing-lift entry penalty. All preference multipliers are at least one. Outer `walkPenalty >= 1` adds further nonnegative cost.

However, inner route total minutes and individual leg minutes are independently rounded to six decimal places before the outer duration and facility penalty are computed. Two seconds, for example, becomes `0.033333 * 60 = 1.99998` seconds. The unrounded lower bound can therefore exceed the actual outer numerical duration. Reverse versus forward summation also changes floating-point grouping. A naïve `M(label) + cachedBound > incumbent` is not an exact-output proof, and an arbitrary epsilon is not an adequate repair.

### A conservative integer construction avoids that particular problem

One possible certified construction is deliberately weaker and uses arrival-time and walking dimensions separately; it ignores future transfer and facility penalties.

1. For a dynamic walk connection with known prepared topology and exact endpoint candidates, compute an integer-duration relaxation using `floor(max(0, (edge.duration_s - possibleLiftWait) * fraction))` per physical arc and zero for endpoint access. The usual destination/leaf decomposition applies, but this is an unweighted time bound, not the current preference-weighted cache value. For any actually selected path, each integer edge bound is no larger than the corresponding numerical traversal duration. Nonnegative floating additions preserve the invariant that accumulated duration is at least the exact integer sum, provided the integer range is certified. This remains true for either reconstruction addition order of movement and wait.
2. If L is that integer lower bound, transform it with the *same* monotone total-minute conversion: `floor(Number((L / 60).toFixed(6)) * 60)`. This gives an integer no larger than the actual outer walking connection duration, including the existing rounding. Unknown dynamic connections receive zero. Static connections can use the floor of their actual declared duration.
3. A pattern's ride arc must not use a duration measured at one chosen departure. Use timetable offsets while ignoring waiting and availability. For ordinary certified finite clock ranges with absolute rounding error at most half a second per absolute addition, the conservative integer `max(0, floor(arrivalOffset) - ceil(departureOffset) - 1)` is safe. The subtraction is over exactly represented integers and explicitly absorbs both absolute-time rounding errors. Uncertified ranges or offsets receive zero. Adjacent pattern stops can be used instead of all stop pairs: ignoring dwell and intermediate waiting only weakens the bound, and every actual long ride is covered by the corresponding adjacent path.
4. Compute two reverse integer potentials on this relaxed connection/pattern graph: minimum remaining elapsed-time cost T, and minimum remaining walking cost W. Pattern/non-walk arcs contribute zero to W. Ignore future transfer/facility costs. Integer accumulation must stay exactly representable; certify the graph/range or fall back to zero rather than guessing.
5. For a label h, form optimistic dimensions `timeLower = max(h.time, floor(h.time) + T[h.node])` and `walkLower = max(h.walk, floor(h.walk) + W[h.node])`. Keep its existing transfers and facility penalty. Evaluate the *original* score expression on those optimistic fields, in the original arithmetic order. Do not replace it with a reassociated `currentScore + potential`.

The integer per-transition certificates imply `floor(next.time) >= floor(time) + elapsedLowerEdge` and the analogous walking inequality. Reverse shortest-path potentials obey the triangle inequality, so both optimistic dimensions are nondecreasing along every actual transition. They are also no greater than the corresponding dimensions of every completed goal. The score is monotone because all its coefficients are nonnegative. Applying the original score formula therefore produces a numerical lower bound and maintains consistency without relying on an arbitrary floating tolerance. The same monotonicity follows under the original per-node dominance comparisons.

This is a proof outline for a guarded implementation, not a ready patch. The clock-range/offset certificates, graph preparation, exact integer arithmetic limits, duplicate connection IDs, cancellation and same-run incumbent handling all require explicit implementation and paired oracles. Nonfinite or otherwise uncertified cases must preserve the old search. In particular, `0 * Infinity` must never leak into the score; unreachable-node certificates should be handled separately from finite potentials.

The benefit also depends on a goal being generated early enough. Before another long run, measure the first generated goal, its score and the incumbent progression. If no complete goal exists for most of the run, strict upper-bound pruning will not help during that period; direct A* would then require an additional full tie-preservation design rather than being treated as a harmless cache change.
