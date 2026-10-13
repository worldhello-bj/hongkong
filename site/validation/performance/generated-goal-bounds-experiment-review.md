# Generated-goal bound experiment: not adopted

Status: reproducible, static-only small-graph experiment. It is absent from the build, no production asset was changed, and the transform CLI refuses to write runtime files. It is **not an OD36 improvement**. The current production routers always pass `resolveConnectionAt`, for which this candidate deliberately executes the original search unchanged. Whether OD36 generates an early usable incumbent is still unobserved in the old traces.

Files:

- `src/navigation/generated-goal-bounds.js`
- `scripts/repair-generated-goal-bounds.mjs`
- `tests/navigation/generated-goal-bounds.test.mjs`

Run only the small reproductions:

```sh
node --test --test-concurrency=1 tests/navigation/generated-goal-bounds.test.mjs
```

## Scope and useful negative results

The experiment preserves the original scheduled heap, its score expression and tie order. It observes a goal only after the original insertion procedure has accepted and queued that label. It skips an expansion only after the original settled assignment and only when a certified final-score bound is strictly greater than the best generated-goal score. Accepted labels remain in their original buckets; no insertion, dominance predicate, ancestor rule, resource charge or clock is changed.

Current-score-only pruning cannot reduce these expansions: a finite-score queued goal, or its no-worse dominating replacement, will be popped before a label with a greater current score. A useful branch bound needs an additional remaining-cost potential.

An arbitrary resolver defeats both duration and observability assumptions. Its returned duration may be smaller than the declared connection duration. It may also throw or cancel on exactly the branch a candidate would omit. No change that skips such a call can preserve arbitrary callback call prefixes. Therefore resolver presence disables the whole experiment; it is not assigned a guessed positive bound or asserted to be pure.

## Numerical certificate

The supported domain is ordinary, data-only network objects, not proxies or effectful JavaScript objects. Unknown numeric/topological/validation cases decline the optimization and retain the old algorithm. Inputs already rejected by the old preparation code are still rejected there, before this helper is created.

- Departure and horizon end must be finite and have magnitude at most 2^40. The existing horizon limit remains seven days. Cost coefficients and per-connection preference penalties are finite and at most 2^40.
- Static positive connection durations must be at least one second and at most 2^40. Zero duration is supported only for walking connections with zero preference penalty. Subsecond positive connections, zero-duration boarding/penalty transitions, and other uncertified cases use the old search.
- Static connection geometry is checked with the original engine's point predicate. Invalid geometry disables optimization, so a skipped expansion cannot hide the old delayed validation exception.
- Pattern data, shapes and provenance must be usable ordinary data. Actual already-prepared trip times must lie in the finite clock range. Every adjacent ride advances the floor of the absolute clock by at least one; actual dwell is nonnegative. Unsupported patterns disable optimization.

For a static edge, the elapsed integer weight is `floor(durationS)`. Its walking weight is that value for a walk and zero otherwise. For a pattern adjacency, the elapsed weight is the minimum, across the already-prepared trips, of `floor(actual next arrival) - floor(actual departure)`. Its walking weight is zero. Waiting and future transfer/facility penalties are ignored.

For an accepted static transition, monotonic correctly rounded addition gives

`floor(next.time) >= floor(time) + floor(durationS)`.

The right-hand addition is exact in the certified range. The analogous walking inequality holds. Pattern adjacency bounds telescope over any actual longer ride, since intervening dwell is nonnegative and boarding happens no earlier than the label clock. Thus every actual transition is represented by a relaxed path whose integer cost does not exceed the corresponding change in the floored resource.

Two reverse shortest-path potentials are computed independently: remaining elapsed time T and remaining walk W. All values saturate at 2^30. Omitted/unreachable entries mean that same cap, **not zero**. Saturation preserves the triangle inequality, including edges into omitted nodes, and intermediate integer sums are at most 2^31.

At a label, optimistic resources are:

`timeLower = max(time, floor(time) + T[node])`

`walkLower = max(walk, floor(walk) + W[node])`

Transfers and facility penalty are unchanged. The original score function evaluates this virtual label, in its original arithmetic order. The code never reassociates this as current score plus a scalar estimate, and never multiplies zero by an infinite potential.

Every positive resource-changing transition advances floor(clock) by at least one. There are fewer than 2^20 such transitions in an accepted path. Within the certified clock/horizon range, an accepted static duration is below 2^20; the tighter seven-day values leave cumulative walk, including rounding, safely below 2^39. Consequently the integer additions in the virtual dimensions are exact below 2^41. Facility totals stay below 2^61 and scores below a conservative 2^81, so NaN/infinite heap scores cannot invalidate the ordering proof. Zero walking transitions change none of these numeric resources.

## Ordering, dominance and ancestry proof

The virtual resources are componentwise lower bounds on every completion. They are also nondecreasing along each actual transition by the integer triangle inequalities. At the same node they are monotone in all dimensions used by original dominance. The score is monotone in those dimensions because its coefficients are nonnegative and the original evaluation order is retained.

Therefore a label above the incumbent bound cannot produce a label that could beat or tie that incumbent. Neither it nor a descendant can dominate a potentially winning label: such domination would imply a no-greater lower bound. Removing those expansions cannot remove a potentially winning label through a new dominance interaction. Remaining insertions retain their relative order, including all exact ties. Existing ancestor restrictions do not weaken this argument because the potential does not depend on predecessor history.

An accepted goal is a witness from this exact search, not merely an external physically feasible itinerary. If it becomes inactive, its dominating accepted goal has no greater original score and remains a witness, recursively. The experiment never rejects equality and never prunes the goal pop itself.

## Reproduced counterexamples

1. **Pruning equality changes the tie winner.** Direct metro 20 is generated first. Walk 1 plus walk 9 at walking weight 2 also scores 20 but arrives at 10. The original heap returns walking; a `>=` bound returns metro arrival 20.
2. **Unrounded inner duration overestimates the numerical outer duration.** Two seconds converted through six-decimal minutes becomes 1.99998. A route of 2 + 1.99998 beats direct 3.99999. Using an unrounded remaining bound of 2 prunes that actual winner.
3. **Admissibility without dominance consistency changes even the score.** A label with no ancestor-legal completion nevertheless produces a later label that dominates another history's useful state. Skipping that dead-end expansion removes the dominance and changes the original result from score 10 to score 6. An admissible history-aware infinity bound is therefore insufficient for exact-output preservation.

The tests exercise both complete production scheduled engine implementations, including their actual heap. They compare complete results and every accepted state whose certified final-score bound could still match the final answer, including its final active/settled status. There are 240 randomized paired static queries, with 176 losing expansions actually removed. Additional fixtures cover signed zero, fractional and large positive/negative clocks, saturated/unreachable states, zero-cost cycles, inactive labels, mode filtering, scheduled trips, NaN/infinity/geometry fallback, arbitrary shorter resolver durations, and exact resolver-cancellation prefixes on the fallback path. Full outer asynchronous routers are checked for unchanged output and the existing pre-work/cooperative-yield cancellation points; they remain fallback-only.

An independent read-only review found no numeric, dominance, ancestor or tie defect within this static certificate. This is not a proof or validation of the currently unsupported production resolver domain.

## Minimum missing production contract

First use the already-prepared scalar probe to determine whether a complete goal is generated early enough to matter. No such evidence can be inferred from a lower-level walk success, another owner's route candidate, or old progress events.

If an incumbent exists early, a useful production version would need all of the following before any runtime change:

1. An internal resolver descriptor, attached by the actual route factory, identifies fixed graph/preference/mode and full origin/destination requests for every connection. Duplicate connection IDs and request-time graph selection must preserve existing alias semantics. Unknown connections receive zero, which weakens the potential while retaining the graph arc; unsupported resolver effects disable pruning.
2. A duration/walk certificate covers **all** possible departure times, closures, endpoint opening rules, no-wait cases, lift waiting and actual output rounding. The existing preference-weighted reverse bound is not that certificate. Even in fast mode its unrounded fractional sum can exceed the separately rounded outer duration, and reverse versus forward addition grouping differs.
3. The smallest plausible graph reuse is the same exact endpoint overlay/preference/mode topology, with a separate integer **duration** relaxation, not the existing preference cost values. Floor each certified physical movement duration before accumulation, retain zero-cost access, and apply the original total-minute rounding monotonically before deriving the integer outer-connection bound. The prepared graph owner and destination/leaf decomposition could be shared, but weights and numeric proof must be independent. No current code exposes that all-departure integer contract.
4. A production-only purity/totality and cancellation contract must make skipped resolver calls unobservable except for work saved. Existing memo/evidence eviction and replay must still reconstruct exactly the selected itinerary. Cancellation polling is part of that contract; arbitrary callbacks cannot opt in by assumption.
5. Combined small-graph oracles must cover the real route factory, integer certificate, invalid inputs, evidence replay, aliases and cancellation before one authorized real-query comparison. A changed heap/A* order requires a separate full tie-preservation design.

Recommendation: publish only the already-proven hotspot and endpoint fixes this round. Keep these files as explicit reproductions and proof boundaries, excluded from production build/deployment. Do not claim a measured OD36 benefit from this experiment.
