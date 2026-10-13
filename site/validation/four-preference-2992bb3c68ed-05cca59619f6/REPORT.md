# Four-passenger-mode real-point regression

- Runtime: 2992bb3c68ed
- Routing-asset signature: 05cca59619f6fad154cec442ac2d70a9d0b83f5164ebc3b335e3243dffdd35e4
- Result: 16/16 newly executed cells passed; complete matrix PASS
- Runtime stability: all 16 pinned observations retained the exact frozen signature
- Source preservation: 8/8 area/transit files are byte-identical to fd323a328ba2
- First available route: 3.94–13.61 s. Full comparison: 5.50–41.82 s. These one-run Node timings are diagnostic, not browser/device performance guarantees.

## Fixed requests and results

Pacific Place LG1 → L4 and Admiralty E2 → Hung Hom B2 lift portal. All cells depart at 11:00 Asia/Hong_Kong on 2026-10-12. Endpoints and source floors were selected before the result was known.

| OD | Preference | Taxi | Result | Available route | Complete comparison |
| --- | --- | --- | --- | --- | --- |
| mall-floors | ordinary | off | PASS | 5 min / HK$0.00 | 9.24 s |
| mall-floors | ordinary | on | PASS | 5 min / HK$0.00 | 10.80 s |
| mall-floors | luggage | off | PASS | 5 min / HK$0.00 | 9.39 s |
| mall-floors | luggage | on | PASS | 5 min / HK$0.00 | 15.79 s |
| mall-floors | escalator | off | PASS | 5 min / HK$0.00 | 9.40 s |
| mall-floors | escalator | on | PASS | 5 min / HK$0.00 | 15.39 s |
| mall-floors | lift | off | PASS | 5 min / HK$0.00 | 9.12 s |
| mall-floors | lift | on | PASS | 5 min / HK$0.00 | 15.57 s |
| exits-cross | ordinary | off | PASS | 24 min / HK$7.87 | 5.50 s |
| exits-cross | ordinary | on | PASS | 24 min / HK$7.87 | 9.89 s |
| exits-cross | luggage | off | PASS | 31 min / HK$7.87 | 14.00 s |
| exits-cross | luggage | on | PASS | 31 min / HK$7.87 | 38.86 s |
| exits-cross | escalator | off | PASS | 24 min / HK$7.87 | 14.82 s |
| exits-cross | escalator | on | PASS | 24 min / HK$7.87 | 41.82 s |
| exits-cross | lift | off | PASS | 24 min / HK$7.87 | 14.31 s |
| exits-cross | lift | on | PASS | 24 min / HK$7.87 | 41.03 s |

## Invariants and facility evidence

Every available candidate (16 total) retains the original endpoint/XYZ or disclosed same-floor portal, continuous geometry, closed/disabled-edge checks, complete segmented fare, taxi policy and luggage vehicle-confirmation checks. Added audits verify requested/effective preference, paid journey clock, endpoint/facility opening intervals and no promotion of unknown wheelchair suitability. 16/16 candidates pass all checks.

The source graphs were not edited: graph hashes preserve every source node, edge and original facility-evidence field. Pacific Place luggage/lift routes retain source lift ADM:P:250020515. Cross-harbour ordinary/escalator routes retain HUH:I:1000858058 and HUH:I:1000858891:r; luggage/lift routes keep their longer source-lift chain. Unknown wheelchair evidence remains unknown, even where ordinary or facility-preference travel remains legal.

Enabling taxi does not establish an unverified floor/node-to-road connection. All 8 unavailable direct-taxi choices retain UNVERIFIED_ENDPOINT_ACCESS and a separately summed illustrative fare scenario (additional retained-result audit: PASS). No available taxi itinerary occurs for these fixed exact-floor/source-node endpoints, so this matrix covers taxi inclusion and safe endpoint refusal, not success of every taxi/intermodal combination. The cross-harbour walking-only choice remains NO_ROUTE; it does not invalidate its completed public-transport alternative.

## Failures and historical comparison

No pending cells, empty comparisons, worker errors, OOMs, cancellation failures or structural audit failures were observed.

Historical retained-field comparison: 16/16 unchanged. All retained request/candidate/unavailable fields match the selected historical references. Those reports originate from older runtimes and are comparison evidence only. They do not count as execution of this runtime, and raw full historical journey geometry was not saved.

## Reproduce and scope

Run: node tests/navigation/four-preference-run.mjs --dist=validation/four-preference-2992bb3c68ed/runtime --runtime=2992bb3c68ed --run
Render report: node tests/navigation/four-preference-report.mjs validation/four-preference-2992bb3c68ed-05cca59619f6

Use a fresh output directory if the audit changes. The runner is dry by default, requires the exact runtime, compares source asset hashes, and runs fresh processes serially with 60-second observations and 90-second external watchdogs. Main heap is 768 MiB; each Worker heap is 384 MiB. Heap limits are not an RSS cap.

This is bounded diagnostic coverage of two real-point ODs using built production code and real source-data fixtures in a Node DOM stand-in. It is not actual-browser visual QA, all-Hong-Kong route coverage, live lift availability, official live fares, taxi booking, or wheelchair-route certification. Source-backed does not mean live verified.
