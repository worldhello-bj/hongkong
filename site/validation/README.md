# Intermodal / unified-UI validation, 2026-10-12

All travel times, fares, taxi availability and generalized scores below are demo model outputs, not measured Hong Kong journeys or real quotes. The coverage-only comparison excludes Admiralty–Mong Kok from evidence of algorithm benefit; that separate diagnosis omits the actual Tsuen Wan Line.

## Implementation

Generalized score uses minutes, HKD converted at an explicit minutes/HKD weight, extra walking/waiting burden and per-transfer minutes. Candidate scores are absolute, independent of other candidates, with no feeder bonus. Each taxi leg retains its own start fare and modeled cross-harbour surcharge. First/last-mile candidates use actual loaded rail exits and directed bus/tram stops, respecting physical connector guards and actual modeled arrival clocks.

## Covered route comparisons

### 覆盖走廊金钟至柯士甸

Candidate | Kind | Minutes | HKD | Generalized minutes
---|---|---:|---:|---:
public-all | public | 28 | 15.16 | 48.37
taxi-direct | direct | 15 | 90.37 | 84.67
taxi-last-metro-KOW:portal:A | last | 50 | 49.48 | 106.66

Weight sensitivity (minutes/HKD): 0 → taxi-direct, 0.25 → taxi-direct, 0.5 → public-all, 0.75 → public-all, 1 → public-all, 2 → public-all.

### 覆盖走廊柯士甸至金钟

Candidate | Kind | Minutes | HKD | Generalized minutes
---|---|---:|---:|---:
public-all | public | 30 | 15.16 | 51.02
taxi-direct | direct | 13 | 92.78 | 83.42
taxi-first-metro-KOW:portal:A | first | 55 | 44.16 | 109.76

Weight sensitivity (minutes/HKD): 0 → taxi-direct, 0.25 → taxi-direct, 0.5 → public-all, 0.75 → public-all, 1 → public-all, 2 → public-all.

### 覆盖走廊港岛接驳至柯士甸

Candidate | Kind | Minutes | HKD | Generalized minutes
---|---|---:|---:|---:
public-all | public | 40 | 18.16 | 68.52
taxi-direct | direct | 14 | 93.21 | 85.02
taxi-last-metro-KOW:portal:A | last | 64 | 47.16 | 124.27
taxi-last-tram-td:99137 | last | 22 | 91.24 | 97.83
taxi-first-metro-ADM:portal:E2 | first | 41 | 44.52 | 90.00

Weight sensitivity (minutes/HKD): 0 → taxi-direct, 0.25 → taxi-direct, 0.5 → taxi-direct, 0.75 → public-all, 1 → public-all, 2 → public-all.

### 覆盖电车走廊

Candidate | Kind | Minutes | HKD | Generalized minutes
---|---|---:|---:|---:
public-all | public | 29 | 3.00 | 33.75
taxi-direct | direct | 13 | 52.16 | 53.82
taxi-last-metro-ADM:portal:E2 | last | 27 | 32.00 | 58.60
taxi-last-tram-td:99220 | last | 22 | 32.00 | 51.85
taxi-first-metro-ADM:portal:E2 | first | 30 | 43.68 | 70.21
taxi-first-tram-td:99219 | first | 29 | 35.20 | 63.60

Weight sensitivity (minutes/HKD): 0 → taxi-direct, 0.25 → taxi-direct, 0.5 → public-all, 0.75 → public-all, 1 → public-all, 2 → public-all.

### 覆盖九龙公交走廊

Candidate | Kind | Minutes | HKD | Generalized minutes
---|---|---:|---:|---:
public-all | public | 44 | 6.43 | 58.82
taxi-direct | direct | 13 | 47.80 | 51.16
taxi-last-metro-HUH:portal:A3 | last | 41 | 44.32 | 88.29
taxi-last-bus-td:1280 | last | 32 | 46.92 | 80.54
taxi-first-metro-AUS:portal:B2 | first | 45 | 42.02 | 91.87

Weight sensitivity (minutes/HKD): 0 → taxi-direct, 0.25 → taxi-direct, 0.5 → taxi-direct, 0.75 → taxi-direct, 1 → public-all, 2 → public-all.

### 缺失荃湾线诊断金钟至旺角

Candidate | Kind | Minutes | HKD | Generalized minutes
---|---|---:|---:|---:
public-all | public | 62 | 20.61 | 99.76
taxi-direct | direct | 16 | 94.53 | 88.79
taxi-last-metro-AUS:portal:B2 | last | 35 | 46.65 | 82.34
taxi-last-metro-KOW:portal:E6 | last | 52 | 59.92 | 115.79
taxi-first-bus-td:4052 | first | 31 | 92.28 | 109.81

Weight sensitivity (minutes/HKD): 0 → taxi-direct, 0.25 → taxi-direct, 0.5 → taxi-direct, 0.75 → taxi-last-metro-AUS:portal:B2, 1 → taxi-last-metro-AUS:portal:B2, 2 → public-all.

The five covered cases select public transport four times and full taxi once at default weights. Feeders are available but are not artificially made winners. The incomplete-network Mong Kok case must not be interpreted as a real-world feeder advantage. Per-leg walk/station/wait/ride/taxi breakdowns and taxi-price-factor sensitivity are in each JSON.

## Random land OD / five preferences

Routing runtime `4f0a062ef29d`: six fixed systematic indices from the seed-20261011 land fixture × five preferences, without filtering to successful OD pairs. 30 of 30 observation cells exited normally, no SIGKILL. States: {'complete': 17, 'usable-public-and-taxi-comparison': 6, 'diagnostic-window-ended': 7}. All observed candidate invariants passed (endpoint preservation, known source restrictions, strict-accessibility taxi exclusion and luggage vehicle confirmation). Empty or unfinished candidates are not a route-success claim.

Peak process RSS across this campaign: 1619.0 MiB. Serial graph ownership prevents simultaneous heavyweight indexes but still leaves substantial memory use and incomplete refinements at the 60-second observation point; mobile performance is not established. This is an observation watchdog, not an application route-search cutoff.

Runtime `6e52ec3d2521` adds an explicit user confirmation before starting a luggage-carrying alternative; the routing/scoring code is unchanged from `4f0a062ef29d`. The refusal path is unit tested and cannot reserve a taxi or start navigation. Strict accessibility is unchanged.

## Aggregate checks and limits

The initial final aggregate was 119/122. Two retained tests incorrectly treated the existing soft luggage preference as hard wheelchair-style stair exclusion; comparison with published v34 confirmed the preference code and `f2` were unchanged. They now test disclosed carrying alternatives while preserving all hard strict-accessibility/closure/direction tests. Another assertion used an obsolete fixed title and now verifies the rendered public route identity. Corrected run output and exit status are in `final/`; do not infer a pass unless the exit file is zero.

Browser UI checks are separate from these Node/Worker tests. Local preview was not reachable from the cloud browser's loopback environment. Deployment and actual browser acceptance are recorded separately; HTTP responses alone do not establish visual quality. Performance profiling is ongoing.

Corrected aggregate: **122/122 passed**, exit 0 (`final/npm-test-corrected.log`). The added luggage-confirmation check was run separately and its suite is **9/9 passed** (`final/confirmation-unit.log`).

Additional west-Kowloon source-node probes are retained as negative coverage diagnostics (`intermodal/long-tail-out.json` and `long-tail-back.json`). The outbound feeder beat full taxi, but no complete pure-public route was available at that exact source node; reverse was unavailable. Therefore this is **not** accepted as a three-way covered feeder-advantage example. A source node's existence does not guarantee end-to-end connected coverage. No durations or links were fabricated to make it pass.

## Feeder winner audit (2026-10-12)

No fully covered three-way example in this sample demonstrates a feeder as the winner under the default generalized-minute weights. This is a negative result, not a reason to award an artificial intermodal bonus. Holding time/walk/wait/transfer weights fixed and varying only the price coefficient produced no simultaneous winning interval for the 12 feeder candidates in complete corridor cases 1–5, nor the seven feeder candidates in the six ordinary-preference random OD samples.

For the fully served Hong Kong Island tram example (case-4): public 29 min / HK$3, final-mile taxi 22 min / HK$32, direct taxi 13 min / HK$52.16. The taxi feeder is genuinely shorter: 1,949.316 m versus 4,895.304 m for the direct taxi. Its score is `27.85 + 32λ`, public is `31.5 + 3λ`, direct taxi is `14.695293185 + 52.16λ`. It beats public only at λ < 0.125862069 and direct taxi only at λ > 0.652515219; these intervals do not overlap. This supports presenting the option honestly but does not support promoting it as optimal. The source service sequence is td:4005:2:287, origin td:99211 (index 0), transfer td:99220 (8), destination td:99227 (15). Timings are model estimates, not measured journeys.

The only tested case with an intermodal winning interval, Admiralty→Mong Kok case-6 (0.615175107 < λ < 1.418970814), has a missing Tsuen Wan Line connection and is excluded from evidence of an algorithm benefit. The West Kowloon long-tail probes lack a complete public baseline and are likewise excluded. A future network expansion should add a reliable longer rail corridor before claiming that feeder ranking improves modal mix at population level.
