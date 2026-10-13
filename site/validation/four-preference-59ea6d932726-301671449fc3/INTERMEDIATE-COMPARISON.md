# Final versus intermediate four-mode runtime

- Final acceptance runtime: 59ea6d932726; 16/16 freshly executed cells accepted
- Earlier intermediate runtime: 2992bb3c68ed; 16/16 separately executed cells accepted
- Retained request/candidate/evidence comparison: 16/16 unchanged
- Original area/transit source assets: 8/8 byte-identical to fd323a328ba2

The final build includes the production E2.route engine-preference normalization fix. Its matrix was run from its own frozen runtime after the intermediate run finished. The intermediate results were preserved and were not used as final-build execution.

Each version has its own 16 fresh-process executions. Compare all retained requests, preferences, taxi policy, available/unavailable candidates, endpoints, fares and new facility/clock audits. Top-level runtime/performance diagnostics are excluded. Complete raw historical route geometry was not retained, so geometry byte equality is not claimed.

Reproduce:

    node tests/navigation/four-preference-compare.mjs validation/four-preference-2992bb3c68ed-05cca59619f6 validation/four-preference-59ea6d932726-301671449fc3

See intermediate-comparison.json for every report hash, retained-payload hash and recursive field difference.
