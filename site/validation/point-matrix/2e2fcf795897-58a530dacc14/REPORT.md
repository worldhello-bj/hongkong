# Hong Kong 14-cell supplement: 2e2fcf795897

Completed on 2026-10-12. **14/14 genuine complete comparisons; 14/14 retained-data comparisons and new route assertions pass.** Ten cells have ten complete candidates; four strict-accessibility cells retain the same negative results. There are zero pending observations, Worker/background errors or invariant failures. All 48 created Workers exited and all 14 cancellation/endpoint identity checks passed. The serial runner exited 0 and released its lock.

## Version and comparison scope

- Baseline: b702b6920092, signature `f32dfcc1a1ba60f3987b03f198560960bd23364aeb86d8600395d1ea86313fc3`, the earlier full 60-cell matrix.
- Supplement: 2e2fcf795897, signature `58a530dacc14c45c5e58342db8aa4ed9337136ab77a68e960a9079cda499c099`, only the selected 14 cells.
- Fixed fixture SHA-256: `791197c289bf10787b0104c3d1fc5ba70ec030f305507cc56b924be744588b0e`. All 9 JSON/gzip source-data asset hashes match the baseline.
- Exact request, preferences, taxi flags, every retained candidate field, every retained unavailable field and all fare scenarios compare recursively equal. Runtime/wall/Worker/stage/audit diagnostics are excluded; the sole omitted field inside retained candidates is the strict predicate module's provenance hash.
- Older observations did not retain full raw journey geometry. **No byte-equality claim is made for omitted geometry.** Every newly produced journey independently passes endpoint/floor/source/continuity/preference/fare assertions.
- The unrun 9e104c614b66 supplement was superseded after a cross-route walk-cache endpoint-schedule defect was reproduced. This 2e2 build includes the subsequent exact clock/date-key correction. These 14 fixed-departure fresh-process observations are not a warm-cache regression test.

## Before/after wall time

Seconds, single observations; first time is absent when no complete candidate exists. Full time requires actual complete comparison.

| Cell | First b702 | First 2e2 | Full b702 | Full 2e2 | Full change | Result |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| exits-cross-ordinary-taxi-off | 5.717 | 5.566 | 7.978 | 7.825 | -1.9% | complete candidate, equal |
| exits-cross-ordinary-taxi-on | 6.649 | 5.807 | 15.522 | 13.890 | -10.5% | complete candidate, equal |
| exits-cross-accessible-taxi-off | — | — | 49.002 | 51.441 | 5.0% | complete negative, equal |
| exits-cross-accessible-taxi-on | — | — | 47.903 | 43.919 | -8.3% | complete negative, equal |
| mall-floors-ordinary-taxi-off | 26.080 | 13.596 | 30.776 | 16.588 | -46.1% | complete candidate, equal |
| mall-floors-ordinary-taxi-on | 27.948 | 12.183 | 31.111 | 15.280 | -50.9% | complete candidate, equal |
| mall-floors-luggage-taxi-off | 22.692 | 9.793 | 25.623 | 13.608 | -46.9% | complete candidate, equal |
| mall-floors-luggage-taxi-on | 28.402 | 16.527 | 32.011 | 19.533 | -39.0% | complete candidate, equal |
| mall-floors-escalator-taxi-off | 27.169 | 11.760 | 30.471 | 16.373 | -46.3% | complete candidate, equal |
| mall-floors-escalator-taxi-on | 28.115 | 17.272 | 31.632 | 20.338 | -35.7% | complete candidate, equal |
| mall-floors-lift-taxi-off | 28.308 | 9.405 | 32.061 | 12.437 | -61.2% | complete candidate, equal |
| mall-floors-lift-taxi-on | 33.005 | 19.886 | 37.032 | 23.487 | -36.6% | complete candidate, equal |
| mall-floors-accessible-taxi-off | — | — | 22.393 | 11.472 | -48.8% | complete negative, equal |
| mall-floors-accessible-taxi-on | — | — | 32.812 | 13.647 | -58.4% | complete negative, equal |

Pacific Place first-result median (8 available cells): **28.032 → 12.890 seconds** (-54.0%). Full-comparison median (all 10 mall cells): **31.372 → 15.826 seconds** (-49.6%). All ten mall full-comparison observations are faster. This is not a device/browser latency guarantee or an isolated causal benchmark.

## Retained constraints and fares

- Exit ordinary OFF/ON: the available public journey retains walk → metro → walk, HK$0.00 + HK$7.87 + HK$0.00. Taxi ON retains an unavailable HK$78.80 walk/taxi/walk quotation with exact source endpoints and UNVERIFIED_ENDPOINT_ACCESS. No physical curb connection has been added or verified.
- All eight non-strict mall cells retain a complete LG1 → L4 source-floor journey and HK$0.00 walking fare. Explicit named-floor portal resolution is audited; a common representative coordinate never substitutes for the selected floor.
- Exit strict OFF/ON retain no complete cross-harbour candidate under the recorded transport boarding/accessibility-evidence policy. Separate source analysis already establishes that the exact HUH lift node can reach station platforms under the strict physical predicate.
- Mall strict OFF/ON retain no eligible upper-floor source connection under the strict source predicate. This is a source/evidence limitation, not a statement that actual facilities are physically inaccessible.
- 14 complete-candidate pricing legs were audited. All unavailable per-leg fare scenarios, incomplete reasons and endpoint-access states remain available in each cell JSON and the derived summary.

## Evidence

- [Machine-readable supplement summary](supplement-summary.json) with all before/after timing, source-data hashes, candidate fares, unavailable scenarios and comparison hashes.
- [Serial run summary](summary-A-selection-post-b702-source-input-floor-precheck.json).
- Each `<cell>.json` holds original observation/audit data; each `<cell>.comparison.json` holds the retained-data comparison.
- [Earlier b702 full60 report](../b702b6920092-f32dfcc1a1ba/REPORT.md), including all candidates, 292 pricing legs, full timing distributions and five-price-weight sensitivity. Its results remain attributed to b702.

The point harness/auditor/source-eligibility/fixture code hashes match the baseline audit version `point-strict-source-v2`. Point assertion/supplement unit tests passed 24/24 independently at 17:24 UTC; this is distinct from the parent aggregate suite and final exact-commit CI. No production or test implementation was changed during this supplement.
