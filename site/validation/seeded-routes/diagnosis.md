# Fixed-seed route diagnosis

## Frozen baseline and denominator

The original 16-cell run used runtime `d13e16e39f47`, signature `de37a37b41a5599ef9dc4ee5b7bbed94587c05a9e73453d667d5635ac37c6427`, seed 20261013, departure date 2026-10-13 (Hong Kong), and a 60-second observation window per fresh process. The original raw reports are retained separately; this document records their baseline summary without modifying them.

- 10/16 selected cells returned at least one complete candidate within the window (62.5%).
- Those cells produced 21 candidates, all passing the baseline checks. This is a 21/21 candidate invariant audit, not 21 tested OD pairs.
- 2/16 finished without a candidate.
- 4/16 remained pending when their 60-second windows ended. They are neither successful routes nor NO_ROUTE observations.
- All 16 preserved requested endpoint identity, retained a stable runtime, passed cancellation/stale-publication checks, and reported no worker error.
- The four land-pool draws were rows 1, 1, 19 and 33, with replacement. Thus there are 16 scenarios but 15 unique ordered OD identity pairs; the repeated land OD has different preference/time/taxi conditions and must not be silently discarded.
- No Hong Kong-wide success rate is established. The cohort is stratified and small; preference, departure time and taxi policy vary together, so it cannot isolate the effect of any one of them.

Keep all 16 original cells in the route-availability denominator, including closed-floor requests and source-data limitations. Report a separate terminal-response count if measuring responsiveness. A correct refusal can pass correctness checks without being a successful journey.

## Findings

### EXC B3 cells: source model lacks an external bridge

`station-portals-1`: EXC B3 → ADM C1, ordinary, 08:00, no taxi.

`station-portals-4`: KOW TCL platform → EXC B3, lift-first, 23:00, taxi enabled.

The exact EXC B3 node `EXC:N:faaafc3c73386c` exists in the station graph and has two live incident walk edges. Directed and reverse source-graph reachability each cover 631 nodes, all in EXC. They include the EXC entrances and platform-area nodes. The base area graph contains no copy of this exact node and no EXC rail or station-access bridge. Thus the loaded station model is internally useful but does not provide the external connection required by these requests.

The completed refusals are consistent with a source-connectivity limitation. This does not mean these trips are impossible in the real city. Adding an invented bridge or moving the requested endpoint would be incorrect. The old generic cross-harbour walking message is independently misleading for EXC → ADM, which are on the same shore; the integrated change repairs that wording.

### AUS D2 → F: source-disconnected endpoint and slow refusal

`station-portals-3`: `AUS:N:7144fc7f1bf80b` → `AUS:N:4ab0a937f564e0`, escalator-first, 11:00, no taxi.

The exact F stair portal is in a seven-node component in both the station and area source graphs. It has only its two stair edge copies and is disconnected from D2 even when all non-disabled, non-closed edge kinds are admitted. D2 reaches 670 station nodes or 58,693 area nodes without reaching F. The F-lift portal belongs to D2's station component, but it is a different endpoint; it cannot silently replace F.

Escalator-first is a soft preference. The refusal must not be explained as a blanket prohibition on stairs.

The original 60-second result is pending. A separate, frozen-v49 120-second replay completed after 82.769 seconds with zero candidates, `comparisonStatus=complete`, no worker error, preserved identity and a passing cancellation check. Its separate raw report is retained with the baseline evidence. Do not overwrite the original 60-second latency observation with this extended result.

The replay's expensive search stages include public-fast (17.563s), demo-public-fast (18.878s), and detailed transit (21.498s). Slow exhaustive refusal is a genuine latency finding even though missing source connectivity explains the final unavailable route.

### Closed named-floor origins: redundant work before an already-known refusal

`source-floors-1`: L4 → L3, ordinary, 08:00.

`source-floors-2`: L3 → L2, luggage, 08:03, taxi enabled.

`source-floors-4`: L1 → L3, lift-first, 23:00, taxi enabled.

All three are outside the loaded Pacific Place source rule 290000393, daily 10:00–22:00. Their original observations remain pending at 60 seconds. The source rule describes the loaded internal/podium paths, not an assertion that the entire property is closed.

The production `f2` resolver maps each canonical named floor to existing source portal nodes and applies the graph place's access rule. The existing walking engine rejects a closed origin through `engine.t(origin, departureS, 0, departureDate)` before searching. The intermodal synthetic origin only has dynamic walking departure connections evaluated at that starting clock, so it cannot escape this check by implicitly waiting inside a closed origin. Expensive alternative-origin searches explain avoidable work after a primary request whose origin access is already ruled out.

The new `evaluateOriginOpening(request, graph, canTraverse)` helper in `src/navigation/origin-opening.js` exposes that same check for canonical, source-resolvable named-floor origins. It:

- Uses the loaded graph schedule, never an arbitrary schedule supplied in the request.
- Requires the selected canonical floor identity and an existing source portal/node.
- Uses the original schedule predicate for daily/weekly and boundary behavior.
- Leaves unknown/malformed schedule, missing graph or topology, exact nodes, arbitrary points and whole-place XY requests to the existing routers.
- Never checks the destination merely at departure time; arriving after it opens remains possible.
- Preserves the request and supplies an unavailable result with the source rule and an explanation.

The whole-place XY case is intentionally excluded: the current direct-taxi endpoint policy differs from exact-floor policy, and changing it would be a separate eligibility fix. No connectors, graph edges, ranking rules or preference eligibility were changed here. S1 integration, final build and end-to-end replay are documented in the integrated verification report.

`tests/navigation/origin-opening.test.mjs` passes 5 tests, covering all five actual source floors at closed/open boundaries, request immutability, stale request schedule metadata, missing source topology, arbitrary/exact endpoints, destination-at-departure exclusion, malformed clocks, and weekly date semantics.

## Audit integrity

The baseline is useful but should be described at the depth it actually verifies:

- The baseline seeded harness invokes `auditCandidate`, covering candidate completion, endpoint identity/resolution, geometry continuity, forbidden source closures, fare arithmetic, ride-stop boundaries and taxi policy.
- It does not invoke the existing additive `auditFourPreferenceCandidate`; therefore baseline 21/21 is not a full paid journey-clock or explicit effective-preference audit. The updated harness adds those checks with the selected runtime's `engine.t`, using audit version `seeded-four-preference-source-clock-v1`; the original baseline raw reports remain unchanged. Final end-to-end validation is still required under the stricter audit.
- The baseline `auditProvenance.files` hashes `point-matrix-harness.mjs`, but not the actual `seeded-route-harness.mjs` or selection generator. The updated harness now hashes the actual executed harness, generator, additive audit and their dependencies.
- The generated baseline fixture retains legacy `selectionSeed=20261011`, land `rowIndices=[1,12]`, and a six-row limitation sentence inherited from the old fixture builder. Its actual new seed is the separate `seed=20261013` and it has 16 rows. The updated generator now records cohort seed 20261013, land-pool seed 20261011 and the actual one-based land picks [1, 1, 19, 33].
- Runtime identity hashes the loaded asset/data set before and after each cell, and each report stores the exact fixture hash. Retain this evidence.

## Deterministic replay recommendation

Do not redraw points after inspecting successes. Freeze the final built runtime, retain the original fixture's 16 exact requests, needs, taxi flags and times, and rerun all 16 serially in fresh processes at the original 60-second observation window. Use the same source hashes; intentional data changes require a separately named cohort rather than silently regenerating this one.

From the repository root, select a frozen build directory and a repository-local output directory. `FROZEN_DIST` is an explicit path chosen by the person reproducing the test; it must contain the built `assets`, `area`, `transit`, `taxi` and `build-meta.json` files. Do not rebuild or modify that directory during a run.

```sh
FROZEN_DIST=path/to/your/frozen-dist
REPORT_DIR=validation/seeded-routes/final
HK_POINT_DIST="$FROZEN_DIST" node scripts/seeded-route-audit.mjs --out="$REPORT_DIR"

HK_POINT_DIST="$FROZEN_DIST" \
HK_SEEDED_FIXTURE="$REPORT_DIR/fixture.json" \
HK_POINT_ROW=source-floors-1 HK_NEED=ordinary HK_TAXI=0 \
HK_REPORT_PATH="$REPORT_DIR/source-floors-1.json" \
timeout 90s node --max-old-space-size=768 tests/navigation/seeded-route-harness.mjs
```

The first command generates metadata only, without route searches. For a strict before/after comparison, copy the saved baseline fixture to the selected report directory instead of regenerating it, and verify that its source hashes match the chosen frozen build. Supply `HK_POINT_RUNTIME` with that build's expected version when running the harness.

To run all 16 generated cells serially with fresh processes, use:

```sh
HK_POINT_DIST="$FROZEN_DIST" node scripts/seeded-route-audit.mjs --run --out="$REPORT_DIR"
```

This uses each saved row's own preference and taxi policy. Do not run several full-route cells concurrently. The updated generator consistently honors `HK_POINT_DIST` for fixture sources, runtime identity and worker input. Its metadata-only regeneration against the frozen v49 snapshot was checked to preserve all 16 exact requests, preferences and taxi policies. Direct harness replay of a saved original fixture remains the clearest before/after comparison contract.

If a cell is still pending, retain that 60-second result and optionally do one explicitly separate 120-second diagnostic replay on the same frozen runtime. Never turn an observation timeout into NO_ROUTE. Keep resource/worker errors, incomplete comparisons and never-started planning separate from both source refusals and successful routes.

For the closed-floor repair, acceptance is: same original endpoints/clock and source rule, prompt explicit refusal, no routing-worker launch needed, truthful comparison completion metadata, and no changed destination-at-departure behavior. Validate the open 11:00 floor cell still returns the same admissible source-resolved journey. The ordinary route-availability denominator remains 16.

Audit-update verification: both updated JavaScript files pass syntax checks; the existing additive-audit and new origin-opening test suites pass 8 tests together. No full matrix was rerun for the audit edit.
