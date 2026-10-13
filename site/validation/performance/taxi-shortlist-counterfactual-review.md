# OD7 taxi shortlist counterfactual: pre-execution review

Status: prepared and syntax checked only. No route, Worker, comparison arm, or browser acceptance test has been executed for this experiment.

## Question and bounded change

Does adding the real westbound tram stop `td:99133` (金鐘港鐵站, `[114.16454, 22.27827]`) as one extra last-mile taxi anchor produce a useful complete journey for the existing fixed-seed land OD7?

The production selector currently keeps one tram anchor per side. Earlier lightweight enumeration found `td:99133` eligible under the same distance, direction and spacing rules, but omitted by that cap. Its roughly 533 m straight-line feeder is shorter than the selected `td:99126` feeder (roughly 1,510 m). The source service can retain a longer tram mainline. These are selection hypotheses, not road distances, verified walking access, or evidence of a better complete journey.

Implementation: `tests/navigation/taxi-shortlist-counterfactual.mjs`.

- Baseline invokes both original default selectors with their original arguments.
- Experimental arm invokes those same selectors, then appends only `td:99133` to the end of `last`. `first` and every existing `last` object remain unchanged, with runtime assertions.
- The appended object comes from the same production selector with explicit `{metro:100,bus:100,tram:100}` limits. It must still pass the original geography/direction/spacing filters, must retain its exact source coordinates, and must be absent from the default list. A drift assertion fails rather than constructing a new anchor.
- The actual production order remains last-side candidates followed by first-side candidates. The appended query therefore can delay first-side queries; a difference at the observation cutoff cannot by itself establish candidate-quality improvement.

## Identical inputs

Both arms run in separate clean Node processes, sequentially, using the same current `dist` and an explicit pinned runtime version and full asset signature.

| Input | Value |
|---|---|
| Fixture | `tests/navigation/fixtures/land-coverage-72.json`, row 7 |
| Land selection seed | 20261011 |
| Origin | `[114.19780266014673, 22.27037983652672]`, original fixture object |
| Destination | `[114.16388501171271, 22.2735175495032]`, original fixture object |
| Preference | ordinary |
| Departure | 2026-10-12 11:00, Asia/Hong_Kong, 39,600 s |
| Taxi simulation seed | production 42, asserted |
| Route observation | 60,000 ms per arm |
| External safety watchdog | 90,000 ms per process including boot/reporting |
| Heap settings | main 768 MiB; each Worker old generation 384 MiB, matching the point harness |

The historical OD7 preference summary only motivated selection. Its former 08:00 results are not used as this experiment's baseline. Both 11:00 arms must be observed anew.

All public and block data must finish loading before the plan click. Boot is reported separately. No earlier matrix, frozen snapshot or production file is written. No graph dataset is copied. The script's default action is a lightweight static check, not a route run.

## Production path and unchanged constraints

The probe follows the existing point-matrix harness's DOM stand-ins and Worker adapter. It imports the real built S1 entry with its dependencies converted to absolute file URLs. Only its taxi candidate import is redirected to an in-memory instrumented module. The Worker bundles, graph preparation, public prefix/suffix routing, taxi simulation, quoting, composition, connector guard, facility/closure/endpoint constraints, and final scoring remain production code.

Instrumentation replacements assert an exact single anchor. They add observations or the one append-only candidate, not alternate route geometry or invented access. The public-route compatibility predicate is evaluated exactly once and its actual result is logged. `ask` remains synchronous. No weight, route budget, search pruning, service time, curb guard or accessibility condition changes.

The 95% guard remains exactly `feederRoadLength >= directRoadLength * .95` for rejection. Reports retain the real passenger distances, threshold, ratio and outcome. If no direct quote exists, the guard is not active and is reported as not evaluated, never as passed. A quote not reached or unavailable is also not a passed guard.

## Output evidence and rejection paths

Each arm produces a report, pre-cancellation event trace and process exit report; the pair produces `comparison.json`.

- Exact original request identities, runtime version and hashes of all code/data included by `runtimeIdentity`, fixture hash, fetch hashes, and transformed-module/script hashes.
- Actual service pattern, stop-sequence and original `shape` hashes for the added stop and used public legs. Preserve provenance and modeled/frequency-estimate disclosures.
- Default/actual shortlist, source stop identity, selection score and straight-line feeder proxy.
- Candidate start, road/connector acceptance, pending/public-return states, original public query clock, exact raw failure/message/overlay result, synchronous taxi quote clock/wait/road distance, 95% outcome, production diagnostic, publish, and final dedup retention.
- Full production quote legs and integer-cent sum audit; whole-trip minutes, HKD cost, walking minutes, waiting minutes, transfers, mode sequence, warnings and endpoint/constraint audits.
- `not-started`, `public-query-pending`, `no-taxi-quote`, `outside-road-coverage`, `rejected-curb-guard`, public prefix/suffix rejection, `not-a-shorter-feeder`, published-incomplete and error states remain distinct. If the plan never reaches candidate enumeration, the plan status explains that limitation.
- The composed taxi result does not preserve public `timedLegs`. Therefore the probe separately audits the actual returned public prefix/suffix's transit stop/shape boundaries. Empty composite boundary lists are not represented as proof of those boundaries.
- Choices, trials, events and performance state are frozen at the observation cutoff before cancellation. Audits run afterward; late cancellation results cannot turn a pending observation into success.
- Worker errors, original S1 comparison errors, resource failures, cancellation checks and request/runtime drift are explicit failure or inconclusive classifications.

An emitted scenario remains modeled/unverified where production labels it so. A schematic curb connector is not proof of real vertical, wheelchair or physical boarding access. No mall connection or missing railway service is introduced.

## Offline sensitivity comparison

Call the built production `rankJourneys` and `journeyScore` on the same observed complete choices, using priority `time`, need `ordinary`, and only `{cost: .25}`, `{cost: .75}`, `{cost: 2}` overrides. Other default time, walk, wait, transfer and facility terms stay unchanged. Do not switch to the `walk` or `cost` preset.

The output includes the full scoring terms, metrics and audit status, both pre-dedup observed candidates and final production-retained choices. A common-candidate comparison checks whether shared candidates' metrics stayed identical between arms. Scores only describe the observed pool; the production shortlist's own fixed `.75` heuristic is unchanged, so this is not proof of globally optimal generation under other price weights.

No pending, absent or rejected journey is assigned a synthetic score or called dominated. The pair is conclusive only when both complete with valid audits and stable identical inputs. Even a complete added candidate is merely ready for tradeoff review, not automatically an improvement. The top-level exit code is 0 only for both completed arms with an audited complete target, 2 for pending/no complete target, and 1 for execution/invariant/resource failures.

## Verified now

At preparation time the current built runtime was `9e104c614b66`.

Passed, without importing S1 or creating Workers:

```sh
node --check tests/navigation/taxi-shortlist-counterfactual.mjs
node tests/navigation/taxi-shortlist-counterfactual.mjs --check
```

The second command parses both transformed modules and validates the fixture seed/coordinates and exact instrumentation anchors. It does not establish that routing, quotation, candidate feasibility or the complete comparison succeeds. The harness must still be dynamically exercised during the separately scheduled resource window.

## Deferred execution command

Only after the parent grants the serial heavy-test window, with a stable runtime and a new output directory:

```sh
HK_COUNTERFACTUAL_RUNTIME=9e104c614b66 \
HK_COUNTERFACTUAL_OUT=validation/performance/taxi-shortlist-9e104c614b66-od7-1100 \
node tests/navigation/taxi-shortlist-counterfactual.mjs --run
```

If runtime changes, review its selector/anchors and explicitly repin the intended version; the probe fails on unexpected drift. It refuses to overwrite existing output. A watchdog or execution/invariant failure stops the pair before starting further heavy work. No execution was performed as part of this preparation.
