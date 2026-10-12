# Persistent walk-result cache: preserve clock and date

Status: narrow correctness repair and small-graph tests; integration/build belongs to the main task. This change does not enable the generated-goal experiment.

## Confirmed defect

The current `9e104c614b66` production bundles were loaded unchanged into memory. The Worker SHA-256 was `930d0abbe9e3f321ff263c114ac83c6dde68c47498daae14f8914964ae4092d6`.

The affected cache is the route-factory-owned `jt.ee` / `H` in `app-transit-worker-CaCMeUxU.js`, and `ft.X` / `z` in `intermodal-routing-D8vKT-lN.js`. Its FIFO capacity is 512 and it survives multiple public `router.route()` calls. It is **not** the per-query, full-clock connection/evidence memo repaired by `repair-route-memory.mjs`.

Its old key included the clock and date only when the origin region contained a graph edge with `access_time_id`. However, the underlying walk engine also validates request origin/destination opening rules. A region without scheduled graph edges does not imply time-independent endpoints.

Both actual public routers reproduced the following on a two-node, ten-second, unscheduled walking graph and an unchanged destination open during `[100,200]`:

| Calls on one owner | Warm result | Fresh owner at second departure |
| --- | --- | --- |
| 0, then 100 | arrival 200.00002 | arrival 110.00002 |
| 100, then 250 | CONDITIONAL, arrival 260.00002 | NO_ROUTE |
| Monday 100, then Tuesday 100, weekly Monday-only rule | CONDITIONAL | NO_ROUTE |

The second and third cases incorrectly reuse an open-destination route after closing. No mutation, arbitrary callback, or private resolver invocation is needed to reproduce them.

## Exact repair and boundary

Worker key: `JSON.stringify([i,m,v,U,K])`.

Module key: `JSON.stringify([e,i,m,R,E])`.

The complete original endpoint objects and preference remain in the key; only conditional omission of the original full-precision departure and date is removed. No rounding or time bucketing is introduced. Endpoint `access_schedule`, `access_time_id`, exact `node_id` / `node_ids`, and other JSON endpoint fields were already included and remain included. In-place changes to a plain endpoint's nested schedule produce a different serialized key; the source request is not modified.

The owner, FIFO capacity/order, result construction, graph preparation, constraints, errors, callback execution and cancellation checks are unchanged. Same-endpoint, same-clock, same-date requests still hit the cache. Time-independent endpoints may lose cross-clock hits; that is a deliberate conservative correctness choice. Invalid clocks/dates remain rejected before they can populate this cache. The contract is the existing controlled plain-JSON endpoint domain, not arbitrary proxies or non-enumerable getters.

`scripts/repair-walk-cache-clock.mjs` patches exactly one key in each recognized engine, is reversible/idempotent, retains other repair layers, and rejects missing/duplicate/mixed/unmarked anchors. Its restore function lets future tests recover the known-bug baseline even after production integration. The two runtime assets and build pipeline were not edited by this task.

An additional in-memory check confirmed that this repair commutes with both `patchRouteMemory` and `patchScheduledLabelBuckets` on both current assets, so their integration order does not change the resulting source.

## Small-graph verification

Run:

```sh
node --test --test-concurrency=1 tests/navigation/walk-cache-clock.test.mjs
```

The oracle uses both complete production router implementations. It reproduces the old bug, then compares repaired warm results against full cold results before/during/after opening, in both query orders. It covers origin and destination rules; weekly date changes; same-clock schedule mutations; exact source-node restrictions; missing, unknown and malformed rules; distinct full-precision fractional clocks; same-key hits; invalid inputs; request nonmutation; and cancellation before work and at the original cooperative yield. The walk-call counter is added only in the in-memory test copy below this owner cache.

Some returned clock fractions reflect existing six-decimal minute rounding, including a different-schedule fixture whose modeled arrival is 299.99998 for an opening at 300. This repair preserves the cold engine's result; it does not claim to resolve that separate numerical boundary.

## Generated-goal follow-on remains unproved

The observed early OD36 goal makes incumbent bounds worth investigating, but this cache defect previously invalidated any claim that skipped production resolver calls were harmless. Fixing this key removes this specific history dependence; it does not prove all caches, evidence replay, exceptions, aliases, or cancellation skip-invariant.

Nonnegative current score alone cannot prune useful work before the original heap pops an already-generated goal. A useful candidate still needs a positive, consistent remaining-cost bound. A relaxation may assign every dynamic connection a zero time/walk weight while retaining certified static/pattern integer weights, but arbitrary resolvers must fall back. Duplicate-ID alias semantics and subsecond dynamic durations also prevent reusing the existing static experiment's numeric certificate unchanged. No generated-goal optimization is adopted here.
