# Official visible-map pedestrian expansion

The initial map viewport is x=-1700..3700, y=-4400..2100 in the app's local projection (origin 114.165,22.279; scales 102900 and 111320). The resulting acquisition envelope is recorded in `visible-rectangle-acquisition.json`.

Source: Lands Department CSDI PedestrianRoute MapServer layer 0, dataset landsd_rcd_1637222018065_52265. Count and OBJECTID-ordered pagination were verified: 58,964 distinct features in 20 pages. URLs, byte sizes, retrieval timestamps and SHA-256 hashes are preserved in the manifest. Raw responses are retained separately as research evidence, not shipped to browsers.

Reproduce:

    python scripts/fetch-visible-walk-network.py --output-dir /tmp/hk-visible-source
    python scripts/expand-visible-walk-network.py --source-dir /tmp/hk-visible-source --base BASE_AREA.json.gz --output EXPANDED_AREA.json.gz
    node scripts/augment-kowloon-area.mjs EXPANDED_AREA.json.gz dist/area/station-graph.json.gz COMBINED_AREA.json.gz

The base is the pre-expansion area graph. Existing nodes, edges and portals are retained unchanged. Only missing official pedestrian physical IDs are added; matching endpoints share the existing region + rounded XYZ key (1e-8 degrees and 1 mm height). No proximity connector, 2D crossing join or cross-harbour line is generated. Disabled features, paid areas and unresolved access-hours features remain excluded. Lift accessibility is not inferred from proximity.

Each region carries `selection_envelopes`, the union of original acquired rectangle and new visible rectangle, split at the existing harbour boundary latitude 22.2915. Radius and enclosing bounds are broad-phase filters only: the envelope union is authoritative. Station overlays must retain area-region coverage rather than overwrite it with old station-radius metadata.

New official data: 6,482 physical segments / 12,950 directed edges / 5,812 nodes. Expanded area: 60,226 nodes and 133,765 directed edges; 7,920,240 compressed bytes. With independently verified KOW indoor augmentation: 61,055 nodes and 135,514 directed edges; 8,036,890 compressed bytes. Existing walk-link routes retain their referenced IDs; graph-version metadata must be updated only after asserting preservation of those references.

All 72 endpoints in the fixed 36-case seeded regression are inside the acquired envelope union. Coverage does not certify arbitrary building entrances or accessibility; route tests and the UI must retain evidence/assumption labels.
