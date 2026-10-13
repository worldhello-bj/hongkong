# Geometry retention audit (read-only production analysis)

## Dynamic walking does not keep complete route geometry in Dt labels

In the actual transit Worker, Ht returns id/fromId/toId/kind/durationS/label/route. It has no geometry property. Dynamic le replaces the connection with that Ht result, keeps complete G evidence in the paired result memo, and adds the scalar preferencePenaltyS. Dt then constructs its walking label leg with geometry:w.geometry; it does not copy w.route. Therefore a dynamic ft result's large arrays do not remain reachable from label.previous through this field after all its memo owners evict it. This is a direct source-code counterexample to the proposed 52k full-route-geometry label retention chain.

Complete dynamic results can still be retained by ae/_e, the outer H cache (512 entries), or Lt station memo (64). Those owners and their sizes must be measured separately. Label count cannot be multiplied by a full ft route size.

## Real geometry retention paths

- A static connection may carry geometry; its accepted leg references that existing array.
- A scheduled transit leg uses A.shape.slice(startIndex,endIndex+1). Every attempt constructs an outer array; accepted labels keep it. This is a shallow slice: coordinate arrays still refer to the source shape. It is not a full coordinate deep copy per label.
- ft reconstruction does copy coordinates: vt uses map(point=>[...point]) for a whole edge or copies clipped endpoint/intermediate coordinates. Feature geometry owns this result, while merged leg geometry gets an additional outer array that shares coordinate objects. Exact-content sharing must respect order, XYZ dimensions, signed zero, duplicate points, partial-edge endpoints and all later mutations.
- Delaying ft materialization cannot simply omit legs: the resolver computes preferencePenaltyS from the produced legs, and some facility evidence derives from geometry. A summary-only path would need to preserve that calculation exactly and replay selected evidence at the original departure/date.

## Existing heap sample: evidence and limits

The only existing small allocation sample is runtime8e at 4,532 retained labels, before bounded route-result memos were installed. At its sampling checkpoint:

- vt geometry extraction subtree: 6,948,800 bytes (6.627 MiB)
- Direct Dt slice allocation frame: 997,072 bytes (0.951 MiB)
- Accepted-label P self allocations: 984,016 bytes (0.938 MiB)
- Total estimated sample: 292.98 MiB, of which 173.19 MiB is unattributed V8 API allocations

These statistical allocation-site estimates are not dominator/retained-byte attribution, do not prove geometry is the main heap owner, and cannot be extrapolated to cfc's 120k labels. The direct slice frame can include other Dt slices, not exclusively accepted transit geometries. No new routing or heap run was executed.

## Next copied probe

Accepted-label instrumentation now counts legs, walking legs without geometry, geometry arrays, coordinate references, maximum length and counts by mode. It samples a signature only every 64th geometry array, at most 1,024 samples, skips arrays above 4,096 points, and retains at most 256 short signatures. It retains no geometry/coordinate objects. Hash repeats are duplication candidates, not proof of equality, and the bounded deterministic sample is not an unbiased whole-heap estimate. Tiny actual-Dt tests verify missing walking geometry and repeated-coordinate signatures in both flat and time-bucket variants.

If this shows material duplicate transit slices, a separate exact internal per-shape/per-index-pair sharing design may be worthwhile. Selected output materialization and mutability/aliasing would still need equivalence tests. No production sharing or lazy geometry change is made here.
