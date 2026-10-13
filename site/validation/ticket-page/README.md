# Standalone demo ticket page

## Scope

The ticket page is an isolated, four-step rehearsal: confirm itinerary → reference summary → short issue ceremony → revisitable demo journey credential. It uses no operator APIs, payment provider, reservation, identification form, QR code, or seat allocation. No existing order changes to a paid state. Existing taxi reservation/navigation logic stays with the host.

Unknown HSR price/inventory remains unknown. A high-speed itinerary can generate a **DEMO ONLY** journey record, never a cross-border ticket or paid order. Known ordinary-route amounts are explicitly simulated reference amounts rather than checkout totals. Quote expiry does not turn an old quote into a payable offer: this module never submits quotes to the order store.

## Host integration

Import `createTicketPageController` and `focusTicketPage` from `src/navigation/ticket-page.js`, and load `ticket-page.css` through the app stylesheet/build pipeline.

Create one controller per application session:

- `getContext()` returns the sole simulation clock's `{departureDate, departureS, epochMs, trafficRevision, scenarioKey, routeRevision}`. Seconds are compared exactly, including fractional seconds. Use a session-prefixed route revision that changes when routes/endpoints/preferences change. Pause the global clock when entering the ticket page.
- `onChange(state)` asks the host to rerender only when the ticket page is active. After entering/changing a step, use `focusTicketPage(panel)`; do not focus on unrelated background redraws.
- `onBack()` returns to routes/orders; `onPlan()` opens current-condition planning; `onNavigate(pass)` may start only a currently valid host route. Never rebuild live navigation from a saved credential.
- `storage` is optional. It is only read/written when `rememberOnDevice === true`; synchronize the existing privacy switch via `setPersistence(boolean)`.
- `reducedMotion` can be a boolean or function. Reduced motion removes the ceremony delay; CSS also removes decorative animations/transitions.

Controller API:

- `open({choice, origin, destination, context?})` reads the existing route choice shape, including `choice.result.navigationSnapshot`, `choice.result.segments`, and `choice.quote`. It enters confirmation only for a complete, available route.
- `render()` returns escaped, self-contained page HTML.
- `handleAction(element.dataset.ticketAction, element.dataset.ticketId)` handles the module's native buttons.
- `snapshot()`, `listPasses()`, and `passListHtml()` return copies or standalone order-page list markup. `renderTicketPassList(passes, selectedId?)` is also exported.
- `openPass(id)` reads an existing credential. `showWallet()` shows the ticket collection and planning empty state.
- `suspend()` must run when leaving the ticket page. It cancels any uncommitted ceremony and returns its state to summary. Re-entering does not silently issue anything.
- `clear()` cancels work, clears memory and removes this module's saved key. Invoke even if the controller has not previously been lazily instantiated when the user deletes all application data.
- `dispose()` cancels all pending work at application teardown.

Persistence is independently namespaced as `hk-maas-demo-passes-v1`, at most 30 passes. Include `listPasses()` in a full-account demo export, or explicitly label an export that excludes these records. Each saved record is validated on load. Read/write/delete failures are disclosed. Old credentials stay readable after time/revision changes but cannot navigate the new scenario.

The module's deterministic `DEMO-…` ID derives from the normalized route, context, segments and reference amount. Random quote IDs and wall time are excluded. Repeated issue clicks and retries reuse the existing credential. It is a display identifier, not an authenticity/security token.

## Verification

Run `node --test tests/navigation/ticket-page.test.mjs`.

17 focused tests pass, covering the ordinary and HSR flows, unavailable routes, exact clock/epoch and scenario/route invalidation, late ceremony completion, duplicate clicks, Back/suspend/dispose/replacement, synchronous close during change callbacks, history-only credentials, privacy opt-in and reload, corrupt storage, storage failures, HTML escaping, semantic native buttons, reduced-motion scheduling, focus and immutable API results.

`fixture.html` is a standalone synthetic HSR fixture. `node validation/ticket-page/smoke.mjs` serves it on localhost, drives Chromium at 320/390/1440 px, checks horizontal overflow, native keyboard activation, reload persistence and reduced motion, and writes screenshots/results inside this folder. It does not build or modify shared `dist/`.

Browser execution was attempted on 2026-10-13 but Chromium was blocked before opening a page by the execution sandbox: `process_singleton_posix.cc: socket() failed: Operation not permitted`. No browser checks or screenshot review are claimed at this point. This is a launch limitation, not a verified page failure. Integrated browser-history/reload tests and screenshots are reported separately for the assembled application.
