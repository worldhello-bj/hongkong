# OD36: bounded V8 live-allocation sampling

## Scope

One additional 60-second diagnostic run against the existing immutable `8e5a3cbed130` snapshot. No production code, IDs, search constraints, queue ordering or cache policy changed. Only Worker 5, confirmed by its initialization message to be the detailed app-transit Worker, is sampled. This run is not a wall-time A/B.

The probe uses V8 HeapProfiler statistical sampling at 64 KiB, with collected-object inclusion disabled. It does not create a full heap snapshot and does not force GC. Sampling starts during Worker bootstrap before message-handler registration. At a real scheduled-search progress checkpoint, heap ≥340 MiB or retained labels ≥5,000 synchronously triggers stopSampling and writes the small profile. A Node v24.19 microcheck verified that the inspector callbacks complete synchronously, so timer starvation cannot postpone the save until an OOM.

## Captured evidence

The profile is **221 KiB**, containing 4,060 samples. It was saved at:

- 14.184 s into the detailed scheduled search; 19.811 s after sampling started.
- 4,532 retained / 4,199 active scheduled labels.
- 1,792 popped labels; queue 2,740.
- Worker heapUsed 371,194,216 bytes (354.0 MiB). The check occurs only at a 256-pop boundary, so it can overshoot the configured threshold.

The estimated sampled allocation sizes total 292.981 MiB. Non-overlapping allocation-site categories:

| Allocation-site category | Estimated sampled MiB |
|---|---:|
| Unattributed V8 API | 173.189 |
| Prepared walk-index `bt` subtree | 65.136 |
| `ft` allocations excluding index construction | 20.514 |
| Transit initialization outside search | 17.792 |
| Scheduled-search context excluding `ft`/`bt`, including regional containers | 8.815 |
| `Lt` synthetic `EXACT:` portal objects | 6.941 |
| Other | 0.593 |

The direct `P` accepted-label construction frame accounts for approximately 0.938 MiB at this checkpoint. This does not support attributing the bulk of heap growth to a few thousand labels copying whole paths. Prepared indexes and generated portal objects are material measured allocation sites.

The 173.189 MiB V8 API bucket remains **unattributed**. It must not be relabeled as input clones or a specific graph without independent evidence. Sampling reports allocation stacks and statistical sizes, not exact retained owners, dominator paths or the exact live bytes of each cache. Objects not yet collected can remain in a sample; GC is not forced.

## Static retention audit

See `retention-audit.md` for exact object/reference semantics and safe-recomputation caveats. In particular:

- Scheduled labels hold this-hop legs and a predecessor pointer, not a copied full path.
- `ae`, `_e`, `Lt.s` and the bounded `H` result cache can share references to full walk route geometry.
- `_e` is currently required for final reconstruction and cannot simply be treated as an evictable memo without a correct selected-leg recomputation path.
- `Lt` builds synthetic exact-node portals for all regional nodes even when its edges are restricted to indoor edges; the sample directly attributes 6.941 MiB to those portal allocations.

## Files

- `worker-5.heap-sampling.json`: original small V8 sampling profile and capture metadata.
- `heap-summary.json`: reproducible, non-overlapping allocation-stack categories and source context.
- `report.json`: diagnostic run state. At 60 seconds, detailed transit remains pending and four earlier candidates remain available.
- `events.ndjson` / `instrumented/`: ignored local raw evidence.

```sh
HK_PROFILE_RUNTIME=8e5a3cbed130 HK_PROFILE_LABEL=od36-current-heap-sampling HK_PROFILE_LOWERBOUND=1 HK_PROFILE_HEAP=1 node tests/navigation/profile-od36-current.mjs
node tests/navigation/profile-heap-summarize.mjs validation/performance/od36-current-heap-sampling-8e5a3cbed130-od36-ordinary
```

The original 60/120-second negative results in the compact64 report remain unchanged. This diagnostic did not attempt another 120-second execution or change the 384 MiB Worker old-generation cap.
