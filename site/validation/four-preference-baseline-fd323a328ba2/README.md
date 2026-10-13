# Four-passenger-mode real-point regression

Prepared 2026-10-13. No production file or old test is changed by this test layer.

## Fixed 16-cell scope

- Pacific Place LG1 → L4
- Admiralty E2 → Hung Hom B2 lift portal
- Each uses ordinary, luggage, escalator and lift preferences, taxi off and on
- Exact request date 2026-10-12, departure 11:00 Asia/Hong_Kong (39,600 seconds)
- Same original point-matrix source node, XYZ, named-floor portal selection and fixture hash

The original point-matrix assertions remain intact. Additive checks inspect preference routing metadata, paid duration and source opening intervals, and prevent unknown wheelchair evidence from being presented as verified. A source lift may remain legal for ordinary/facility-preference routing even when wheelchair suitability is unverified. Source assets are compared byte-for-byte against fd323a328ba2 to prevent deleting ordinary paths or source lifts.

## Provenance

The fd323a328ba2 runtime was copied before the four-mode build. Its routing-asset signature and per-asset hashes are recorded in baseline-identity.json. The ignored runtime can be restored from the published repository object a0f1f1b:site/dist, then verified against that identity; duplicated runtime assets do not need to be committed. This is a frozen executable baseline, not a completed baseline matrix. The 16 historical references are in historical-reference.json. They originate from 2e2fcf795897 and b702b6920092 and are explicitly not acceptance of fd323a328ba2 or the new four-mode build. Original raw full journeys were not saved, so historical geometry byte-equality is not claimed.

## Execution

Dry plan:

    node tests/navigation/four-preference-run.mjs --dist=<frozen-new-runtime> --runtime=<new-version>

Execute only in the agreed resource window:

    node tests/navigation/four-preference-run.mjs --dist=<frozen-new-runtime> --runtime=<new-version> --run

Each cell is a fresh process, serial only. Main heap is 768 MiB and each Worker heap is 384 MiB; this is not an RSS cap. Each route has a 60-second observation window and 90-second external watchdog. Upper bounds are 16 minutes of route observations or 24 minutes of watchdog time. Structural, worker, OOM or provenance failures stop the matrix for diagnosis. Pending and empty results remain non-passes. Successful acceptance requires all 16 newly executed comparisons, at least one valid route in each cell, and every inherited and additive audit passing.

Summary, per-cell JSON, logs and historical differences live in a new validation/four-preference-<runtime>-<signature>/ directory. A rerun after modifying the audit must use a fresh output directory. No old result is silently reused as new-build execution.
