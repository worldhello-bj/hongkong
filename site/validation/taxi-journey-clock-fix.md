# Taxi/public journey exact-clock repair

Verified 2026-10-13. Module-stage source repair; this report excludes the later integrated build and route-search verification.

## Root cause and scope

`composeTaxiJourney` in `src/navigation/taxi-bridge.js` added `suffix.totalMinutes` to the exact taxi drop-off clock. Production public-route results round that display value upward with `Math.ceil(l.total_minutes)`, while their source journey, timed legs, step guidance, and segments retain fractional minutes. The extra rounding therefore changed the composite known duration and reported arrival, without adding any corresponding travel or waiting step. A second display rounding could overstate the whole journey by more than a minute.

The repair uses finite `suffix.journey.knownMinutes`, which production derives from the same unrounded source route total. If that field is absent, it sums the unchanged guidance minutes. `totalMinutes` is rounded only when presenting the whole composed result. No steps, segments, endpoint requests, facility evidence, preferences, access classification, quotes, or scheduling calls are modified.

## Frozen regression evidence

The new fixture `tests/navigation/fixtures/taxi-journey-clock-seeded.json` retains both source-report hashes, request clocks, exact step durations and segment minutes, quote/connector durations, and old aggregate values. It is a compact clock replay, not a geometry or route-search replay.

- `seeded-v50/surface-stops-2.json`, runtime `c1d9f0142f40`, luggage, 08:03, `taxi-first-metro-AUS:portal:B2`: public suffix 52.91903355827592 minutes rounded to 53; old arrival 32653.799986503444 seconds versus step arrival 32648.941999999995. The unnecessary increment was 4.857986503449 seconds. Repaired known duration is 61.14903333333326 minutes to floating-point tolerance.
- `seeded-v50/surface-stops-4.json`, same runtime, lift, 23:00, `taxi-first-metro-ADM:portal:E2`: public suffix 47.096176814404124 minutes rounded to 48; old arrival 85924.27399113575 seconds versus step arrival 85870.04460000001. The unnecessary increment was 54.229391135740 seconds. Repaired known duration is 51.16741000000014 minutes; display is 52 rather than 53 minutes.

## Actual scheduling boundary review

- Taxi-first calls the public router at exact `quote.dropoffS + link.durationS`; the repair retains that departure and all already-computed scheduled legs.
- Taxi-last requests its quote at exact `prefix.arrivalS + link.durationS`; production public transit results pass through the source router's `arrivalS`. This is independent of the rounded display duration.
- The legacy taxi-last fallback uses `totalMinutes` only when `arrivalS` is absent. This unsupported/incomplete timestamp shape was not observed in the production reports and was not changed in this bridge-only repair.

The regression calls the actual `planTaxiCandidates` with deterministic small public/quote providers for all four preferences. It asserts exact first/last call times and subjects their composed steps to the unchanged strict audit, including a synthetic scheduled edge whose accepted departure must equal the time used to plan that public route.

## Verification

New `tests/navigation/taxi-journey-clock.test.mjs`: 7 tests. All 7 failed against the original bridge and all 7 pass after the repair. Both historical defective aggregate formulas are reproduced within the tests and still fail the strict audit, including the lift case's display check.

Focused command:

```sh
node --test --test-concurrency=1 tests/navigation/taxi-journey-clock.test.mjs tests/navigation/generic-taxi.test.mjs tests/navigation/taxi-policy.test.mjs tests/navigation/taxi-endpoint-contract.test.mjs
```

Result: 28 passed, 0 failed, 0 skipped. Existing exact XYZ/source-node, incomplete floor access, publisher usability, luggage confirmation, and unsupported-preference checks remain passing. Full suite and rebuilt runtime matrix results are documented separately in the integrated report.

`tests/navigation/four-preference-audit.mjs` is unchanged, SHA-256 `2d3d3c6b70d505ff01418d8387433894a476c44482f3124b17c017e90143688c`.

Only production edit: `src/navigation/taxi-bridge.js`. New files: the regression test, compact fixture, and this report. This isolated repair does not change main/UI code or the existing audits.
