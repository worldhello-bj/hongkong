/** Booking/pricing is auxiliary and must never invalidate a computed route. */
export function quoteRouteSafely({segments,title,origin,destination,complete,createQuote}){
 const pricing=[];
 for(const segment of segments){
  const copy={...segment,label:segment.label||'步行接驳'},last=pricing.at(-1);
  if(copy.mode==='walk'&&last?.mode==='walk'){
   last.durationMinutes=(last.durationMinutes??0)+(copy.durationMinutes??0);
   last.distanceM=(last.distanceM??0)+(copy.distanceM??0);last.available=last.available&&copy.available;
  }else pricing.push(copy);
 }
 try{return {...createQuote({title,origin,destination,segments:pricing.length?pricing:[{mode:'walk',label:'路线演示',available:!!complete}]}),compacted:pricing.length!==segments.length};}
 catch(error){return {id:null,available:false,pricingUnavailable:true,totalCents:0,segments:[],compacted:true,error:error?.message??String(error)};}
}

/** Consistent illustrative taxi meter across route ranking and the booking adapter.
 * HK$29 first 2 km + HK$8/km, plus a clearly disclosed HK$25 harbour-tunnel assumption.
 * No passenger pickup wait is charged. This is not an official fare quotation.
 */
export function simulatedTaxiFareCents({distanceM=0,harbourTunnel=false}={}){
 if(!Number.isFinite(distanceM)||distanceM<0)throw new Error('Invalid taxi distance');
 return Math.round((29+Math.max(0,distanceM/1000-2)*8+(harbourTunnel?25:0))*100);
}
