# Ticket page, station workflow models and fixed-seed diagnostics

Date: 2026-10-13. Baseline runtime: `d13e16e39f47`. Pre-clock-fix runtime: `c1d9f0142f40`. Final runtime: `5526e22eeac9`.

## Product changes

- A dedicated simulated ticketing page: confirm itinerary, review segments, animated demo issuance, revisitable travel-pass wallet. All issued passes are explicitly non-valid DEMO credentials; no reservation, charge, identity collection or immigration entitlement. Unknown high-speed fares remain unknown.
- One shared paused simulation snapshot during ticketing. Changes to time, endpoints, passenger preference, taxi policy or exact itinerary invalidate navigation replay. Stored credentials remain readable. Interrupted issuance, Back/history/BFCache and repeated clicks cannot produce duplicate or background issuance.
- West Kowloon and Futian procedural isometric floor models, with documented floor functions, source links, selectable levels and navigation-step inspection. All positions and connections are schematic and excluded from routing. No surveyed indoor geometry or exact gate/accessibility promise. Existing source-backed station views remain available.
- Canonical named-floor origins with a verified loaded source schedule now receive an immediate explicit closure result through the original schedule predicate. Unknown identities, arbitrary points and whole-place requests retain their existing routing path. Destination opening is not tested at origin-departure time.
- Source-region disconnection messages no longer incorrectly imply every missing connection requires crossing the harbour. No invented routing links were added.

## Verification scope

Module checks: 17 ticket-page tests, 9 station-model tests including 240 fixed-seed display-state probes, 5 source-opening tests, and 10 actual-source ticket/model integration tests. Full aggregate: `npm test` passed 424/424 tests (0 failed/skipped), 283.39 seconds, against the pre-clock-fix runtime. Syntax and diff checks passed. Final seeded results are recorded below.

The seeded cohort contains 16 scenarios and 15 unique ordered OD identity pairs. Sampling is with replacement, independent of route success; preference/time/taxi policy vary together. It is diagnostic coverage, not a Hong Kong-wide success-rate estimate.

The v49 baseline returned candidates in 10/16 scenarios (62.5%): 21/21 candidates passed its endpoint, continuity, source-closure and fare checks. Two scenarios completed without a route; four remained pending at 60 seconds. A separate extended AUS replay completed without a route at 82.77 seconds. Final checks add explicit effective-preference and paid-journey-clock audits and therefore are a stricter audit, not a directly identical pass-rate test.

Eight separately reported high-speed terminal/time model queries passed ordered-clock and unknown-fare checks. These are not additional real local-network OD scenarios.

## Known coverage limits

EXC has an internally connected source station model but no loaded external bridge; AUS F's stair endpoint is a disconnected seven-node component. Their identities are preserved and no nearby endpoint is silently substituted. Schematic station floors do not repair these source gaps.

The model-module static PNGs verify diagram rendering only. Module-stage browser subprocess launch failures are retained in the module reports; integrated cloud-browser QA is reported separately below. No mobile hardware performance is inferred from a resized browser.

## Additional clock defect found by stricter sampling

Two taxi-first/metro candidates failed the added exact-clock audit despite passing the original suite. The public suffix display duration had been rounded up before composition, introducing 4.858 seconds and 54.229 seconds of disagreement with the actual steps. Actual public-route departure and taxi-first/taxi-last scheduling already used exact clocks. Composition now uses the original source journey duration; displayed totals alone are rounded. No scheduling or facility checks were weakened.

Seven targeted regressions reproduced the old failures and pass after the repair; the focused endpoint/policy/clock suite passed 28/28. Pre-fix evidence remains separately named and must not be mistaken for final validation.

## Final integrated verification

- Rebuilt runtime `5526e22eeac9`: `npm test` **431/431 passed**, zero failed/skipped, 275.70 seconds.
- Same 16 seeded scenarios: **10/16 returned complete candidates (62.5%)**, with **21/21 candidates passing all strict checks**, including requested/effective preference, exact paid-journey clock, endpoint identity, path continuity, source closures and pricing invariants. Both previously failing taxi-first candidates now pass.
- Five scenarios completed with an explicit unavailable result: the two diagnosed source-network gaps and three closed-floor origins. One AUS scenario remained pending at 60 seconds; it is not reported as NO_ROUTE. Terminal-response count is 15/16.
- All 16 preserved requested identity, stable runtime, working cancellation and no stale result publication; no worker error.
- Closed-floor results completed in 4.18–5.85 ms after data readiness (cold startup remained 6.1–6.6 seconds). The open 11:00 floor scenario still returned a valid source-resolved journey. These measurements are cloud harness observations, not mobile benchmarks.
- Public reproducibility artifacts: `validation/seeded-routes/final/{fixture,summary,invariants}.json`; the fixed-seed runner returns nonzero for failed invariants, worker/probe errors or nonzero scenario exits. Pending observations retain their separate class.

Browser QA was pending at source packaging. The public release PR records the subsequent integrated cloud-browser observations and any limitations; the module-stage static PNGs do not substitute for that UI check.
