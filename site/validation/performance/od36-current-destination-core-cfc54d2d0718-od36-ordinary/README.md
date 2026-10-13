# OD36 ordinary: destination-core candidate cfc54d2d0718

Same frozen OD36, ordinary preference, 2026-10-12 08:00 departure, real production S1 and Workers, 384 MiB Worker old-generation cap, Node DOM stand-in, no CPU sampling. Snapshot manifest verified before execution. This runtime also includes the explicit bus/tram stop-projection geometry correction.

## Result

- 60 seconds: detailed refinement pending. First option 1.713 s, public 7.721 s, taxi 14.726 s. Five Workers, current RSS 1.095 GiB, peak 1.231 GiB.
- 120 seconds: still pending; 27,694 scheduled labels retained, 26,893 active; sampled Worker heap about 307 MiB.
- 600 seconds: still pending. Latest scheduled checkpoint retains 120,704 labels, 119,324 active, queue 66,432; sampled heap 369.98 MiB. Current process RSS 1.474 GiB, peak 1.553 GiB. The old probe retains event history in its main heap, so RSS growth is not attributable solely to routing.
- No production Worker error was recorded. At the observation limit the harness explicitly terminated Worker 5 (process t=604751.713 ms), followed by exit1 at t=605011.429 ms. The main harness later exited137 during final log serialization. This is an incomplete probe finalization, not evidence of a production Worker OOM or a successful route terminal state.

The original 60-second report, 120-second report, 600-second report and 600-second scheduled checkpoint survived. The last durable full raw stream ends at process t=595117.591 ms; its aggregates below must not be called exact 600-second totals. `finalization-note.json` records this boundary. Timeout remains pending, never NO_ROUTE.

## Lower-bound result and remaining work

Streaming analysis of 520,302 events, retaining at most 7 active spans:

- 52,366 destination lookups: 52,329 hits, 37 misses/core builds, 0 fallbacks. One base reverse build, then 36 base hits. Exactly 37 distinct core keys.
- Base reverse construction 0.125 s; core Dijkstra 2.499 s; core compaction 0.289 s; per-request origin-leaf/root rebuild 1.149 s. Entire helper inclusive time 11.494 s.
- 52,366 completed timed walk subqueries consume 289.896 s: search loop 153.946 s, temporal preparation 87.231 s, entire lower-bound preparation 13.838 s, other work 34.880 s.
- Scheduled search elapsed 550.179 s at the final durable raw event. Direct child walk spans consume 473.846 s and graph preparation 1.103 s; residual is 75.230 s. These are wall-time partitions, not CPU samples.
- Completed station walks: AUS 29,843 / 111.414 s; ADM 6,651 / 61.243 s; HUH 2,248 / 10.802 s. All are CONDITIONAL. The only NO_ROUTE is a 0.150 ms early merged-graph result, so repeated disconnected searches are not a material measured hotspot here.

The destination-core change removes the previously dominant repeated Dijkstra work. It does not yet finish this OD within 600 seconds. Exploration and request-specific temporal preparation are now measured bottlenecks; neither permits unproven dominance relaxation or a production search cap.

## Output and memo checks

The four available candidates remain unchanged from 60 to 600 seconds. Against runtime34c, taxi values/modes/endpoints remain the same. The demo fare changes HK$16.56 to HK$16.57 with the separate bus/tram stop-projection geometry correction; do not misattribute this to caching. No returned forbidden edge is recorded. Available options do not prove detailed refinement or complete XYZ verification.

Both route memo sizes remain 64 with zero duplicate-ID pins. Portal sparsification keeps graph nodes/edges and removes only isolated derived EXACT portals. Per-query details, memo counters and sparse graph counts are in `stream-attribution.json` and the preserved report/checkpoint files.

## Reproduction and limitations

The raw streams are losslessly gzip-compressed. SHA256/recovery commands are indexed in `../log-compression-20261012.json`. The safe offline reader is `node tests/navigation/profile-od36-stream-summary.mjs <run-directory>`; it supports gzip directly and never loads the whole stream. Do not run older whole-file analyzers on this stream.

The probe has subsequently been fixed to flush bounded event batches and rename/copy files at checkpoints rather than keeping and serializing all events. Future main-process memory comparisons must acknowledge that instrumentation change. Worker search semantics and the 384 MiB cap are unchanged. This is JS execution evidence, not browser layout/paint or real-journey acceptance.
