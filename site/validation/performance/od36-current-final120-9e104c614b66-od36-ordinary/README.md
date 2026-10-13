# Final OD36 ordinary 120-second probe: 9e104c614b66

Frozen runtime113 files / 58,489,188 bytes; source-before/source-after/snapshot hashes match. Same OD36 ordinary, date2026-10-12, departure08:00, actual S1 and real Workers, 384 MiB Worker old-generation cap, no CPU sampling. One run only, no extension/retry. Parent released the matrix heavy slot before start; only current exec PID namespace was inspected. Node DOM stand-in does not measure browser painting or prove real journeys.

## Observation

- 60s: detailed stage pending; first option1.601s, public7.482s, taxi14.394s. Five Workers, RSS1.068GiB, peak1.267GiB.
- 120s: still pending, four available candidates, RSS1.091GiB, same peak. Latest scheduled progress: 27,694 retained /26,893 active labels, queue16,430, 45,000 resolver calls; sampled Worker heap369.70MiB. Heap points are GC-sensitive, not retained-byte attribution.
- No Worker error. The probe explicitly terminated outstanding work at its observation limit. All five created Workers emitted exit events; main exited0. Heavy slot was released before the parent's aggregate run.
- All four candidates exactly match cfc120 and this run's60s values, modes, endpoint and known-forbidden-edge checks. Their availability does not mean the detailed route is complete.

## What changed and what remains

7,658 completed timed walk queries: total38.296s, search loop27.728s, temporal preparation0.136s, lower-bound preparation4.663s, other5.769s. Destination cache: 7,621 hits/37 core builds, one base build, no fallback,37 distinct core keys. Base0.078s, core Dijkstra2.571s, compaction0.278s, origin leaf/root rebuilding0.152s.

The comparable cfc120 sample had7,613 timed walks and9.162s temporal preparation. The FIFO discarded-horizon scan is now removed. Dt's wall residual after direct children is4.706s versus6.018s before, but neither run finishes. Search-loop time and total route progress vary; different instrumentation and single observations do not establish a stable end-to-end speedup.

At120s Dt has run81.310s: direct child walks75.640s, graph preparation0.964s, residual4.706s. Repeated distinct-clock walk resolution remains the principal observed work.

Timings are hierarchical: Dt already includes its direct walk children; completed timed ft is a subset of those walks, and the ft loop is a subset of ft. Do not add Dt residual, whole-walk and inner-loop totals together. The residual is elapsed wall time after subtracting direct nested spans, not sampled CPU time.

## Goal and temporal boundary evidence

An actual accepted goal exists early: Dt+3.708518s, accepted-label count2,567, first score18,315.64713, arrival37,462.16334, walk6,315.65586s, transfers1. At the latest progress301 goal labels had been accepted; best generated score18,186.92919. They have not yet yielded the engine's final optimal pop. This supports investigating a proved incumbent bound, not publishing the incumbent as the final optimal route.

Actual global boundary p=39,600 (11:00), s=28,800 (08:00), delay10,800s. The596 opening times were derived from283,306 edge visits. Four maximum-opening occurrences are ADM lift edges ADM:P:250017626 and its :r reverse, repeated across the source graph sets; access_time_id290000991. This measures the existing whole-network boundary, not proof that any region is irrelevant.

The last top-node index snapshot was at8,448 pops, before the latest11,264-pop progress. It saw100 nodes /19,547 buckets /20,814 label references. AUS D1 retained1,048 labels,1,028 active and1,028 exact pre-boundary clocks; D2 retained947 with947 clocks; D3 retained900 with900 clocks. Their clocks are all before11:00. See final-summary.json for top20. Sampling staleness is explicit; these are not exact120s per-node counts. Full index scan cost19.402ms in that snapshot.

## Geometry evidence

All25,746 accepted walking legs have no geometry field. The1,947 accepted geometry arrays belong to bus812 /tram996 /metro139 and contain163,501 coordinate references (maximum699 per array). The bounded1-in64 signature sample has31 samples,29 distinct window hashes and2 repeats. No coordinate arrays were retained by the probe. Hash repetition is only a duplication candidate; this small deterministic sample is not a heap-size estimate. Dynamic walking full-result geometry is therefore not being retained through those label legs.

Both result memos remain64 entries with0 duplicate-ID pins. Route labels and predecessor chains are untouched.

## Evidence and instrumentation

report.json preserves60s; followthrough-report.json preserves120s. checkpoint-60-attribution.json and stream-attribution.json contain bounded streaming aggregates; first-goal.json stores the exact first-goal event. final-summary.json has the concise complete comparison and top-node/geometry data. execution-context.json records resource and Worker-exit evidence.

Unlike earlier probes, event history is incrementally flushed, repeated full core keys are dictionary-coded, and no whole-history serialization occurs on shutdown. These changes reduce observer memory/log size; compare algorithm counters and stages with that caveat. Raw NDJSON is losslessly gzip-compressed only after analysis, with decompression SHA256 verification and recovery commands in ../log-compression-20261012.json. No observation limit was added to production search.
