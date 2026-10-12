/** Exact index for the scheduled engine's existing temporal comparison:
 * a <= b && (a === b || a >= boundary).
 * A pre-boundary label can only compare with its exact time; post-boundary
 * labels can only compare with other post-boundary labels. Store each accepted
 * label once and preserve insertion order, including inactive labels.
 * The engine validates finite times before using this index. Map's signed-zero
 * equivalence matches ===. This helper changes no dominance or waiting rule.
 */
export function getScheduledLabelBucket(index,node,time,boundary){
 return index.get(node)?.get(time<boundary?time:boundary);
}
export function setScheduledLabelBucket(index,node,time,boundary,labels){
 let buckets=index.get(node);
 if(!buckets){buckets=new Map();index.set(node,buckets);}
 buckets.set(time<boundary?time:boundary,labels);
 return index;
}
