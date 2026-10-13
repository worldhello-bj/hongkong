# High-speed rail and simulation sampling verification

## Saved-build scope

Runtime **0f6587f77445**, built 2026-10-13 10:18:10 UTC, integrates Hong Kong West Kowloon ↔ Shenzhen Futian with the same global clock used by local public transit, taxis and route snapshots. Full final suite: **379/379 passed**, zero failures, cancellations or skips, 243375.742525 ms. Source/dist normalized comparisons and runtime import checks passed. The eight original geometry/data/core files in `source-preservation.json` remain byte-identical to v45.

The new service is available through search, three home presets, a fifth independently controlled map layer, a high-speed map extent, station cards and the existing route/navigation flow. A time seek clears old results; delayed local routing is aborted before it can restore an obsolete high-speed journey. The winning train need not change when the chosen time changes.

## What is official and what is modeled

`official-planned-timetable.json` preserves the verified source dataset: 52 normal northbound and 60 normal southbound records from the general MTR planner/current short-haul PDF, effective 2026-10-11 and retrieved 2026-10-13. Per-train reference travel times of 14–16 minutes are retained. Separately marked Saturday-only extras are excluded.

The source planner has no travel-date selection. Repeating those normal records at a user-selected simulation date is explicitly a model assumption, not proof of that day's operation or seat inventory. Current service, fares and ticketing information must be checked with the operator. No real-time location, real dispatch, border eligibility, payment or cross-boundary ticket is claimed. High-speed pricing is unavailable, so these options do not enter the known-fare score or simulated ticket checkout.

The northbound procedural model requires at least 45 minutes before departure: 5 minutes verification, 15 security, 15 immigration, 5 boarding, plus explicit waits. It checks the official station 06:00 opening, control point 06:30–23:30 window, T−90 earliest verification, T−30 verification cutoff and T−15..T−5 boarding window. Closed-station waits explicitly require arrangements outside. The earliest modeled G5820 remains feasible with verification at 06:00 and immigration no earlier than 06:30.

Southbound departure processing at Futian is a 30-minute model buffer; both immigration processes occur only after arrival at West Kowloon, with a 45-minute model buffer. The last included southbound train's modeled processing finishes at 23:18. These durations are assumptions, not guaranteed processing times.

Official station maps identify Austin C as a West Kowloon connection; the existing exact graph lacks C. Local routing therefore reaches the existing source-backed Austin platform node, followed by an explicitly modeled 10-minute station transfer. The current service guide's approximately 4-minute station walking reference plus 6 minutes internal buffer explains the model. No new C-exit geometry, elevation or accessible path is fabricated. The adapter retains actual user endpoint/entrance/floor metadata, original facility preferences and carry confirmation, and original overlay-closure/progressive-detail guards.

Both high-speed station coordinates and the line between them are schematic. The line is never offered as pedestrian turn-by-turn geometry. Procedural navigation cards and high-speed ride labels are separate from local walking instructions.

## Real Worker integration observations

Date: 2026-10-13. The built entry point was exercised with real routing Workers in a DOM harness.

| Request | Selected time | Modeled complete duration | Train | Notes |
|---|---|---:|---|---|
| West Kowloon → Futian | 08:00 | 62 min | G924, 08:48–09:02 | 40 min processing, 8 min waiting, 14 min ride |
| West Kowloon → Futian | 08:03 | 59 min | G924, 08:48–09:02 | Waiting reduces to 5 min |
| West Kowloon → Futian again | 08:00 | 62 min | G924 | Exact result reproduced |
| Admiralty E2 → Futian | 08:00 | 97 min | G5812 | Real local path to Austin, modeled transfer, then eligible train |
| Futian → Admiralty E2 | 08:00 | 144 min | G5821 | HK immigration ends 09:46, then transfer and timed local route |

See `observations.json` for raw values, including fractional final arrival seconds. `local-time-regression.json` retains the earlier Admiralty–Austin OD checks; taxi-policy independence, four original map layers, home result retention, guidance reentry, stale snapshots and deterministic taxi scenarios remain covered.

HSR stop cards now show departure countdowns rather than inventing origin-arrival times. They explicitly separate raw next departure from the earliest service that meets the model's processing buffer.

## Performance equivalence

The local transit vehicle model now reuses bounded service-day/calendar results (four bands per pattern, at most sixteen days per band). Positions still update on every sample. After two initial calendar evaluations, 180 warm animation samples and 180 stop queries add zero further calendar evaluations in the deterministic work-count test.

`performance-parity.mjs` reproduces **4,980 deep-equality comparisons** between the pre-change implementation and the optimized one on the real 16-pattern/119-stop local network: varied dates, calendar exceptions, negative/continuous times, midnight, 0/3/5/160/1000 vehicle caps and horizons up to seven days. Results are in `performance-parity.json`. This is computation equivalence/work reduction, not a measured browser FPS claim.

## Verification limit and publication

This build has Node, DOM-harness and real Worker verification. Desktop/mobile visual browser QA remains incomplete because the cloud browser cannot reach the local preview and public publication is paused pending authorization. Saving source and an archive-backed version does not publish it.

## Primary source links

- [Northbound planner](https://www.highspeed.mtr.com.hk/en/trip-planner.html?id=WEK2FUT), [southbound planner](https://www.highspeed.mtr.com.hk/en/trip-planner.html?id=FUT2WEK), [current short-haul timetable](https://www.highspeed.mtr.com.hk/res/pdf/short-haul-train-timetable.pdf)
- [Departure process](https://www.highspeed.mtr.com.hk/en/guide/process-departure.html), [arrival process](https://www.highspeed.mtr.com.hk/en/guide/process-arrival.html)
- [Austin layout](https://www.mtr.com.hk/archive/ch/services/layouts/aus.pdf), [current service guide](https://www.highspeed.mtr.com.hk/res/pdf/Service_Guide_EN.pdf), [West Kowloon connections](https://www.highspeed.mtr.com.hk/en/guide/wek.html)
- [Station hours](https://www.highspeed.mtr.com.hk/en/about/wek.html), [Customs control-point hours](https://www.customs.gov.hk/en/service-enforcement-information/passenger-clearance/contact-us/index.html?print=1)
