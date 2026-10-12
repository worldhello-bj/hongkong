# Reverse lower bounds: exact dependencies and reuse opportunities

Static analysis of frozen runtime 34c1eabb21cf, app-transit `ft`, plus the emitted trace. No production change or new routing test is performed here.

## Original construction

For a timed query, the full cache key is JSON `[request.origin, request.destination, request.mode]`. The prepared index `d` already belongs to one graph and preference. On a miss, the engine seeds `i = Map([[O, 0]])`, then scans `d.adjacency` followed by the request overlay `y`. For each arc D:

- Walk mode excludes `rail`, `transfer` and `station_access`; other modes use all prepared arcs.
- Access-side arc weight is zero.
- Other weights are exactly `preferenceCost(edge, max(0, (duration_s - liftWait) * fraction), preference, {continuingLift:true, fraction})`.
- The reverse bucket indexed by `D.to` appends `{from:D.from, seconds:weight}`.
- A priority queue runs backward from O. Relaxation computes `current.cost + arc.seconds` and updates only on strict `<`; stale entries are checked with exact numeric equality.

Opening waits, date and departure are deliberately absent from this optimistic static lower-bound weight. They still affect the actual forward search. `kt(edge)` uses frozen lift identifiers, ride wait metadata and a fixed verified-lift table; it has no clock dependency.

The 446.06 s measured construction block combines adjacency scanning/allocation and Dijkstra. Existing timing does not establish how much belongs to each.

## Lowest-risk reuse: prepared base reverse adjacency

The base reverse adjacency is a pure function of the prepared graph/preference index and whether mode is walk or all. It can be built once per such index/mode, using the **existing d.adjacency iteration order**, exact weight expression and original arc multiplicity. Do not switch to raw graph-edge iteration, sort buckets or deduplicate arcs.

Each query independently builds the small reverse overlay from `y`. During Dijkstra, visiting the cached base bucket first and the overlay bucket second reproduces the original concatenated reverse bucket order exactly: the original construction scanned all base arcs before all overlay arcs. Never append an overlay directly into the cached base arrays.

This changes neither full cache keys, computed distances, forward search, labels nor time dominance. The cache owner must be the same prepared index, with at most walk/all variants; graph replacement or another preference requires a different owner. It adds persistent index memory but removes repeated temporary base adjacency objects. Bytes saved versus retained cannot be inferred without measurement. It still reruns Dijkstra on every remaining-cache miss.

## Destination core sharing: what is independent of origin

For `p=false`, synthetic B and O are allocated before origin/destination candidates. Their names avoid every real graph node ID. The origin overlay consists only of:

1. B → an origin candidate (a real exact node or a new synthetic snap node), access lower-bound cost zero.
2. Synthetic origin candidate → real arc endpoint, for an origin partial-edge continuation.
3. Synthetic origin candidate → destination candidate, for a same-physical-edge directed shortcut or zero-fraction coincidence.

No real node has an edge into B or a synthetic origin candidate. The base graph contains no such synthetic IDs. Consequently, no forward path starting at a real node can use an origin-only arc. Equivalently, origin synthetic vertices are terminal leaves/ancestors of leaves during the backward computation: their distances cannot improve any real node or destination-core vertex.

A core built from base arcs plus destination-only overlay can therefore provide the same real-node and destination-candidate distances across different origins, under these structural conditions. The trace contains 116 full OD keys but only **37 exact `[destination, mode]` keys** in its single timed regional index. If all guards pass and the core cache covers these keys, the observed trace needs 37 first-use core Dijkstra builds rather than 2,185 full-key miss builds. This is an opportunity count, not a measured speed result or a guarantee about unobserved future requests.

## What must remain request-specific

B and synthetic origin-candidate distances must be reconstructed from the current origin overlay, including directed same-physical-edge shortcuts. Reusing the old complete Map after merely removing origin from its key is incorrect: it can carry another origin's candidate IDs, fractions and B distance.

Use the identical floating arithmetic order and strict comparison in leaf reconstruction. A destination core alone must not turn missing distances into zero, infer a path from coordinates, drop one-way restrictions or reuse previous-origin access evidence. The old full key can remain as a compatibility cache, but it must not be confused with the core cache when measuring misses.

## Exceptions and guards

- **p=true:** `O=B`, and the query overlay is not constructed. Its seeded synthetic-only bound is a different case and should use the unchanged algorithm.
- Reject/fallback if any proposed origin-only synthetic ID is a real graph node, has an unexpected incoming real/core arc, or participates in an unexpected overlay topology.
- Preserve original exact-node and multi-node anchoring, preference-filtered snaps, mode filtering and synthetic ID collision handling. Do not coalesce XYZ points by XY proximity.
- Core ownership must include prepared graph identity and preference. The key must retain destination semantics and mode; do not share across official/demo graphs or assume equal node counts imply identity.
- Destination snap selection is independent of origin for the normal `p=false` path. The accessible filter's `!p` condition is another reason not to mix same-point and non-same-point paths.
- If a future engine adds real → origin-synthetic arcs or permits origin overlays to connect core vertices, this proof no longer applies. Fail closed to the original construction instead of assuming the shape.

## Required next validation, not claimed complete here

Paired actual-engine tests should force different origins to the same destination, exact and multi-node anchors, same-physical-edge forward/reverse cuts, zero fractions, identical/same-point endpoints, synthetic-looking real IDs, disconnected nodes, all preferences, lift ride semantics, dates/opening waits and non-FIFO cases. Cache-owner isolation and fallback paths require explicit tests.

The next attribution must independently count and time base reverse construction, destination-core lookup/build, origin-leaf reconstruction, and legacy full-key cache hit/miss. A legacy full-key miss is not evidence that the new core Dijkstra ran. No scheduled-search dominance rule needs to change for either optimization.
