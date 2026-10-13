# Endpoint marker / station hit-target repair

Runtime: `d13e16e39f47`, built 2026-10-13 12:55:35.878 UTC.

## Observed browser defect

After v48 was published, selecting West Kowloon as an origin placed the decorative origin badge above the high-speed station at the same coordinate. A real browser pointer click hit the badge's `起` text rather than the station; Enter on the station still opened its next-services card. `document.elementFromPoint()` at the station target's center confirmed the intercepted text node. This was an input-layer conflict, not a timetable or clock error.

The endpoint badge layer and all its decorative children now use `pointer-events:none`. The badge remains drawn above the station and the original 44 px station hit target remains pointer-enabled. A regression test guards both rules and preserves layer order. No routing, timetable, taxi, or clock JavaScript changed; all other generated asset changes are runtime cache-version updates, verified by normalized comparisons in `normalized-diff.json`.

## Automated checks

`npm run build` passed. `npm test` passed all 381 tests, with zero failures or skips, in 249574.31363 ms. `git diff --check` passed. The full entry/real Worker cases include high-speed local connections, global-clock invalidation, repeatability, playback, independent layers, home retention, and navigation reentry.

## Live cloud-browser verification before this CSS repair

The published v48 runtime `0f6587f77445` was directly verified through its rendered script URLs. Desktop viewport: 1180 × 757 CSS px. Responsive phone-width viewport: 400 × 606 CSS px, obtained by resizing the cloud Chromium window and using 125% browser zoom; this is layout testing, not a physical phone or touch-device claim. Both layouts had no horizontal document overflow.

- West Kowloon → Futian at 08:00 / 08:03 / 08:00 produced 62 / 59 / 62 minutes and G924 each time. Old results disappeared immediately on time selection before recomputation.
- West Kowloon raw next-departure countdown changed from 12 to 9 minutes, while the separate earliest eligible modeled service stayed 08:48 G924.
- Existing-order taxi markers changed 27 → 21 → 27, and the first taxi's original transform reproduced on reselection.
- Playing advanced both the map clock and navigation time field together. Pause and selected-time planning used the same displayed instant.
- High-speed layer toggling removed only high-speed vehicles, leaving 48 taxi markers and the selected time unchanged.
- Phone-width navigation entered procedural guidance and retained instruction 2 of 6 after return to planning and reentry. Home retained the selected result.
- Actual mobile-width local/high-speed combinations produced 97 minutes for Admiralty E2 → Futian and 144 minutes for Futian → Admiralty E2, including the local rail/walk chain and modeled border procedures.

The repaired pointer interaction requires post-deployment browser confirmation. Its final result and deployment ID are handed off separately after publication; this source report does not claim a pre-publication browser pass for the repair.
