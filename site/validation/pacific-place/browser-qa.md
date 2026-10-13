# Public Site browser QA, 2026-10-12

Cloud Chrome, public version 37, Site source commit `4fbab3557baf1acf756d948bd16fbc71c5d9d8b4`, runtime `deeb5d2dd3c1`.

Observed through the rendered application and accessible controls, not inferred from HTTP responses:

- The Pacific Place model renders five source levels (LG1, L1, L2, L3, L4), source route segments and the Admiralty F anchor within the unified application.
- Selecting L2 and explicitly choosing it as the destination returns to planning with **太古广场商场 · L2**. The other endpoint is not replaced.
- With origin **添马公园**, the 08:00 selection shows the loaded internal-path 10:00–22:00 restriction. It does not claim all public corridors or the whole mall are closed.
- Clicking **改为当日10:00并重算** preserves both endpoints and changes the departure time to 10:00. The production planner completes with a conditional walking route, model-estimated 6 minutes, HK$0.00, arriving at **太古广场 · L2 官方通道点 16**.
- Starting the 3D route rehearsal displays 12 instructions. Advancing through them reaches the arrival screen naming the same Pacific Place L2 destination. These are simulated instructions and model estimates, not GPS arrival or measured travel time.
- At instruction 9, **查看站体背景** incorrectly opened Admiralty station instead of the mall model. Browser Back preserved instruction 9. This is a reproduced integration defect, being corrected separately; v37 does not count as passing this control.
- `/metro.html` redirects/canonicalizes to the unified `/#station?station=ADM` view. `/research.html` opens unified `/#info`. Neither shows the old standalone UI.

Earlier version 36 browser checks also exercised the collapsed scoring panel, price weight change 0.75→1.5, reset to 0.75, and official multi-floor Admiralty geometry. These checks are distinct from the version 37 source-graph regression matrix.

Limits: no phone-viewport visual run was available; the full five-preference random matrix was not rerun through the browser. Native time-input editing encountered automation frame timeouts on a previous tab; the explicit source-opening-time action was tested successfully. Do not call HTTP responses or source-graph tests browser visual passes.
