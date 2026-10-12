# Stage A preflight: stopped after 2 of 6 ordinary cells

Runtime: 8e5a3cbed130. Frozen runtime content was checked equal to current `dist/` before execution. No runtime copy was created and no production code was changed.

| Cell | First candidate | Full S1 | Available candidates | Observation |
| --- | ---: | ---: | ---: | --- |
| exits-cross ordinary taxi off | 7.909 s | 10.150 s | 1 | All recorded assertions pass |
| exits-cross ordinary taxi on | 2.893 s | 12.374 s | 2 | Public transit passes; taxi-direct cannot satisfy exact XYZ/source-node assertion |

Four other Stage A preflight cells, all Stage B cells, and five-preference expansion remain **not run**. Neither observation was a timeout, OOM, or NO_ROUTE. Cancel was checked after completion, so these cells do not establish cancellation-during-search coverage.

## The taxi assertion is an evidence gap, not an observed XY relocation

Selected origin: ADM:portal:E2, node ADM:N:15dedbcfbae59e, `[114.16624518,22.27888752,6]`.

Selected destination: HUH:portal:B2-lift, node HUH:N:1883cb44eadc07, `[114.18193105,22.30359537,13.8]`.

The public candidate preserves both exact XYZ endpoints and source-edge incidence. The direct taxi candidate retains the same XY coordinates but emits only two-dimensional endpoint geometry. It has no routedEndpoints metadata and no source edge IDs; source-node incidence cannot be established.

This matches the explicit two-dimensional model in `composeTaxiJourney` and `modeledRoadLink`: taxi curb connectors take coordinates with `slice(0,2)`. Its result is already marked `scenarioOnly: true` and `simulationOnly: true`, with warnings that curb/elevation connections are unverified. Therefore this report does **not** claim that the selected location was silently moved, or that a ground-floor physical connection has been proved invalid. It records that the strict XYZ/source-node contract cannot be verified from this candidate.

No assertion was weakened to mark missing Z as matching Z. The matrix stopped for review, as required. Known-edge, continuity, per-leg fare and taxi-policy assertions passed for both candidates. Schematic continuity is still labeled modeled/unverified; it is not official path validation.

If this scenario-only representation remains intentional, the public product and matrix need an explicit agreed distinction between an exact 3D source-boundary claim and a 2D, elevation-unverified taxi estimate. Adding endpoint metadata alone would preserve the selected identity, but would not prove the physical curb/floor connection.
