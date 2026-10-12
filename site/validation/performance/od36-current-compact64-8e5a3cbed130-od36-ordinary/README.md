# OD36 ordinary, compact lower-bound cache 64 / 16 MiB: negative terminal result

This is one serial run against the hash-verified immutable `8e5a3cbed130` runtime. It uses the actual S1 entry and actual Worker engines with the unchanged 384 MiB Worker old-generation limit, fixed 2026-10-12 08:00 departure and original OD36 request. No CPU sampling. DOM stand-ins do not establish browser layout/paint acceptance.

## Original 60-second checkpoint

- First candidate: 1.926 s; public comparison: 7.542 s; taxi comparison: 12.079 s.
- Five Workers; peak process RSS 1.351 GiB.
- Four available candidates; detailed transit still pending.
- Detailed timed walk lower bounds: 324 lookups, 276 hits, 48 misses / 48 distinct keys, no eviction; 10.630 s in reverse-bound construction.
- Actual lower-bound capacity 64, retained typed arrays 10,729,680 bytes at this checkpoint.

## Same process beyond 60 seconds

The UI stopped running at 118.449 s **because detailed Worker 5 exhausted its 384 MiB heap**, not because the route computation succeeded. The recorded error is `Worker terminated due to reaching memory limit: JS heap out of memory`. Detailed transit failed after 81.488 s; the subsequently attempted pure walk took 2.584 s and did not establish a complete route. The UI's `state: complete` means task settlement here, not successful navigation. The final process created six Workers.

The last scheduled-search progress sample before OOM had 9,548 retained / 9,098 active labels, 3,840 pops, queue 5,708 and 13,403 connection-resolver calls. HeapUsed was 380,403,920 bytes; the last completed walk-query event reported 396,765,832 bytes. These points are GC-sensitive measurements, not retained-size attribution.

Up to the terminal observation, timed walk subqueries made 1,107 lower-bound lookups: 956 hits, 151 misses, 90 distinct keys, 87 evictions and 61 repeated constructions. Reverse-bound construction consumed 51.436 s. Among 1,106 completed timed walk calls, total wall time was 60.801 s: search loops 4.389 s, temporal preparation 3.020 s, reverse preparation 51.465 s, other residual 1.927 s. One additional query had begun but had not completed.

After the first 60 seconds there were 103 misses, comprising 42 new keys and 61 repeated constructions. The working set grew beyond the 67 distinct keys measured in the earlier 32-entry run; the maximum observed reuse distance reached 87. Increasing capacity alone did not solve memory or terminal latency and was not repeated blindly.

## Preserved evidence and interpretation

The four already-returned candidates keep their earlier precise minutes, fare and mode sequence. This does not validate still-pending or failed alternatives. `comparison.json` records those exact comparisons; `followthrough-report.json` and `followthrough-attribution.json` retain the failure and wall-time partition. `cache-simulation.json` is offline evidence, not a new routing run.

Subsequent statistical heap sampling and static retention analysis are in the separate heap-sampling report. No OOM result has been relabeled NO_ROUTE or successful completion.
