# OD36: static time metadata and 32-entry compact lower-bound cache

## Fixed 60-second result

Single process, same actual S1/OD36 ordinary/08:00 Hong Kong departure on 2026-10-12. The original 60-second report and event stream were written before continuing observation in that same process.

- First available result: 2.818 s in the automatically restarted generation.
- Public-fast: 10.213 s, needs indoor refinement.
- Taxi comparison: 14.905 s, ready.
- Metro comparison: 6.299 s, no complete route.
- Guarded modeled public: 9.109 s.
- Detailed official transit: still pending at 60 s; pure walk has not started.
- Five Workers; peak RSS 1.266 GiB.
- All four results match grouped-owner runtime 841fca7dce88 exactly in minutes, fares and mode chains. Endpoints and known forbidden-edge checks remain valid. See `comparison.json`.

The 60-second detailed-ADM cache records 281 lookups, 239 hits, 42 misses, ten evictions, and actual capacity 32. Its retained Float64/presence-bitmap arrays peak at 7,153,120 bytes. Lower-bound construction totals 8.682 s. Across all 2,403 recorded time-semantics preparations, that preparation now totals 0.423 s, measured from before `hkTimingProfile` so the initial metadata computation is included.

This demonstrates functioning exact-key cache reuse and removal of repeated static time-rule scans. It does **not** establish complete OD36 execution within 60 seconds.

## Same-process follow-through to 120 seconds

The same run continues, without reload/restart, to a separate 120-second cutoff. It is still pending in detailed official transit. No further candidates appear and no Worker error/OOM is reported. Peak RSS stays 1.266 GiB. This extension is diagnostic; it does not replace the failed 60-second completion result.

Latest scheduled-search progress: 7,753 retained labels, 7,352 active non-invalidated labels, queue 4,681, 3,072 popped labels, 10,493 connection-resolver calls. This is the scheduled search. Completed individual timed walk searches remain small: maximum 1,641 retained labels and eight allocated labels per base state.

The current 32-entry cache stops covering the growing working set:

| Exact-key evidence | At 60 s | At 120 s | Added after 60 s |
|---|---:|---:|---:|
| Timed lookups | 281 | 704 | 423 |
| Hits | 239 | 484 | 245 |
| Misses | 42 | 220 | 178 |
| Distinct keys seen | 39 | 67 | 67 in the second interval |
| Evictions | 10 | 188 | 178 |
| Reverse-bound construction | 8.682 s | 60.190 s | 51.508 s |

Only 28 keys first appear after 60 seconds. Of the second interval's 178 misses, 150 rebuild an already-seen exact key after eviction. This is directly observed repeat preparation, not evidence that every new departure requires a new lower bound.

For the 423 timed `ft` queries completed after 60 seconds:

- Whole-query wall time: 55.936 s.
- Reverse-bound preparation: 51.518 s.
- Main search loops: 2.164 s.
- Temporal preparation: 1.152 s.
- Remaining wall time: 1.103 s.

These are wall-time timers, including GC and host scheduling. CPU sampling is disabled, so “pure CPU” cannot be inferred. Completed spans are assigned to an interval by end timestamp; a span crossing 60 seconds can include a small pre-cutoff portion.

## Offline exact-key capacity replay

`profile-od36-cache-simulate.mjs` replays the recorded keys without running any route query or changing production. FIFO 32 reproduces **every** actual hit and eviction in the 704-event observed stream. Maximum exact-key reuse distance is 60 distinct other keys (p90 45, p95 49).

| Policy / capacity | Hits | Misses | Peak compact arrays |
|---|---:|---:|---:|
| FIFO 32 | 484 | 220 | 6.822 MiB |
| FIFO 48 | 558 | 146 | 10.233 MiB |
| FIFO 64 | 637 | 67 | 13.643 MiB |
| FIFO 96 / 128 | 637 | 67 | 14.283 MiB for 67 populated entries |
| LRU 32 | 508 | 196 | 6.822 MiB |
| LRU 48 | 597 | 107 | 10.233 MiB |
| LRU 64 / 96 / 128 | 637 | 67 | Same populated-entry bounds as FIFO |

For this exact observed trace, FIFO 64 eliminates all 153 repeated builds, leaving only the 67 first uses. It makes three evictions whose keys are not needed again before the observation ends. This is not a prediction about unobserved future keys, completion time or full Worker memory. Array sizes exclude node-index Maps, synthetic-key Maps, cache keys, graphs and transient builds. A 16 MiB array budget can accommodate 64 entries for this graph.

The raw stream contains two more lower-bound miss events during final cleanup after the 120-second cutoff. Including them yields 706 lookups / 222 misses and FIFO64 639 hits / 67 misses. The primary analysis consistently excludes those post-observation events.

## Files, controls and provenance

- `report.json`, `events.ndjson`, `hotspots.json`: fixed original 60-second checkpoint.
- `followthrough-report.json`: separate 120-second observation, still pending.
- `instrumented/followthrough-events.ndjson`: ignored local full event stream, including cleanup.
- `followthrough-attribution.json`: completed-span time partition.
- `cache-simulation.json`: offline FIFO/LRU replay with full caveats.
- `comparison.json`: four candidate results compared with grouped-owner baseline.
- `snapshot-manifest.json`: 113 files / 58,439,029 bytes. Manifest SHA256 `b312a66935e36a45b4ae6a7780c79d8268d32b39422f53f91c7314d67c1040d8`.

The immutable runtime is `10e14b8593db`. Compared with 841fca7dce88 after runtime-ID normalization, only build metadata and the four patched routing-engine assets differ; graph data, main scheduling and routing queue are unchanged. No intermediate 22ca29bdfd97 graph snapshot was copied. CPU sampling remains disabled, the Worker old-generation cap remains 384 MiB, and DOM stand-ins do not validate browser rendering. Pending is never converted to `NO_ROUTE`.

```sh
HK_PROFILE_RUNTIME=10e14b8593db HK_PROFILE_LABEL=od36-current-compact-cache HK_PROFILE_LOWERBOUND=1 HK_PROFILE_FOLLOWTHROUGH_MS=120000 node tests/navigation/profile-od36-current.mjs
node tests/navigation/profile-od36-summarize.mjs validation/performance/od36-current-compact-cache-10e14b8593db-od36-ordinary
node tests/navigation/profile-od36-cache-simulate.mjs validation/performance/od36-current-compact-cache-10e14b8593db-od36-ordinary
```

Use a new label for any coordinated repetition; the runner refuses to overwrite evidence.
