# Playback CI timing repair

## Finding

The prior GitHub run reported 378 of 379 tests passing, with the sole failure at `tests/navigation/ui-harness.mjs:88`: `global playback actually advances`. The test clicked Play, slept for 350 ms, then paused. That assumes at least two callbacks from the application's 100 ms interval.

The actual global clock clears its previous tick anchor on Play. Its first active callback establishes that anchor; the second advances time. `trafficActive()` additionally guards hidden documents and station, mall, and navigation views. Inspection found one guarded interval, advancing this same clock before rendering. No runtime clock defect was identified.

`timer-reproduction.mjs` imports the real clock and uses native Node timers. A deliberate 500 ms event-loop stall lets the old 350 ms pause fire after only the first interval callback: one tick, simulation time still 29040. Under the same stall, condition-driven waiting observes two callbacks and time 29041.00415297 before pausing. This reproduces the failure mechanism, not the original CI runner's exact load or GC history.

## Repair

- The departure-time UI case now waits up to 10 seconds for actual global clock progress while still playing, then pauses. It retains the real-progress assertion and adds explicit foreground, playing, and paused-state checks. Existing clock-input, orders, vehicles, snapshot, and stale-result checks remain.
- The traffic UI case uses the same bounded progress condition after returning to the foreground instead of a fixed 250 ms resume delay. The hidden-view no-progress assertion remains.
- A deterministic unit test covers delayed first-tick priming, second-tick advancement, pause stability, hidden-view stability, and fresh anchoring on foreground return.

The application interval is not mocked or advanced manually by the UI tests. The tests still fail if playback never advances.

## Verification

- `npm test`: 380 passed, 0 failed, 0 skipped; 229697.734319 ms. The log includes the updated condition-driven resume marker.
- Final independent reruns of `HK_BOOT_CASE=traffic node tests/navigation/ui-harness.mjs` and `HK_BOOT_CASE=departure-time node tests/navigation/ui-harness.mjs`: passed.
- Clock unit suite: 9 passed.
- Native timer reproduction: passed. See `native-timer-reproduction.json`.
- `git diff --check`: passed.
- Application source, distribution, scripts, and package metadata are unchanged from source baseline `0970cf7d0b2c40e3250199906b2b4a3c02ffd707`.

Runtime stays `0f6587f77445`, built at `2026-10-13T10:18:10.194Z`. No rebuild, Site version, deployment, or GitHub write was performed for this repair. Browser visual QA was not repeated because application/runtime files did not change; the final UI checks use the real entry and Worker with the DOM harness.

Machine-readable results are in `verification.json`; concise test output is in `test-summary.log`.
