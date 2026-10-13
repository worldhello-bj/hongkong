# Final runtime 5274ca0d14f4 verification

- Build and syntax checks passed. Runtime source files remain unchanged after this build.
- Full serial `npm test`: 125 passed / 127 total, 371.24 seconds. Original complete log retained as npm-test-5274-original.log.
- One failure was the obsolete static scheduler assertion expecting walk in the first two-task pool. Updated it to require public+taxi followed by non-stale walk; the behavior is independently exercised in progressive-fallback.test.mjs.
- The expanded integration file exited abnormally during the full run under shared-host memory pressure; the terse runner did not identify the termination signal. No route assertion failure was emitted. Do not claim a confirmed kernel OOM solely from this output.
- Isolated rerun with `node --max-old-space-size=1024 --test --test-concurrency=1 tests/navigation/expanded-integration.test.mjs tests/navigation/policy.test.mjs`: 10/10 passed, exit 0, wall 69.11 seconds. KOW C1 reaches the same outside endpoint using actual full f2 with Admiralty detail. Logs retained. Heap limit changes Node GC behavior, not routing constraints or production search budget.
- Focused new parameter/lifecycle/progressive/intermodal tests: 18/18 passed before the aggregate run.
- This is complete individual-case coverage after repair, not a claim that the final aggregate was rerun successfully as a single 127/127 campaign.

See ../performance/README.md for same-input production timing/RSS, known 60-second pending cases, and the boundary between Node instrumentation and browser visual QA. See ../README.md for the negative feeder-winner result and excluded missing-network cases.
