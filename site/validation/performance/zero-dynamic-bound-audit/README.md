# Bounded, non-production incumbent-bound audit

The reviewed source/data are the frozen public v39 runtime `2e2fcf795897` from PR
commit `c58d810f4591df526ff15c0fa5f792dbaf43902b`. These scripts do not enable
production pruning. `REVIEW.md` records the supported-domain proof and its limits;
the subsequent passive 80-second observation is in
`../od36-current-shadow80-2e2fcf795897-od36-ordinary/`.

**Measured result:** the first observed 5,532 real expansions have zero strict
would-prune matches. The nonzero potentials are too weak to remove the measured
early hotspot. This does not support deploying the experiment or claiming a
speedup. Four usable candidates were unchanged and all five Workers exited.

## Reproduce small checks

From the public repository's `site/` directory, recover the exact ignored runtime
if needed (the public commit contains its full distribution):

```sh
mkdir -p validation/performance/runtime-2e2fcf795897
git archive c58d810f4591df526ff15c0fa5f792dbaf43902b:site/dist \
  | tar -x -C validation/performance/runtime-2e2fcf795897
node validation/performance/zero-dynamic-bound-audit/zero-dynamic-oracle.mjs
node validation/performance/zero-dynamic-bound-audit/scalars.mjs
```

The two-engine oracle reports 14 paired outputs/viable-state comparisons and 12
strict losing expansions skipped only inside the tiny experiment. Unknown
effectful/cancellation callbacks remain fallback. Its portable copy was rerun
successfully after packaging; no city route was searched.

`topology.mjs`, `prepared-state-bound.mjs` and `production-data.mjs` are independent
read-only input-preparation/data audits. They load the real frozen datasets and
can consume substantial memory; run them separately from other graph workloads.
The topology capture disables real walking and scheduled searches with sentinels.
Generated `topology.json` and `prepared-state-bound.json` are retained here.

The passive observer and its five focused tests live under
`tests/navigation/profile-goal-bound-observer*` and `profile-od36-buffer.test.mjs`.
No production heap, admission, label dominance, resolver call or search limit is
changed by those diagnostic files. The ten-second aggregation intervals and 80-second endpoint
are measurement boundaries only; production search remains uncapped.
