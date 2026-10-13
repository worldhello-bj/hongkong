# Static retention audit, runtime 8e5a3cbed130

This audit reads the frozen app-transit Worker and the corresponding main-thread intermodal bundle. It explains references; it is not a dominator tree or an exact retained-byte measurement. See the adjacent sampling report for statistical allocation-site sizes and its limitations.

## Scheduled labels

`Dt.P` allocates a label containing scalar node/time/walk/transfers/penalty flags, this-hop `legs`, `previous`, `active` and `settled`. It does not copy the full predecessor path or append a full-path tie string. A transit candidate can allocate a shallow shape slice for that hop before dominance acceptance. Per-node `u` arrays retain inactive labels, and descendants can independently retain their predecessors. Queue entries reference labels rather than copy them. The accepted-label allocation frame was approximately 0.938 MiB in the sample, insufficient to identify it as the principal heap owner.

No proposed cleanup may delete an active state or a predecessor reachable from a descendant. This iteration does not prune these arrays or change dominance.

## Full walk-result references

- Each route-local `ae` maps the exact JSON key `[connectionId, departureS]` to a resolved connection or `null`.
- Dynamic `Ht` connections include `route`, referencing the entire walk result.
- The paired `_e` uses the same key and retains `{legs, features, warnings, route}` for final selected-leg reconstruction. Those arrays and the result are shared references, not independent deep copies.
- The router's `H` walk-result memo is already bounded to 512 entries. Its eviction does not release a result still referenced by `ae`, `_e` or the station memo.
- `Lt.s` is an unbounded memo keyed by `[from, to, preference, departureS, departureDate]`. It stores complete station-walk results or `null`. Invalid endpoints return before memo insertion.

`ae` and `Lt.s` are deterministic result memos under frozen inputs, but `_e` cannot simply be deleted: original reconstruction first looks it up and otherwise falls back to static `ge`. A dynamic connection's static fallback can have stale clock-dependent evidence. Safe bounded retention therefore pairs `ae` and `_e` eviction and recomputes an evicted selected dynamic leg using its original connection, exact floating departure, unchanged preference/date and resolver, then retrieves fresh evidence. Cancellation and a failed recomputation must propagate. Connection IDs are not globally validated unique; ambiguous duplicate IDs need their original memo alias behavior preserved rather than arbitrary first/last-ID replay.

The new `route-memory.js` helper implements this paired policy and an independent station memo. It retains ambiguous-ID entries and bounds normal unique-ID entries to 64; the attribution probe records actual duplicate/pinned counts. The helper never deletes label or predecessor state. Unit and actual-engine paired oracles are in `tests/navigation/route-memory.test.mjs`.

## Prepared graphs and isolated EXACT portals

`Ae` validates and recursively freezes an input in place. It is not a deep clone. Worker input transfer performs structured cloning separately. Derived regional graphs create new containers but share source node/edge objects within that Worker.

`Lt` restricts derived edges to official CSDI-INDOOR edges while keeping every regional node. In the measured detailed route, large street-containing regions therefore generated tens of thousands of synthetic `EXACT:` portals with no incident indoor edge. The sample directly attributed 6.941 MiB to these synthetic object allocations; `bt` also creates portal Maps and arrays.

Exact endpoint lookup `at` first checks the node portal and then requires a matching `portalEdges` entry. A node with no retained incident edge necessarily returns no snap whether its isolated portal object exists or not. Preserving all original nodes and `nodeIds` also preserves missing-connection diagnostics and synthetic endpoint-ID collision behavior. The new helper omits only synthetic portals for nodes with no incident retained edge; it does not filter incidence by preference, open time, disability or mode. Nodes, edges and their relative order remain unchanged.

## Conservative scheduled-search boundary

The scheduled engine's pre-opening-time dominance remains deliberately conservative. A distant opening rule can extend the global last-opening boundary and preserve labels at different times. It is not justified to relax that rule merely because nested walking is FIFO: the resolved walk duration can include waiting for opening, and the scheduled engine counts that duration in its walk-weighted score. An earlier arrival plus waiting can therefore have different current walk-cost semantics. This iteration does not change that algorithmic boundary.
