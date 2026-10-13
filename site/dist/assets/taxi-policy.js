import {PASSENGER_NEEDS} from './passenger-preferences.js?v=616dc1f931e4';
/** Passenger policy only; does not change public routing or vehicle road paths. */
export function taxiPassengerPolicy({enabled=false,need='ordinary'}={}){
 if(!enabled)return {eligible:false,reason:'disabled',needsVehicleConfirmation:false,message:''};
 if(!PASSENGER_NEEDS.includes(need))return {eligible:false,reason:'unsupported-passenger-preference',needsVehicleConfirmation:true,message:'此出行偏好已不受支持，请明确选择当前四种偏好后重新规划；未知车辆适配能力不计为可用。'};
 return {eligible:true,reason:null,needsVehicleConfirmation:need==='luggage',message:need==='luggage'?'行李空间待确认：车型、后备厢容量与装卸条件为演示假设，请确认后再乘车。':''};
}
export function annotateTaxiPassengerResult(result,request={}){
 if(request.need!=='luggage')return result;
 const note=taxiPassengerPolicy({enabled:true,need:'luggage'}).message;
 return {...result,luggageSpaceUnverified:true,needsVehicleConfirmation:true,needsConfirmation:true,needsFacilityConfirmation:true,accessibilityVerified:false,luggageCompatible:undefined,message:[result.message,note].filter(Boolean).join(' '),warnings:[...new Set([...(result.warnings??[]),note])]};
}
