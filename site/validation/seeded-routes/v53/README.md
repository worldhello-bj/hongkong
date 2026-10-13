# v53 final integrated regression

Runtime **ac80b061436c** retains every original endpoint, source identity/XYZ, date, departure time, passenger preference and taxi policy in the seed-20261013 diagnostic cohort.

- **474/474 tests passed**, zero failure/skip; completed **2026-10-13 15:58:13 UTC / 2026-10-13 23:58:13 Beijing**.
- Original **16/16 comparisons completed** at **2026-10-13 16:05:29 UTC / 2026-10-14 00:05:29 Beijing**.
- **11/16 requests** have complete routes (**68.75% of this small diagnostic cohort**, not city-wide coverage). All **23/23 candidates** pass the strict source geometry, endpoint, timing and fare checks.
- No timeout, pending comparison or Worker error. All request/runtime identities and post-completion cancellation/stale-publication checks pass.

## Change since v52

Real v52 browser acceptance exposed an excessive delay despite the correct AUS source-isolation result. The checkpoint mistakenly counted event-loop waiting against the next work slice, turning roughly 802 yields into 25,656 under a simulated 4 ms timer clamp. The correction starts the work budget after resumption. No topology, endpoint, source restriction, proof rule, scheduling API or cancellation rule changes.

The two new tests cover deterministic 0/4/100 ms waits, real clamped timers and cancellation. They retain all 17 earlier proof-safety tests. See [timer correction and official timer reference](../../austin-terminal/browser-timer-correction.md) and [the controlled reproduction](../../austin-terminal/timer-clamp-proof.json).

## Final-runtime observations and limits

- EXC B3 → ADM C1 at 08:00: comparison 6.062 s, restored 21-minute official walking candidate and a separately labeled illustrative tram candidate. Exact source geometry and restrictions are retained.
- AUS D2 → original F stair entrance, 11:00/escalator/no taxi: Node/Worker-harness comparison 1.903 s, existing cold preparation 5.516 s separately, zero routing Workers, maximum observed proof slice 9.22 ms. This is an explicit missing connection in the loaded model, not a repaired route or a real-world impossibility claim. The F lift entrance is not substituted.
- Three closed-floor requests remain correctly unavailable. The same source-floor stratum at 11:00 retains a route.
- KOW TCL platform → EXC B3 at 23:00/lift/taxi remains unresolved after a complete 34.815 s comparison. No new OUT_OF_REGION regression, endpoint substitution or paid-area/closure bypass occurs. Platform-to-curb taxi access is still unverified.

`fixture.json`, `summary.json` and `invariants.json` preserve the compact exact-version evidence. Raw process logs and private filesystem paths are excluded. These timings use the production entry and Worker bundles with a DOM stand-in, not phone hardware or a real-browser profiler. Post-completion cancellation here is not an active-search timing measurement. Final published-browser acceptance is recorded with the deployment/PR, separately from these pre-publication checks; no browser-speed claim is inferred from Node results.
