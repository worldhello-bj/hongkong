# Scheduled ride geometry sharing: isolated experiment

Status: **not installed in the build or runtime**. No real-graph benchmark was run. The transform CLI refuses to write assets. The generic scheduled engines have no enabled provenance source and therefore keep the original slice expression. Controlled JSON provenance is enabled only by the reproduction harness.

Files:

- `src/navigation/scheduled-geometry-sharing.js`
- `scripts/repair-scheduled-geometry-sharing.mjs`
- `tests/navigation/scheduled-geometry-sharing.test.mjs`

Reproduce with:

```sh
node --test --test-concurrency=1 tests/navigation/scheduled-geometry-sharing.test.mjs
```

## Actual allocation being studied

Worker `Dt` creates a fresh ride geometry using `A.shape.slice(q.shapeIndex, ee.shapeIndex + 1)` for every generated trip/stop pair. Module `Xe` does the same with its corresponding identifiers. The copied object is the outer array of coordinate references. Coordinate arrays themselves are not copied by this expression. Accepted labels retain ride-leg objects and those sliced outer arrays, including slices for losing departures.

The experiment shares only these internal scheduled-ride slices. It does not change label creation, accepted/inactive states, heap order, departure/arrival arithmetic, costs, dominance, ancestry, resolver calls or source coordinates. Dynamic walking connections and static `connection.geometry` are not interned. All original leg objects and labels still exist; only repeated outer arrays/reference slots are reduced.

## Provenance is required, not inferred from frozen state

A frozen Array may have getters, inherited values in holes, a custom slice method, or a custom constructor/species. It may also be a Proxy. Checking descriptors or frozen status on a Proxy adds observable traps before the old expression. A custom species can expose a newly constructed slice to external code, invalidating the premise that internal slices are private.

The helper therefore keeps private WeakSets for known ordinary pattern, shape and stop identities. `parseScheduledGeometryNetwork` uses a captured JSON parser with no reviver and brands the resulting ordinary data. A separately exported `brandScheduledGeometryNetwork` is a **trusted-boundary API**, not a validator: its caller must prove fresh controlled JSON/structured-clone/ordinary-constructor provenance before calling it. It must never be applied to arbitrary third-party objects or an already-exposed mutable network.

Unknown pattern, stop or shape identities fail the WeakSet checks before any descriptor/prototype inspection. That includes a Proxy substituted later by a callback. The unchanged original expression then executes. Known ordinary objects cannot change their identity into a Proxy; later property/prototype mutations are guarded separately.

The proof assumes trusted standard engine/helper intrinsics throughout a query. Arbitrary replacement of `Array.prototype.push`, for example, could expose private label geometries as the engine pushes a ride leg. This is outside the production plain-data contract and is not claimed to be supported. The experiment does support per-shape custom methods/constructors, accessor/coercion fallbacks, and late species/indexed-prototype mutations where explicitly tested.

## Exact per-call eligibility

Before sharing a slice, the helper requires:

- Branded pattern and both branded stop objects, with own data properties for shape and both indices.
- A branded ordinary Array with the original Array/Object prototype chain.
- Nonnegative safe integer indices; unsupported coercions, infinities, negative/fractional indices and inherited/accessor index fields use the old expression.
- Original native slice, no own constructor override, and the original default constructor/species behavior.
- Every requested present position is an own data property. A missing position is permitted only when the complete ordinary prototype chain has no inherited value at that index.

No getter or coercion is invoked by those ordinary-object descriptor checks. When eligibility fails, the original `shape.slice(startIndex, endIndex + 1)` remains textually intact, preserving shape/slice getters, argument evaluation and coercion order, custom species calls, and thrown errors. A native slice exception is never caught and retried.

For eligible arrays the original native slice has no effectful source access or custom result construction. On a miss it runs once. On a hit, the cached snapshot is reused only after validating every requested slot: present versus hole, and `Object.is` of each stored value/reference. This distinguishes holes from explicit undefined and positive from negative zero, while allowing a stable NaN slot. The successful normal engine input is coordinate references; primitive cases exercise exact slice mechanics.

Replacing a source slot invalidates the cache for that range. Mutating a coordinate object does not: the original shallow slices share that same coordinate object and must continue seeing its mutation. Replacing shape with an unbranded array or adding an accessor/custom prototype/method declines sharing. Changing unrelated positions outside a requested range does not invalidate a still-identical snapshot.

## Bounded ownership and output restoration

Each scheduled invocation owns a FIFO cache of at most 128 range entries. The key is source identity plus normalized native range. A changed snapshot replaces its old entry. Eviction deletes both FIFO and per-shape range membership, including the empty per-shape index, so index metadata does not grow with every shape ever visited. A query owns its cache; no retained result refers to that cache. Global provenance WeakSets retain no source object strongly.

Scheduled ride-leg identities whose geometry is shared are marked in a query-local WeakSet. This mark survives FIFO eviction. Immediately before returning a winning route, each marked ride leg receives a fresh ordinary outer array, with its own positions copied in ascending order. The copy uses captured defineProperty rather than slice, spread or iteration over source values:

- Holes remain absent own properties even if a prototype index was added later.
- A later species getter cannot be called or throw during restoration.
- Every returned ride gets an independent outer array, including two rides that used the same source range.
- Coordinate values/references retain the original shallow aliasing.
- Unmarked static connection geometries retain their original identities and aliases, even for a connection whose kind is bus or metro.

The materialized output arrays have ordinary writable/enumerable/configurable indexed properties and ordinary length semantics, matching the supported native-slice results. Only a final itinerary's slices are rematerialized. No leg object or source coordinate is replaced. On null routes, cancellation or exceptions there is no output restoration; the query-local structures become collectible normally.

## Small-graph evidence

Both complete production `Dt` and `Xe` implementations are loaded for paired tests. The tests compare full output and every accepted label's final state, resources, legs and predecessor summary. A total of 120 randomized timed queries preserve those values exactly. Resolver call/cancellation prefixes also match; full asynchronous route factories retain existing pre-work and cooperative-yield cancellation behavior.

A deterministic fixture creates six departures over the same 256-point source range. Original retained ride arrays: 6. Candidate retained ride arrays after restoring the winner: 2, consisting of the internal shared snapshot and the independently materialized winning output. Coordinate-reference slots held by those arrays drop from 1,536 to 512. This is an object/reference count, **not a measured heap-byte saving** and not an OD36 speed or completion claim.

Other passing cases cover:

- Callback replacement of source slots after an earlier slice; earlier snapshots remain unchanged.
- A provenance getter mutating source shape immediately after each slice expression.
- Output outer-array edits not affecting another ride, while shared coordinate-object edits remain visible as originally intended.
- Sparse holes, explicit undefined, signed zero, NaN, changed shape identity and FIFO eviction beyond 128 ranges.
- Raw frozen accessors, shape/slice/index getters, end-before-start coercion behavior, custom species and exceptions. These fixtures are not erased by structuredClone before execution.
- Unknown shape/stop/pattern Proxies receiving no extra reflective preflight.
- Late species exceptions and inherited hole values not affecting final restoration.
- Static connection geometry identity, including two selected static legs sharing a geometry.

The helper's per-hit descriptor scan is O(range length), so saved retention may cost CPU relative to a native slice. The FIFO can also retain up to 128 otherwise-unused slices. Only copied profiling of the actual query can establish net heap/CPU benefit. No search states or queries are removed.

## Minimum future production wiring, not performed here

1. **Main-thread services loader:** module `ct` obtains services using response.json, optionally updates calendar base dates, validates with `Le`, and returns the network. At the controlled fresh-data boundary, brand the validated ordinary JSON objects before exposing them to mutation-capable callers. Avoid accepting arbitrary caller networks through this path.
2. **Worker input:** `self.onmessage` receives structured-cloned `inputs.services`, then passes it into `jt`. The genuine structured-clone receipt is a viable provenance boundary. A direct generic `Dt` call or manually supplied arbitrary object is not. Keep the shared helper's generic default unbranded.
3. **Calendar copies:** `jt.route` creates `We = k.map(pattern => pattern.calendar ? {...pattern, calendar: {...pattern.calendar, baseDate}} : pattern)`. The module has the corresponding copy. A new controlled shallow-copy pattern must inherit only the parent pattern's brand, conditional on the parent already being branded. Existing trusted shape and stop identities remain valid; do **not** traverse and rebrand arbitrary replacement values. This small inheritance helper/hook is not implemented yet.
4. **Supplemental rail patterns:** although pattern and stop records are object literals, shape is produced by `m.coordinates.map(ke)` in the Worker and its equivalent in the module. Arbitrary graph coordinates can customize map/species, so a fresh pattern record alone is insufficient. Either prove controlled graph-coordinate provenance and default construction at that point or leave those shapes unbranded and retain original slicing. Bus/tram JSON shapes can be evaluated independently.
5. **Exposure audit:** the route factory shallow-copies the patterns array, returns its network publicly, and later copies only calendar-bearing pattern objects. These operations do not expose the new query-local cached slices. Resolver arguments are connection records and clocks, not internal ride-leg objects. The outer route assembler sees only the restored final itinerary. Source network mutations remain possible and are why per-call range validation is required.

Do not connect these hooks until the bounded profiler sample establishes that repeated accepted scheduled slices materially drive retained heap. After wiring, rerun the actual factory/load-path oracles and a single authorized real-query comparison; source-level or small-fixture array counts are not enough to claim a production improvement.
