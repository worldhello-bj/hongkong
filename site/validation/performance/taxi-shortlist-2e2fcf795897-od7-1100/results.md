# OD7 single-candidate counterfactual result

## Finding

Adding the real `td:99133` westbound Admiralty tram stop produces a complete, audited modeled journey, but does **not** achieve the intended walking reduction or change the overall best choice at any tested price weight. Relative to the default tram anchor `td:99126`, it saves HK$6.56, takes 7 minutes longer, and leaves walking, waiting and transfers unchanged. This is a cheaper/slower alternative, not evidence of a better first/last-mile recommendation.

It does dominate the existing ADM E2 mixed candidate in the measured time/cost/walk dimensions (67 vs 73 minutes, HK$34.72 vs HK$37.45, 47 vs 52 walking minutes; equal wait/transfers). Thus the current fixed cap omits a legitimate tradeoff and retains a weaker mixed candidate, but this one case does not justify a production shortlist change or prove broad benefit.

Only the approved pair was run. Production and the frozen experiment implementation were not modified.

## Execution and reproducibility

- Runtime: `2e2fcf795897`; both arms verified stable identical full code/data signatures.
- Full runtime signature: `58a530dacc14c45c5e58342db8aa4ed9337136ab77a68e960a9079cda499c099`.
- Probe SHA-256: `ecdce905a0ee865eb2c626de1af2a2d932a8bd378648f8486f8ec9788e5e5e43`.
- Original land OD7, seed 20261011; ordinary preference; 2026-10-12 11:00 Asia/Hong_Kong; production taxi seed 42.
- Original origin `[114.19780266014673,22.27037983652672]` and destination `[114.16388501171271,22.2735175495032]` preserved.
- Baseline and experiment each completed within the fixed 60-second observation window, with no 90-second watchdog firing, failed stage, Worker error, or invariant failure.
- All six shared completed candidates retained identical time, price, walk, wait and transfer metrics between arms.

| Observation | Baseline | Extra last td:99133 |
|---|---:|---:|
| Complete comparison wall time | 24.971 s | 25.379 s |
| Boot, separately measured | 7.223 s | 4.732 s |
| Taxi stage | 17.494 s | 18.974 s |
| Complete candidates | 6 | 7 |
| Workers created | 2 | 2 |
| Peak process RSS, including Workers | 1284.2 MiB | 1400.4 MiB |

Single-pair timing/RSS changes are diagnostic observations, not a repeat-sampled performance claim. No route remained pending.

## Whole-journey comparison

All fares use the actual production illustrative quote. Minutes are the production reported metrics, not manually reconstituted durations.

| Candidate | Total min | HKD | Walk min | Wait min | Transfers |
|---|---:|---:|---:|---:|---:|
| Taxi direct | 24 | 63.46 | 2 | 6.959 | 0 |
| Taxi first + tram td:99125 | 50 | 43.69 | 24 | 8.959 | 1 |
| Default tram td:99126 + taxi last | 60 | 41.28 | 47 | 4 | 1 |
| **Added tram td:99133 + taxi last** | **67** | **34.72** | **47** | **4** | **1** |
| Existing ADM E2 + taxi last | 73 | 37.45 | 52 | 4 | 1 |
| Pure walk | 82 | 0.00 | 82 | 0 | 0 |
| Public transit | 85 | 3.00 | 70 | 4 | 0 |

The added candidate's complete fare is tram HK$3.00 + taxi HK$31.72 + zero-priced walking legs = HK$34.72. All quote-leg sums and mode coverage passed. Compared with pure transit it saves 23 reported walking minutes, but the already-selected td:99126 option saves those same 23 minutes; the new anchor adds no walking benefit over that default.

## Real prefix, quote and 95% rule

- Actual public prefix retains source pattern `td:4005:1:287`, from `td:99125` to `td:99133`, a modeled-frequency 711-second tram ride. Source-stop/shape-boundary audit passed on the actual prefix rather than on the composite's absent timed-leg list.
- Prefix reports 61 total minutes, 46 walking minutes and 4 waiting minutes. The original long walk to board the tram remains; this explains why a geographically nearer final anchor did not improve whole-journey walking.
- The nominal 533 m straight-line candidate distance does not represent the road trip: actual taxi passenger route is **2340.183 m**, 334.314 seconds, versus direct taxi **6307.040 m**.
- Ratio is **37.1043%**; original 95% threshold is **5991.688 m**. The unchanged rule passed with a real direct quote available.
- Taxi passenger-ready time is 43258.3559 s, dropoff 43592.6699 s. Passenger taxi wait is zero; the whole journey's reported 4-minute wait comes from public transit.
- Source tram stop to modeled curb link: 18.427 m, 15.356 seconds. The normal connector guard passed. This does not establish physical boarding access, elevation continuity, or wheelchair accessibility.

The other default candidates were not silently discarded: EXC B3 last and EXC A1 first returned `NO_ROUTE` from their real public subqueries, and ADM E2 first was rejected for having no public ride. These same outcomes occurred in both arms. Every original shortlist candidate remained present in the experiment.

## Price-weight sensitivity

Only the cost coefficient changed. Priority remains `time`, with all other production weights and facility terms preserved; scores are generalized-minute model values, lower is better.

| Cost weight | Default td:99126 score | Added td:99133 score | Added rank among 7 | Overall first choice, unchanged |
|---|---:|---:|---:|---|
| 0.25 | 91.77 | 97.13 | 4 | Taxi direct |
| 0.75, original | 112.41 | 114.49 | 6 | Taxi direct |
| 2 | 164.01 | 157.89 | 5 | Pure walk |

At high price weight the new anchor beats the old tram anchor, but still does not become the preferred mixed candidate or overall first choice. This offline reranking concerns the fully observed pool only; it does not prove global optimality under any weight.

## Provenance and shutdown

Full asset, graph and fetch hashes are stored in each arm's JSON. Key unchanged source hashes:

- Services file: `59c1c4faef3fadbf32748b0707231f78c3ec36aa4d2edc47de39b8c39485c542`
- Tram pattern: `5281452a9fe1ef78ec5aa942c77f63a2898038f1ebb661d8b98ce841bf2d3984`
- Original source shape: `1309f9854e44b59aa1398a98ec0e421730c9257a5dfec4bbac3271df40703df3`
- Pattern provenance: official source-stop GTFS dataset; geometry is schematic and intermediate times are frequency/distance estimates, not live service verification.

Both reports show every created Worker terminated and exited, with no pending queries, no Worker errors, and passing cancellation/stale-publication checks. The coordinator and both arm processes exited with code 0. A post-run process check found no remaining Node/counterfactual process. The heavy-test window is released.

Artifacts: `baseline.json`, `extra-last-99133.json`, their `.events.ndjson` and `.process.json`, and `comparison.json`. Node DOM stand-ins are not browser visual acceptance. All source-access/modeling warnings remain applicable.
