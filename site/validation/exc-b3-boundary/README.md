# Exhibition Centre B3 source connection

The build imports two existing official indoor features (1001097474 and 1000805010) at their exact shared XYZ boundary with outdoor footbridge 290046359. The bounded delta is two nodes, four directed physical edges and the original B3 portal. Geometry, the 1.6 m source elevation change, opening restrictions and unpaid-area status are retained. This does not establish live availability or wheelchair accessibility.

Source acquisition URLs, original GeoJSON and SHA-256 pins are in `scripts/data/exc-b3-boundary/`. Attribution and reuse terms are in `DATA-SOURCES.md`. Existing 272 cached walking connections are preserved under a checked single-attachment, non-snappable, nonnegative-cost leaf proof; unknown versions or changed prior graph records fail closed.

## Isolated original-request verification

`isolated-validation.json` records runtime **b2eb197920d3**, before subsequent integration. It is not a claim about a later runtime or a browser/device benchmark.

- EXC B3 → ADM C1, 08:00, ordinary, no taxi: complete comparison in 5.167 s; first result 3.058 s. The 21-minute walking candidate has 128 source edges, no unknown or schematic geometry steps, no horizontal/height gaps, and passes all 15 strict checks. A separate 26-minute/HK$3 illustrative tram candidate retains its explicit modeled classification.
- KOW TCL platform → EXC B3, 23:00, lift-first, taxi enabled: complete comparison in 36.293 s, no accepted candidate. Original endpoints and policies remain unchanged. Public/walk/metro return `NO_ROUTE`; taxi cannot accept unverified platform-to-curb access. There is no new `OUT_OF_REGION` regression. The remaining failure is unresolved, not a proof of physical impossibility.
- The morning walking route includes Queensway Plaza edge ADM:P:250018720, access rule 290000487 (08:00–22:00). It is not one of the added EXC edges, and its closure alone does not explain the other request.
- 16 focused tests passed. The later integrated runtime has its own [472-test and 16-cell matrix report](../seeded-routes/v52/README.md); this isolated report does not relabel its earlier measurements. These isolated checks exercise the real entry and Worker bundles with a DOM stand-in; they do not establish visual QA. Post-completion cancellation was checked, not cancellation during active EXC search.

The EXC graph selector only keeps the area composition when every explicit requested node is present there. It therefore cannot discard another station's platform to manufacture a connection. Future broader overlay composition needs separate source and routing validation.

Latest integrated code and unchanged-request validation: [v53 final regression](../seeded-routes/v53/README.md).
