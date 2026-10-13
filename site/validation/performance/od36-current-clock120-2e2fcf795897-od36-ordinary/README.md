# Final clock-correct OD36 probe: 2e2fcf795897

One same-input OD36 ordinary run, original 08:00 / 2026-10-12 date and coordinates, actual S1 and real Workers, 384 MiB Worker cap. Frozen snapshot has 113 files / 58,489,224 bytes, with source-before/source-after/snapshot SHA256 equality. Same scalar instrumentation as 9e. No CPU sampling, retry or extension beyond 120 seconds. Node DOM stand-in is not browser painting or real-journey acceptance.

This runtime preserves exact departure/date unconditionally in the outer bounded walk-cache key. The older 9e key could incorrectly reuse a result when endpoints had temporal rules but regional graph edges did not. This is correctness work; unchanged available candidates in this OD do not prove the older cache was correct.

## Outcomes

- 60 seconds: detailed stage pending. First option 2.094 s, public 9.885 s, taxi 22.653 s. Five Workers, RSS 1.191 GiB, peak 1.274 GiB.
- 120 seconds: still pending with the same four available candidates. RSS 1.214 GiB, same peak. No production Worker error. Main probe exited 0; every created Worker W1–W5 has a corresponding exit event after owner disposal or observation-limit cleanup.
- All candidate fields in the probe, including values, modes, original endpoints and known forbidden-edge checks, exactly match 9e120 and this run's 60-second snapshot. Detailed refinement remains unfinished; timeout is not NO_ROUTE.

## Cache and stage evidence

At the 120-second boundary, 7,781 timed ft calls have completed. One additional lower-bound preparation completed before its ft call finished. Destination lower bounds: 7,782 calls, 7,745 hits, 37 core builds, one base build, no fallback, 37 exact core keys. Core cache capacity 64; peak array storage 8,270,795 bytes. This budget excludes other index and heap objects.

Completed timed ft wall time is 35.577 s: loop 26.650 s, temporal preparation 0.094 s, lower-bound preparation 3.569 s and other work 5.265 s. Dt elapsed 73.750 s, with direct walk children 69.152 s, graph preparation 0.776 s and residual 3.822 s. These timings are hierarchical: Dt already contains walk work; timed ft is a subset of that work, and loop/preparation are portions of ft. Never add nested totals together. Residual is elapsed wall time, not a CPU sample.

The early public/taxi Worker W2 executes 1,681 walk queries versus 1,613 in 9e, and 8 scheduled searches in both runs. W2 walk wall totals are 15.159 s versus 7.391 s; scheduled-search totals are 16.350 s versus 8.750 s. The extra 68 walk executions are observed, and the slower taxi stage must be retained in the result. Single-run wall-time differences beyond that count cannot be assigned wholly to the cache change or wholly to host noise.

## Goal, clock buckets and geometry

Last progress: 28,378 retained labels, 27,565 active, 11,520 pops, 46,225 resolver calls. Sampled Worker heap is 318.02 MiB; GC-sensitive samples are not retained-size estimates.

The first accepted goal appears at Dt + 2.785703 s. There are 311 accepted goal labels by the last progress, with best generated score 18,186.92919, the same as 9e. This is not a final optimal pop or a completed detailed route.

Global p remains 39,600 (11:00), departure s 28,800 (08:00): a 10,800-second delay. Maximum-opening sources are ADM lift edges ADM:P:250017626 and its reverse, each present in both source sets (four occurrences), access_time_id 290000991. The raw opening list has 596 entries from 283,306 source-edge visits. No claim is made that the triggering region is irrelevant.

The top-node sample is explicitly older than the final progress: 8,448 pops, 100 nodes, 19,547 buckets and 20,814 retained references. AUS D1 has 1,048 labels / 1,028 active / 1,028 exact pre-boundary clocks; D2 has 947 / 947 / 947, and D3 900 / 900 / 900. This sample matches 9e at the same pop count, supporting unchanged exploration up to that point. Full top20 and timestamps are in final-summary.json.

All 26,430 accepted walking legs lack geometry. The 1,947 geometry arrays are bus 812 / tram 996 / metro 139, containing 163,501 coordinate references. The bounded signature sample has 31 samples and only two repeat hashes; it retains no geometry objects. Geometry sharing is not adopted. Both result memos remain 64 entries, with no duplicate-ID pins.

## Evidence

- report.json: original 60-second checkpoint
- followthrough-report.json: 120-second checkpoint
- checkpoint-60-attribution.json and stream-attribution.json: bounded-memory offline aggregates
- final-summary.json: concise current result, complete finite goal/boundary/top-node/geometry evidence
- clock-cache-comparison.json: per-Worker completed-span counts and times against 9e
- first-goal.json and execution-context.json: exact first-goal event and resource/Worker-exit record

All raw NDJSON remains excluded from the PR. It is losslessly gzip-compressed after analysis, with decompression SHA256 verification and recovery commands in ../log-compression-20261012.json. The observation limit is only in the test harness, not production search.
