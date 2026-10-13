# v52 integrated Node/Worker regression

Runtime: **616dc1f931e4**. This is a historical Node/Worker record. Subsequent real-browser testing found an excessive timer-scheduling delay despite the correct terminal refusal; see the [browser timer correction](../../austin-terminal/browser-timer-correction.md). These timings do not certify browser performance. The same 16 requests from the original seed 20261013 cohort retain identical ordered endpoints, source IDs/XYZ, dates, departure times, passenger preferences and taxi policies.

## Completed checks

- Full test suite: **472/472 passed**, no failure or skip; completed **2026-10-13 15:31:00 UTC / 23:31:00 Beijing (UTC+8)**. An earlier run found ten legacy VM-fixture missing-import errors; the fixture now loads the real precheck dependencies, with the assertions retained, and the complete suite was rerun.
- Original 16-cell matrix: completed **2026-10-13 15:36:51 UTC / 23:36:51 Beijing (UTC+8)**.
- **11/16 requests** produced complete candidates (**68.75% of this diagnostic cohort**, not a Hong Kong-wide success estimate). All **23/23 candidates** pass the strict geometry, endpoint, fare, time and route invariant checks.
- All 16 comparisons completed; no observation-window pending result, external timeout or Worker error. Every original request identity and runtime identity remained stable. Post-completion cancellation/stale-publication checks passed; these checks do not substitute for active-search lifecycle tests.

## Five requests without a complete candidate

- Three named-floor requests correctly retain the source facility's closed-hour rejection. The same source-floor stratum at 11:00 still has a valid candidate; no opening rule was bypassed.
- AUS D2 → original F stair entrance, 11:00, escalator preference, no taxi: the conservative loaded-source terminal cut finishes in **1.920 s**, with existing cold data preparation **5.503 s** separately. No routing Worker is started. The measured maximum proof slice is **8.72 ms**, not a guaranteed 4 ms bound. This explains missing connectivity in the current model, not physical impossibility or a restored route. The F lift entrance is not substituted.
- KOW TCL platform → EXC B3, 23:00, lift preference, taxi enabled: still unresolved, completing in **39.200 s** without an accepted route. There is no new `OUT_OF_REGION` regression. Platform-to-curb access remains unverified for taxi. The bounded EXC import does not establish the full paid-platform/modal composition, and no endpoint or opening restriction was changed to inflate the success count.

EXC B3 → ADM C1 at 08:00 now has the original-endpoint official walking candidate and a separately labeled illustrative tram candidate. The official connection provenance and isolated diagnostics are in [the EXC report](../../exc-b3-boundary/README.md); the terminal proof and historical comparisons are in [the AUS report](../../austin-terminal/README.md).

`fixture.json`, `summary.json` and `invariants.json` are compact public evidence. Raw process logs and environment-specific paths are deliberately excluded. These runs use the real production entry and Worker bundles with a DOM stand-in; they are not phone-hardware or browser visual measurements.

Active-search lifecycle checks completed at **2026-10-13 15:37:49 UTC / 23:37:49 Beijing**: proof cancellation, delayed-detail fallback/replan, and disabled-policy fallback all passed. Evidence: [final lifecycle record](../../austin-terminal/final-lifecycle.json). The delayed-detail replay observed a 16.70 ms maximum slice, so the matrix's 8.72 ms observation is not a universal maximum. Cancellation fields record a 750 ms observation interval, not a measured reaction latency.
