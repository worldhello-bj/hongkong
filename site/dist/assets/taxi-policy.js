/** Passenger policy only; does not change public routing or vehicle road paths. */
export function taxiPassengerPolicy({enabled=false,need='ordinary'}={}){
 if(!enabled)return {eligible:false,reason:'disabled',needsVehicleConfirmation:false,message:''};
 if(need==='accessible')return {eligible:false,reason:'accessible-vehicle-unverified',needsVehicleConfirmation:true,message:'严格无障碍保留公共交通方案；当前演示车辆的轮椅空间与上落客设施尚未确认。'};
 return {eligible:true,reason:null,needsVehicleConfirmation:need==='luggage',message:need==='luggage'?'行李空间待确认：车型、后备厢容量与装卸条件为演示假设，请确认后再乘车。':''};
}
export function annotateTaxiPassengerResult(result,request={}){
 if(request.need!=='luggage')return result;
 const note=taxiPassengerPolicy({enabled:true,need:'luggage'}).message;
 return {...result,luggageSpaceUnverified:true,needsVehicleConfirmation:true,needsConfirmation:true,needsFacilityConfirmation:true,accessibilityVerified:false,luggageCompatible:undefined,message:[result.message,note].filter(Boolean).join(' '),warnings:[...new Set([...(result.warnings??[]),note])]};
}
