# Four-passenger-mode real-point regression

- Runtime: 59ea6d932726
- Routing-asset signature: 301671449fc3b5d99fb4b37691beb73c62fc3201fa4624a502bbfce2211ea51c
- Result: 16/16 newly executed cells passed; complete matrix PASS
- Runtime stability: all 16 pinned observations retained the exact frozen signature
- Source preservation: 8/8 area/transit files are byte-identical to fd323a328ba2
- First available route: 3.77–13.89 s. Full comparison: 5.23–42.85 s. These one-run Node timings are diagnostic, not browser/device performance guarantees.

## Fixed requests and results

Pacific Place LG1 → L4 and Admiralty E2 → Hung Hom B2 lift portal. All cells depart at 11:00 Asia/Hong_Kong on 2026-10-12. Endpoints and source floors were selected before the result was known.

| OD | Preference | Taxi | Result | Available route | Complete comparison |
| --- | --- | --- | --- | --- | --- |
| mall-floors | ordinary | off | PASS | 5 min / HK$0.00 | 10.00 s |
| mall-floors | ordinary | on | PASS | 5 min / HK$0.00 | 11.37 s |
| mall-floors | luggage | off | PASS | 5 min / HK$0.00 | 9.66 s |
| mall-floors | luggage | on | PASS | 5 min / HK$0.00 | 15.58 s |
| mall-floors | escalator | off | PASS | 5 min / HK$0.00 | 9.56 s |
| mall-floors | escalator | on | PASS | 5 min / HK$0.00 | 15.08 s |
| mall-floors | lift | off | PASS | 5 min / HK$0.00 | 9.26 s |
| mall-floors | lift | on | PASS | 5 min / HK$0.00 | 15.60 s |
| exits-cross | ordinary | off | PASS | 24 min / HK$7.87 | 5.23 s |
| exits-cross | ordinary | on | PASS | 24 min / HK$7.87 | 9.81 s |
| exits-cross | luggage | off | PASS | 31 min / HK$7.87 | 13.64 s |
| exits-cross | luggage | on | PASS | 31 min / HK$7.87 | 39.31 s |
| exits-cross | escalator | off | PASS | 24 min / HK$7.87 | 14.36 s |
| exits-cross | escalator | on | PASS | 24 min / HK$7.87 | 40.97 s |
| exits-cross | lift | off | PASS | 24 min / HK$7.87 | 15.43 s |
| exits-cross | lift | on | PASS | 24 min / HK$7.87 | 42.85 s |

## Invariants and facility evidence

Every available candidate (16 total) retains the original endpoint/XYZ or disclosed same-floor portal, continuous geometry, closed/disabled-edge checks, complete segmented fare, taxi policy and luggage vehicle-confirmation checks. Added audits verify requested/effective preference, paid journey clock, endpoint/facility opening intervals and no promotion of unknown wheelchair suitability. 16/16 candidates pass all checks.

The source graphs were not edited: graph hashes preserve every source node, edge and original facility-evidence field. Pacific Place luggage/lift routes retain source lift ADM:P:250020515. Cross-harbour ordinary/escalator routes retain HUH:I:1000858058 and HUH:I:1000858891:r; luggage/lift routes keep their longer source-lift chain. Unknown wheelchair evidence remains unknown, even where ordinary or facility-preference travel remains legal.

Enabling taxi does not establish an unverified floor/node-to-road connection. All 8 unavailable direct-taxi choices retain UNVERIFIED_ENDPOINT_ACCESS and a separately summed illustrative fare scenario (additional retained-result audit: PASS). No available taxi itinerary occurs for these fixed exact-floor/source-node endpoints, so this matrix covers taxi inclusion and safe endpoint refusal, not success of every taxi/intermodal combination. The cross-harbour walking-only choice remains NO_ROUTE; it does not invalidate its completed public-transport alternative.

## Failures and historical comparison

No pending cells, empty comparisons, worker errors, OOMs, cancellation failures or structural audit failures were observed.

Historical retained-field comparison: 16/16 unchanged. All retained request/candidate/unavailable fields match the selected historical references. Those reports originate from older runtimes and are comparison evidence only. They do not count as execution of this runtime, and raw full historical journey geometry was not saved.

## Final-build rerun versus intermediate build

This report accepts the final runtime 59ea6d932726. The earlier 2992bb3c68ed report remains an intermediate observation. All 16 final cells were independently executed from the final frozen runtime; none was reused from the intermediate build. The complete retained request/candidate/facility/clock payload is unchanged in 16/16 cells. See INTERMEDIATE-COMPARISON.md and intermediate-comparison.json for exact per-report hashes and differences.

## Reproduce and scope

Run: node tests/navigation/four-preference-run.mjs --dist=validation/four-preference-59ea6d932726/runtime --runtime=59ea6d932726 --run
Render report: node tests/navigation/four-preference-report.mjs validation/four-preference-59ea6d932726-301671449fc3

Use a fresh output directory if the audit changes. The runner is dry by default, requires the exact runtime, compares source asset hashes, and runs fresh processes serially with 60-second observations and 90-second external watchdogs. Main heap is 768 MiB; each Worker heap is 384 MiB. Heap limits are not an RSS cap.

This is bounded diagnostic coverage of two real-point ODs using built production code and real source-data fixtures in a Node DOM stand-in. It is not actual-browser visual QA, all-Hong-Kong route coverage, live lift availability, official live fares, taxi booking, or wheelchair-route certification. Source-backed does not mean live verified.
