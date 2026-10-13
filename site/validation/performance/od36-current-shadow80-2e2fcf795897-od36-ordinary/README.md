# Passive OD36 bound observation: frozen 2e2fcf795897

One authorized 80-second ordinary OD36 observation, starting 2026-10-12 18:40:56 UTC, using the same 08:00 departure/date/coordinates and 384 MiB Worker cap. The copied probe only observes; it does not prune, alter labels, skip callbacks or change queue order. No CPU sampling, extension or retry. The current mutable fd323a distribution was not used.

## Result

The measured bound does not remove the early hotspot: at the last complete 10-second observer window (Dt +30.015 s), 5,532 actual expansions produced **zero strict would-prune matches**. The maximum virtual score was 8,582, below the best accepted-goal score 18,186.92919. No owner or label-domain check was unsupported.

The same window includes 20,486 resolver calls (28.492 s), 5,459 dynamic resolver calls and 5,437 uncached ft calls (26.187 s). All would-prune resolver/ft counts and durations are zero. Resolver time contains ft time; these hierarchical totals must not be added. Even nonzero passive counts would be original-trace potential upper bounds, because actual pruning changes memo eviction and replay.

This observer window ends about three seconds before route observation ends. The last ordinary progress at Dt +32.902 s records 15,225 retained / 14,491 active labels, 6,144 queue pops, 109 accepted goal labels and 341.3 MiB sampled Worker heap. The first accepted goal was at Dt +3.241453 s. These are generated goals, not completed optimal routes.

The 80.171-second route observation remains pending with four available candidates, all fields equal to the earlier 2e120 probe and to this run's 60-second checkpoint. Main exit is 0. Every created Worker W1–W5 emitted an exit event, with no worker-error. W5 exit code 1 follows the explicit observation-cleanup terminate call; it is not a production error or a NO_ROUTE result. The 110-second outer watchdog did not fire. Final process RSS was 1.067 GiB, peak 1.290 GiB. Node DOM stand-ins do not measure browser paint or real-journey acceptance.

## Finite evidence and reproduction

- `observer-summary.json`: all three 10-second snapshots, top20 node counters, owner validation, first goal, final finite progress, candidate comparison and exit evidence.
- `report.json` / `followthrough-report.json`: 60/80-second checkpoints.
- `stream-attribution.json`: streamed stage attribution.
- `goal-bound-topology.json`: exact parsed/reformatted topology embedded in this run. Its byte hash differs from the packaged source only because JSON formatting differs; parsed content is equal.
- Raw events and Worker lifecycle are excluded from the PR. Inactive logs are losslessly gzip-compressed, with decompression SHA256 checks and recovery commands in `../log-compression-20261012.json`.

The portable topology defaults to `validation/performance/zero-dynamic-bound-audit/topology.json`; `HK_PROFILE_GOAL_BOUND_TOPOLOGY` optionally supplies an explicit path. See that directory's README/REVIEW for the supported-domain proof and limitations. No evidence here supports deploying this experiment as a performance fix; later search and other ODs were not measured.

From the public repository's `site/` directory, the exact ignored runtime can be recovered from PR commit c58d810:

```sh
mkdir -p validation/performance/runtime-2e2fcf795897
git archive c58d810f4591df526ff15c0fa5f792dbaf43902b:site/dist \
  | tar -x -C validation/performance/runtime-2e2fcf795897
node --test tests/navigation/profile-od36-buffer.test.mjs tests/navigation/profile-goal-bound-observer.test.mjs
```

These five focused tests passed again after the portable input-path change. The actual observation was run once; the path-only change was not followed by another city search. The passive fixtures compare original and instrumented full results, accepted/pop traces, callback count/order/receiver and cancellation, including a synthetic branch where would-prune is nonzero but original execution still occurs.
