# Integrated UI transition repair

Runtime `80559fd92aa0`, 2026-10-13. This follows actual cloud-browser inspection of v50/runtime `5526e22eeac9`.

## Observed issues and repairs

- Routes to ticket page inherited the scroll offset of `aside.na-sheet` (628 px in the observed case). Step changes also focused a heading without resetting that actual scroll ancestor. The ticket focus helper now resets its `.na-sheet` ancestor, with the standalone host as fallback. Genuine page/history entries focus and reset the page; ordinary same-stage renders leave reading position unchanged.
- A rapid second pointer click on desktop could land on the newly mounted “修改行程” button after confirmation. Ticket UI activation now rejects repeated pointer events and click-through within a 350 ms transition window. Keyboard activation stays immediate; deliberate later edit/back works. No timer or animation loop was introduced. Model-controller issuance remains independently idempotent.
- Model entry and station changes inherited separate sheet/model offsets, hiding headings and return controls. Genuine model-context entry and station identity changes reset both scroll containers; same-stage redraws preserve them.
- The route CTA uses the already supported right-arrow glyph with `aria-hidden` instead of the poorly rendered northeast arrow.

## Verification at source packaging

59 focused tests passed, zero failed/skipped, including 6 new actual-source UI regressions, ticket state/persistence/history checks, station model tests, unified shell and progressive fallback. The rebuilt real-entry/Worker ticket-model integration also passed.

The immediately preceding full suite passed 431/431 on v50. Routing source, route data, timetable, fares and taxi-clock composition are unchanged by this UI-only patch, so its 16-scenario/21-candidate route audit remains attributed to runtime `5526e22eeac9`. Final-commit full CI and published-page incremental browser verification are recorded in the release PR, not claimed by this pre-deployment report.

The v50 browser run verified full simulated ticket issue/idempotency, wallet/history/stale-time behavior, WEK/FUT floor controls, and navigation step 3/6 restoration. It used 944×606 and 402×606 CSS views in a cloud desktop browser; no mobile hardware claim is made. The subsequent v51 run must specifically retest the repaired transitions before acceptance.
