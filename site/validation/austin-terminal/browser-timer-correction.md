# Browser timer-budget correction

Completed 2026-10-13 15:53:18 UTC / 23:53:18 Beijing.

The final v52 browser check reached the correct “完整行程 · 来源连接缺失” refusal, but was visibly still comparing at 17.2 seconds in a foreground retry and first observed complete at about 96.8 seconds. These are observation timestamps, not a precise profiler measurement. The source endpoint gate did fire; no change to endpoint identity or reachability proof is needed.

## Root cause

The checkpoint reset its 4 ms work budget immediately before yielding. After a browser timer resumed, the elapsed calculation included the event-loop wait. A 4 ms wait therefore exhausted the next work budget before useful work started. The next check, at only 64 records, yielded again instead of allowing up to 2,048 records. This feedback multiplied the task count.

HTML explicitly clamps sufficiently nested timers to at least 4 ms and does not guarantee exact delivery times: [WHATWG timer specification](https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html). The correction retains the existing timer scheduling and cancellation mechanism; it resets the work clock on resumption. It does not introduce another scheduler, cache, connector, anchor or endpoint substitution.

## Reproduction with actual UI-generated endpoints

The unchanged production s2(Q,L1,I1,z) function produced the selected D2 and F stair search results with the canonical portal IDs, exact single source node IDs, matching 3D coordinates and no multi-anchor fields. Both old and corrected helpers return the same seven-node terminal proof.

The deterministic simulation advances performance.now only while awaiting the task continuation, so it isolates waiting from proof CPU work:

| Simulated wait per task | Old task yields | Corrected task yields | Old total wait | Corrected total wait |
| --- | ---: | ---: | ---: | ---: |
| 0 ms | 802 | 802 | 0 ms | 0 ms |
| 4 ms | 25,656 | 802 | 102,624 ms | 3,208 ms |
| 100 ms | 25,656 | 802 | 2,565,600 ms | 80,200 ms |

This explains the browser discrepancy; it is not a new real-browser timing claim. Slow or background scheduling can still delay completion. UI-thread task execution remains cooperatively budgeted at 4 ms with checks every 64 records and an absolute 2,048-record cap, subject to individual-operation and garbage-collection latency.

## Verification

All 19 helper tests passed: the previous 17 safety tests plus deterministic 0/4/100 ms waits with cancellation and actual 5 ms timer tasks with cancellation. Existing modal snapshots, immutable-source checks, request snapshots, generation checks and fail-through behavior are unchanged.

The helper patch changes only createCheckpoint. The two tests are appended to the prior suite. Production integration and a real-browser repeat remain the release gate; the earlier Node ~2 second measurements do not establish browser latency.
