/** Experimental, explicitly branded plain-data inputs only. Not in the build. */
const hkGeometryPatterns=new WeakSet(),hkGeometryStops=new WeakSet(),hkGeometryShapes=new WeakSet();
const hkGeometryArray=Array,hkGeometryArrayPrototype=Array.prototype,hkGeometryObjectPrototype=Object.prototype;
const hkGeometryNativeSlice=Array.prototype.slice,hkGeometrySpecies=Object.getOwnPropertyDescriptor(Array,Symbol.species);
const hkGeometryDescriptor=Object.getOwnPropertyDescriptor,hkGeometryPrototype=Object.getPrototypeOf,hkGeometryDefine=Object.defineProperty,hkGeometryApply=Reflect.apply,hkGeometryParse=JSON.parse;

/**
 * TRUSTED BOUNDARY ONLY: caller guarantees fresh controlled JSON/structured-clone
 * data or engine-owned ordinary constructors, never arbitrary third-party objects.
 * Brands identity, not immutability; every reuse still validates current contents.
 */
export function brandScheduledGeometryNetwork(network){
 for(const pattern of network.patterns??[]){
  if(!pattern||typeof pattern!=='object')continue;
  hkGeometryPatterns.add(pattern);
  if(Array.isArray(pattern.shape))hkGeometryShapes.add(pattern.shape);
  for(const stop of pattern.stops??[])if(stop&&typeof stop==='object')hkGeometryStops.add(stop);
 }
 return network;
}
/** Safe provenance-producing entry point for reproductions; no reviver. */
export function parseScheduledGeometryNetwork(text){return brandScheduledGeometryNetwork(hkGeometryParse(text));}

export function createScheduledGeometrySharing(capacity=128){
 if(!Number.isInteger(capacity)||capacity<1)throw new RangeError('Invalid scheduled geometry cache capacity');
 const byShape=new WeakMap(),fifo=new Map(),shared=new WeakSet(),markedLegs=new WeakSet();
 const ownValue=(object,key)=>{const d=hkGeometryDescriptor(object,key);return d&&'value'in d?d:undefined;};
 const remove=entry=>{fifo.delete(entry);const ranges=byShape.get(entry.shape);ranges?.delete(entry.key);if(ranges?.size===0)byShape.delete(entry.shape);};
 return{
  slice(pattern,from,to){
   // WeakSet.has does not inspect proxies. Unknown identities take the untouched
   // original slice expression, without descriptor/prototype/frozen preflights.
   if(!hkGeometryPatterns.has(pattern)||!hkGeometryStops.has(from)||!hkGeometryStops.has(to))return undefined;
   const shapeField=ownValue(pattern,'shape'),fromField=ownValue(from,'shapeIndex'),toField=ownValue(to,'shapeIndex');
   if(!shapeField||!fromField||!toField)return undefined;
   const shape=shapeField.value,start=fromField.value,last=toField.value;
   if(!hkGeometryShapes.has(shape)||!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(last)||last<0||!Number.isSafeInteger(last+1))return undefined;
   if(hkGeometryPrototype(shape)!==hkGeometryArrayPrototype||hkGeometryPrototype(hkGeometryArrayPrototype)!==hkGeometryObjectPrototype||hkGeometryPrototype(hkGeometryObjectPrototype)!==null)return undefined;
   const ownSlice=hkGeometryDescriptor(shape,'slice'),prototypeSlice=ownValue(hkGeometryArrayPrototype,'slice'),constructor=ownValue(hkGeometryArrayPrototype,'constructor'),species=hkGeometryDescriptor(hkGeometryArray,Symbol.species);
   if(ownSlice&&(!('value'in ownSlice)||ownSlice.value!==hkGeometryNativeSlice)||prototypeSlice?.value!==hkGeometryNativeSlice||hkGeometryDescriptor(shape,'constructor')||constructor?.value!==hkGeometryArray||!species||species.get!==hkGeometrySpecies.get||species.set!==hkGeometrySpecies.set||'value'in species)return undefined;
   const length=ownValue(shape,'length').value,begin=Math.min(start,length),end=Math.min(last+1,length),size=Math.max(0,end-begin),key=begin+':'+end;
   let ranges=byShape.get(shape),entry=ranges?.get(key),matches=!!entry;
   for(let offset=0;offset<size;offset++){
    const at=begin+offset,descriptor=hkGeometryDescriptor(shape,String(at));
    if(descriptor){if(!('value'in descriptor))return undefined;const old=entry&&hkGeometryDescriptor(entry.geometry,String(offset));if(!old||!Object.is(descriptor.value,old.value))matches=false;}
    else{if(at in shape)return undefined;if(entry&&hkGeometryDescriptor(entry.geometry,String(offset)))matches=false;}
   }
   if(matches)return entry.geometry;
   if(entry)remove(entry);
   // Eligibility established ordinary native slice semantics with no getter,
   // species callback or externally leaked result. Never catch and repeat it.
   const geometry=hkGeometryApply(hkGeometryNativeSlice,shape,[start,last+1]);
   if(fifo.size>=capacity)remove(fifo.keys().next().value);
   ranges=byShape.get(shape);if(!ranges){ranges=new Map();byShape.set(shape,ranges);}
   entry={shape,key,geometry};ranges.set(key,entry);fifo.set(entry,true);shared.add(geometry);return geometry;
  },
  remember(leg){if(shared.has(leg.geometry))markedLegs.add(leg);return leg;},
  restore(legs){
   for(const leg of legs)if(markedLegs.has(leg)){
    // Manual own-property copy preserves holes and bypasses LATE species/indexed
    // prototype mutations. Coordinates remain the original shallow references.
    const source=leg.geometry,copy=[];copy.length=source.length;
    for(let i=0;i<source.length;i++){const d=hkGeometryDescriptor(source,String(i));if(d)hkGeometryDefine(copy,String(i),{value:d.value,writable:true,enumerable:true,configurable:true});}
    leg.geometry=copy;markedLegs.delete(leg);
   }
   return legs;
  }
 };
}
