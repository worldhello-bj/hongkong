# OD36 ordinary: grouped base-owner candidate

## Result

A single serial 60-second same-input run against frozen candidate `841fca7dce88`, compared with `d701fed258cc`. The runtime change groups initial public routing and all taxi public-middle queries on one identical official base owner before metro/demo/detailed/walk refinement. All original refinement phases remain. No FIFO, temporal caching, algorithm budget, hard-constraint or endpoint change is included.

| Metric | Current baseline | Grouped candidate |
|---|---:|---:|
| Public-fast stage | 12.302 s, needs refinement | 8.641 s, needs refinement |
| Taxi-comparison stage | Pending at 60 s | **13.518 s, ready** |
| Workers created | 8 | 5 |
| Queue owner switches | 6 | 3 |
| Consecutive same-owner query continuations | 0 | 7 |
| Main-thread clone-send total | 7.661 s | 3.881 s |
| Completed graph-prepare spans | 14.147 s | 7.896 s |
| Peak RSS | 1.260 GiB | 1.228 GiB |
| Available candidates | 2 | 4 |
| Full computation at 60 s | Pending | Pending |

Stage times start from the automatic restarted generation. The candidate restart occurs at actual click+3.673 s, so taxi comparison is ready around click+17.2 s. The original automatic block-loaded cancellation remains. These are single noisy samples, not p95 or guaranteed speed ratios. Parent/child spans overlap and must not be added.

## Candidate preservation and new results

The two baseline candidates preserve identical travel time, cost and mode chain:

- Direct taxi: 31 min / HK$140.25.
- Guarded modeled public: 151 min / HK$16.56.

Two previously unfinished taxi combinations now return:

- `taxi-first-tram-td:99215`: 103 min / HK$98.89, walk → taxi → walk → tram → walk.
- `taxi-first-metro-ADM:portal:E2`: 109 min / HK$96.73, walk → taxi → walk → tram → walk. Its internal candidate ID contains “metro”; the actual returned journey uses tram, so the ID should not be used as the displayed mode description.

All four returned routes preserve the requested endpoints and pass the probe's known forbidden-edge check. This is not validation of the still-pending routes or a full preference/accessibility matrix.

## Verified Worker behavior

Times are from the actual click.

1. W1 / base owner 1: created 0.319 s, canceled 3.673 s by the existing block-loaded restart.
2. W2 / base owner 1: created 4.728 s, serves **8 requests** without reinitializing, disposed 17.223 s after the base/taxi group completes.
3. W3 / metro owner 2: 17.224–23.637 s; returned before disposal.
4. W4 / isolated demo owner 3: 25.671–32.997 s. Its official-sized area object has demo geography/barriers and is never reused as an official owner.
5. W5 / detailed official owner 2: created 32.998 s, active until probe cleanup at 60.156 s.

Full requests, graph versions/node/edge counts, repeated postMessage calls and owner chronology are in `comparison.json`. Only five Workers exist, and only the first post on W2 initializes its graph inputs.

## What remains slow

The candidate progresses into detailed official transit roughly 23 seconds earlier than the baseline. The baseline ends while the detailed graph is still preparing; the candidate ends inside that graph's scheduled search, awaiting a walk subquery on the ADM detail graph (27,512 nodes / 60,514 edges). Taxi work is finished. Detailed public work is pending. Pure-walk refinement has not started.

Because more real work is reached, its raw search counts should not be compared as if it stopped at the same phase:

- Candidate starts 1,803 `ft` queries versus baseline 1,533.
- Detailed ADM graph: 1,114 rule-bearing edges, 688 nontrivial rule-bearing edges under production predicates.
- 78 timed FIFO queries on that graph spend 3.504 s in temporal preparation; all measured temporal preparation totals 4.613 s.
- Exact ancestry scans: 24,441 calls / 622,413 hops. Only 427 sampled scans are timed, totaling 1.535 ms; this is not a measurement of total ancestry time or evidence that ancestry dominates.
- Latest scheduled-search progress has 3,934 retained / 3,603 active labels, queue 2,398, after about 20.96 s in the scheduled search; Worker heapUsed is 376,845,296 bytes. Active includes settled, non-invalidated records.

No extra candidate or repeated run was started. The result supports the scoped improvement “taxi comparisons finish and repeated base-owner initialization falls.” It does not support “OD36 is fully finished” or “all performance problems are fixed.”

## Measurement controls and evidence

- Same exact fixture coordinates, ordinary need, 08:00 Hong Kong departure on 2026-10-12, mode restrictions, actual S1 entry, 60-second observation and 384 MiB Worker old-generation cap.
- CPU sampling disabled. Same low-overhead copied instrumentation; the accepted-label field spelling was corrected between runs without changing search behavior, and the summarizer normalizes both through the exact identity `accepted pushes = popped + remaining queue`.
- Real copied snapshot, never hardlinked mutable dist: 113 files / 58,428,749 bytes. Manifest SHA256: `4ea4b8af74c503f029c7917092e7184227a402c3aba2a078e8617c4554eaa833`.
- Independent byte comparison after replacing only runtime IDs finds differences solely in `build-meta.json`, `assets/main-integrated.js` and `assets/routing-queue.js`; Worker algorithms and graph data are unchanged. See `build-scope.json`.
- DOM stand-ins do not prove actual browser rendering/painting or visual behavior. No timeout is converted to `NO_ROUTE`.

Primary files: `report.json`, `hotspots.json`, `comparison.json`, `build-scope.json`, `snapshot-manifest.json`. Ignored local raw evidence is in `events.ndjson` and `instrumented/`.

```sh
HK_PROFILE_RUNTIME=841fca7dce88 HK_PROFILE_LABEL=od36-current-owner-grouped node tests/navigation/profile-od36-current.mjs
node tests/navigation/profile-od36-summarize.mjs validation/performance/od36-current-owner-grouped-841fca7dce88-od36-ordinary
node tests/navigation/profile-od36-compare.mjs validation/performance/od36-current-baseline-d701fed258cc-od36-ordinary validation/performance/od36-current-owner-grouped-841fca7dce88-od36-ordinary
```

Existing evidence directories cannot be overwritten; choose a fresh label for an explicitly coordinated repeat.

### Detailed-stage follow-up attribution

`detailed-stage.json` separates completed-query totals from the one unfinished `ft` at cutoff. That current query only starts 48 ms before the observation ends and has not produced a loop sample or end; its label/parent/queue counters are unknown. The immediately preceding completed query has only 61 states / 60 parents / 61 bases / queue 29 / max allocated per base 1. Its loop takes 0.558 ms while its whole query takes 265.189 ms.

Across W5's 77 completed timed queries, whole-query time is 17.239 s, main search loops total 0.335 s, temporal preparation 3.484 s, leaving 13.420 s unallocated by the current probe. The code's reverse lower-bound setup, with an eight-entry remainingCache keyed by origin+destination+mode, is an investigation target. This remainder has not yet been directly attributed and must not be called ancestor/Pareto search time.

W5 heapUsed milestones: initial three graphs prepared 212.65 MiB; transit-build finished 270.46 MiB; lazy detailed ADM region prepared 330.25 MiB; its walk index finished 337.77 MiB; last scheduled progress 359.39 MiB; last completed `ft` 363.11 MiB. Different GC points prevent subtracting these into a reliable label-memory estimate.
