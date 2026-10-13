# OD36 ordinary: bounded route-result memory, runtime 34c1eabb21cf

## Result

**No Worker OOM was recorded during 600 seconds, but detailed transit was still pending at the observation limit.** This is a memory-retention improvement over the prior 118-second Worker heap failure, not a completed OD36 performance fix. Pending was never converted to NO_ROUTE, and the 600-second observation limit was not added to production.

One process ran from 15:31:14 to 15:41:22 UTC with the original 384 MiB Worker old-generation cap. The original 60-second report and a separate 120-second report were retained before extending the same process. The exact departure, OD36 coordinates, ordinary preference and production search constraints were unchanged. The frozen runtime manifest verifies all 113 files / 58,447,381 bytes against dist before and after copying; mutable dist was not hardlinked.

## Scope and concurrency caveat

The runtime contains bounded paired connection/evidence memoization, selected dynamic evidence replay, bounded station-result memoization and sparse indoor synthetic portals. The parent also incorporated endpoint-completeness and background-error status fixes. Full-engine original/new fixture oracles separately isolate the memory transform.

The run label reflects an intended exclusive window. Parent coordination later identified a an unrelated workload regression overlapping this run until **15:33:40 UTC**; see `execution-context.json`. Early wall times must not be presented as a strict exclusive-host speed A/B. The shell PID namespace cannot establish an exhaustive host process inventory. A previous interrupted attempt is preserved in a separate directory with exit 137 and no durable 60-second result; no V8-heap diagnosis is inferred for that attempt.

## Preserved checkpoints

| Observation | State | Workers created | Current process RSS | Latest detailed scheduled-label sample |
|---|---|---:|---:|---|
| 60 s | Detailed transit pending | 5 | 1.202 GiB | 6,355 retained / 6,012 active; heap 315 MiB |
| 120 s | Detailed transit pending | 5 | 1.111 GiB | 12,138 retained / 11,490 active; heap 344 MiB |
| 600 s | Detailed transit pending | 5 | 1.155 GiB | 32,884 retained / 32,032 active; heap 336 MiB |

Peak process RSS was 1.368 GiB. Intermediate Worker heap readings varied with GC, including samples above 370 MiB followed by lower readings; no exact retained-size attribution is claimed. The final scheduled sample had 13,312 pops, 19,572 queued labels and 54,333 connection-resolver calls. It precedes the terminal observation by approximately four seconds.

First candidate appeared at 1.885 s; public comparison took 8.024 s and taxi comparison 14.912 s in this particular run. The earlier four candidates retain their exact minutes, fare and mode sequence through 600 seconds and match the prior compact64 run. Endpoints and known forbidden-edge checks remain unchanged. These checks do not establish a valid unreturned detailed route, browser visual acceptance, or verified XYZ accessibility.

## Bounded memo and sparse portal evidence

The detailed request contained 307 fixed connections and **zero duplicate connection IDs**. Both its paired connection/evidence memo and station-result memo stayed at 64 entries; no pinned duplicate-ID exception was exercised. At the last scheduled sample:

- Paired memo: 54,333 lookups, zero hits, 54,269 evictions, 64 connection entries and 64 evidence entries.
- Station memo: 8,608 lookups, two hits, 8,542 evictions, 64 entries.
- Entries holding full walk results were released by memo eviction without deleting labels or predecessor links.

The detailed indoor derived graphs retained every node and retained edge, while generated EXACT portals changed as follows:

- HUH: 947 nodes, 1,948 edges; 947 → 945 portals.
- AUS: 34,363 nodes, 1,447 edges; 34,363 → 678 portals.
- ADM: 27,512 nodes, 2,745 edges; 27,512 → 1,300 portals.

Thus 59,899 useless synthetic portal objects were omitted in this Worker. This is an object count, not an inferred byte saving.

The whole run recorded selected-evidence replays in already-completed base/demo requests. Detailed W5 had not reached its final reconstruction, so this OD itself cannot yet verify that selected detailed output. Separate forced-capacity actual-engine tests cover successful reconstruction after eviction.

## Remaining wall-time attribution

Up to the 600-second cutoff, 9,623 completed timed walk calls consumed 506.150 s:

- Reverse lower-bound preparation: **446.383 s**, including 446.061 s constructing/cache-inserting bounds.
- Walk search loops: 32.201 s.
- Time-semantic preparation: 18.515 s.
- Other walk-call residual: 9.052 s.

The still-running scheduled search had elapsed 556.141 s. Subtracting its direct nested walk calls (including partial spans) and graph preparation left only 9.272 s of scheduled-engine/other wall-time residual. These are nested wall-time partitions, not CPU samples. The reverse-bound block includes both reverse adjacency preparation and Dijkstra; this probe does not separate those two operations.

All timed bound lookups in detailed W5 belonged to the 27,512-node / 60,514-edge regional graph. There were 9,623 lookups, 7,438 hits, 2,185 misses, 2,121 evictions and **116 distinct exact keys**. Thus 2,069 misses rebuilt an already-seen key. No time-dependent query keys were canonicalized or merged.

## Working set and offline simulation

Distinct keys at 60 / 120 / 180 / 240 / 300 / 360 seconds were 52 / 100 / 111 / 114 / 114 / 116. The set remained at 116 through 600 seconds. The maximum observed reuse distance was 115 distinct other keys. The fixed 307-connection request gives a conservative upper bound of 307 resolver OD pairs; it does not prove that all those pairs require timed bounds, or that 116 is the full future working set.

Offline FIFO replay matches every actual 64-entry hit and eviction:

| FIFO entries | Hits | Misses | Peak compact-array MiB on observed trace |
|---:|---:|---:|---:|
| 64 | 7,438 | 2,185 | 13.643 |
| 96 | 8,953 | 670 | 20.465 |
| 128 | 9,507 | 116 | 24.729 |

128 entries cover this observed trace without eviction, requiring 11.085 MiB more compact-array storage than 64. These bytes exclude shared node-index Maps, synthetic extras, graph objects and transient construction. This is offline evidence only: no production capacity was changed and no new routing run was performed. It does not establish a completion time or an unobserved future key count.

## Verification and reproduction

`tests/navigation/route-memory.test.mjs` passed eight tests against both actual intermodal engines: 1,728 paired station queries (400 successful), 96 paired exact-node diagnostic/multi-anchor queries and 288 paired full intermodal queries (200 successful, 160 successful multi-leg outputs, 400 selected-evidence replays). Tests force one/two-entry memos and cover dates, closed/no-wait routes, nulls, duplicate IDs, cancellation before entry and after the async yield, and byte-exact restore/idempotent patching. These are fixture semantic oracles, not a claim of full geographic coverage.

```sh
HK_PROFILE_RUNTIME=34c1eabb21cf HK_PROFILE_LABEL=od36-current-route-memory-exclusive HK_PROFILE_LOWERBOUND=1 HK_PROFILE_FOLLOWTHROUGH_MS=600000 node tests/navigation/profile-od36-current.mjs
node tests/navigation/profile-od36-summarize.mjs validation/performance/od36-current-route-memory-exclusive-34c1eabb21cf-od36-ordinary
node tests/navigation/profile-od36-followthrough.mjs validation/performance/od36-current-route-memory-exclusive-34c1eabb21cf-od36-ordinary
node tests/navigation/profile-od36-cache-simulate.mjs validation/performance/od36-current-route-memory-exclusive-34c1eabb21cf-od36-ordinary --extended
```

The runner refuses to overwrite existing evidence. CPU sampling is disabled. Incremental live status and Worker lifecycle logs preserve useful partial evidence if the process is externally interrupted. The process exited normally after cancelling only the harness's unfinished observation at 600 seconds.
