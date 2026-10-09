# Engineering verification

Recorded 2026-10-09 in the cloud workspace, Python 3.12.14. No tests in the unrelated project were used as evidence here.

- Backend: 56 tests passed. The named T01–T30 cases cover every category from the source plan Appendix C; additional tests cover API contracts, validation, closures, official network import, source licensing, directionality, 3D height separation and conditional accessibility.
- Clean offline copy: all 56 tests passed after copying only application code, normalized data, licensed compressed official spatial snapshots, docs and tests, with no raw download directory or runtime database. Transcript: `clean-offline-test.txt`.
- Small multimodal model: 60 synthetic OD × 6 conditions = 360 runs; measured p95 approximately 1.1 ms on this run. Report: `benchmark.json`. This is not a human-audited OD set or network-level timing promise.
- Official network graphs: 120 synthetic source-edge OD × 6 conditions = 720 runs; measured p95 4.3 ms, max 12.9 ms on this run. Report: `network-benchmark.json`. Each OD is sourced from real network endpoints, but endpoint selection is synthetic and not a passenger journey ground-truth survey.
- Official acquisition: Admiralty 1,396 + hub 1,898 network features, count and unique object ID checked against bounded source queries. 1,300 + 1,777 graph nodes, 2,745 + 3,756 directed edges. Source schema confirms paid-area, direction, enabled and barrier codes. Report: `network-acquisition.json`.
- Dynamic smoke observation: three MTR and three KMB responses collected about 60 seconds apart. All six parsed as current business-valid LIVE at reception. This short observation does not establish long-term stability. Report: `continuous-observation.json`.
- Bus mapping: 12 unique route/direction/variant patterns fetched; nine have a preceding stop usable as a research incoming bus segment. Other terminal starts are not assigned invented upstream stops. Exact patterns and official stop orders: `data/normalized/bus_patterns.json`.
- Browser and frontend build verification is recorded separately by the frontend task. A temporary hosted preview must remain labelled recorded/read-only; the Python service is not deployed there.

## Not asserted

No claim of production accessibility, complete official service calendar/GTFS ingestion, field-verified travel/queue times, independent gate/platform audit, statistically calibrated connection reliability, A/B/C real-world performance, whole-Hong-Kong network coverage, or Beijing baseline regression. These need additional source data and/or independent human review.
