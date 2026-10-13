# Guarded snapping cache: source-height dependency

This is a narrow correctness follow-up after public v39, not an OD36 speed claim.

The four real walking implementations cache candidate snaps by mode, region and
exact XY. When `hkDemoSnapGuard` is enabled, the candidate loop also filters by a
finite `endpoint.demoSourceCoordinates[2]`, with the existing one-metre vertical
tolerance. The old key omitted that dependency. In the real router with a real
land/water guard, a two-node zero-height source graph reproduces a warm height-10
request incorrectly reusing the height-zero candidate, while a cold height-10
request returns `NO_ROUTE`. Warming in the opposite order also hides a valid
height-zero candidate. No invented geometry or city-size search is needed to
reproduce it.

The repair changes only guarded candidate keys: append the original finite
source-height number, otherwise `null`. Without the guard, the original key is
retained byte-for-byte. Missing, null, NaN and infinite height still mean no
height filter; signed zero remains equivalent. Region, graph, preference and
geography/barrier context remain owned by the same prepared index. Explicit
node/node-set requests take their existing exact-node branch instead of this
candidate search. This does not alter the tolerance, source graph, geometry,
duration, fare, accessibility policy or route algorithm.

The current UI does not produce this legacy auxiliary height field. Requests
that honestly retain XYZ are also protected by the final endpoint validator.
Thus the observed defect is a latent router/API cache inconsistency, not a
reproduced current-UI Pacific Place failure. The formal OD36 graphs have no demo
guard; their keys and behavior are unchanged.

## Verification

- Ten new tests cover all four actual candidate implementations, both warm
  orders, exact tolerance boundaries, same-height cache hits, nonfinite/missing
  heights, unguarded original keys and request preservation.
- A full actual mobile-router oracle uses the real geography guard and compares
  complete warm/cold route outputs for both height orders.
- The transform is reversible, idempotent, layered and rejects anchor drift.
- Built runtime `fd323a328ba2`: 25 focused tests pass (new cache, safe demo snap,
  modeled height and the separate full clock/date cache repair).
- The local aggregate passes 273/273, zero failures/cancellations/skips, in
  273.362 seconds. Three later-added passive-observer tests are a separate focused
  pass, not silently counted in that earlier glob. Exact-head remote CI with the
  final complete test set must pass before release.

Production search pruning is not part of this change. The independent
zero-dynamic-potential investigation remains observational until its complete
production contract and benefit have been established.
