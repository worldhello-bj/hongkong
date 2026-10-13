import {normalizePassengerNeed,isRemovedPassengerNeed} from "./passenger-preferences.js?v=0f6587f77445";
// One route namespace for current navigation and historical public entry points.
export const APP_STAGES = Object.freeze(['home','search','routes','navigation','arrival','orders','account','services','checkout','station','info','mall']);
export const STATIONS = Object.freeze([
  {id:'ADM',name:'金钟',center:[114.1658,22.2791]},
  {id:'HUH',name:'红磡',center:[114.1817,22.3033]},
  {id:'AUS',name:'柯士甸',center:[114.1668,22.3048]},
  {id:'KOW',name:'九龙',center:[114.1615,22.3048]},
  {id:'EXC',name:'会展',center:[114.1753,22.282]}
]);
const aliases = Object.freeze({area:'home',map:'home',metro:'station',model:'station',research:'info',about:'info',settings:'account'});
export function validStation(value) {
  return STATIONS.some(station=>station.id===value) ? value : 'ADM';
}
export function normalizeAppStage(stage, {hasJourney=false, hasCheckout=false, hasDestination=false}={}) {
  const normalized=aliases[stage]??stage;
  if(!APP_STAGES.includes(normalized)) return 'home';
  if(normalized==='navigation'&&!hasJourney) return 'routes';
  if(normalized==='checkout'&&!hasCheckout) return 'orders';
  if(normalized==='arrival'&&!hasDestination) return 'home';
  return normalized;
}
export function parseNavigationLocation(location={}, available={}) {
  const pathname=location.pathname??'/';
  const query=new URLSearchParams(location.search??'');
  const [rawHash,hashQuery='']=(location.hash??'').replace(/^#\/?/,'').split('?');
  const hashParams=new URLSearchParams(hashQuery);
  const oldPage=pathname.replace(/\/+$/,'').split('/').pop().replace(/\.html$/,'');
  const fallback=oldPage==='metro'?'station':oldPage==='research'?'info':query.has('station')?'station':'home';
  const stage=normalizeAppStage(rawHash||fallback,available);
  // Only retired passenger values count in legacy parameter names. Transport
  // mode=metro/transit and score priority=budget must never alter passenger needs.
  const retiredParameter=params=>{
    for(const key of ['preference','profile','accessibility','mode']){
      const value=params.get(key);
      if(isRemovedPassengerNeed(value))return value;
      if(key==='accessibility'&&/^(?:1|true|yes|on)$/i.test(value??''))return 'accessible';
    }
    return null;
  };
  let hashNeed=null;
  try{const decoded=decodeURIComponent(rawHash);if(isRemovedPassengerNeed(decoded))hashNeed=decoded;}catch{}
  const rawNeed=hashParams.get('need')??hashParams.get('passengerNeed')??query.get('need')??query.get('passengerNeed')??retiredParameter(hashParams)??retiredParameter(query)??hashNeed;
  return {stage,station:validStation(hashParams.get('station')??query.get('station')),...rawNeed===null?{}:normalizeNavigationState({need:rawNeed,passengerNeedMigrated:false})};
}
export function navigationUrl(state) {
  const stage=APP_STAGES.includes(state.stage)?state.stage:'home';
  return '/#'+stage+(stage==='station'?'?station='+validStation(state.station):'');
}
export function primaryAppTab(stage) {
  if(stage==='checkout')return 'orders';
  if(stage==='info')return 'services';
  return ['orders','account','services'].includes(stage)?stage:'home';
}

// Saved state is an input boundary. Retired values never re-enter the UI or a request.
export function normalizeNavigationState(state={}) {
  return {...state,need:normalizePassengerNeed(state.need),...isRemovedPassengerNeed(state.need)?{passengerNeedMigrated:true}:{}};
}
export function normalizeAccountPreferences(preferences={}) {
  const next={...preferences,stepFree:false};
  if(isRemovedPassengerNeed(next.priority)){next.priority='fast';next.passengerNeedMigrated=true;}
  if(preferences.stepFree===true||['need','passengerNeed'].some(key=>isRemovedPassengerNeed(preferences[key])))next.passengerNeedMigrated=true;
  for(const key of ['need','passengerNeed'])if(Object.hasOwn(next,key))next[key]=normalizePassengerNeed(next[key]);
  return next;
}
export function migrateSavedNavigationData(saved) {
  if(!saved||typeof saved!=='object'||Array.isArray(saved))return saved;
  const normalizeFields=value=>{
    if(!value||typeof value!=='object'||Array.isArray(value))return value;
    const next={...value};
    for(const key of ['need','passengerNeed'])if(Object.hasOwn(next,key))next[key]=normalizePassengerNeed(next[key]);
    return next;
  };
  const result=normalizeFields(saved);
  if(saved.preferences&&typeof saved.preferences==='object'&&!Array.isArray(saved.preferences))result.preferences=normalizeAccountPreferences(saved.preferences);
  if(Array.isArray(saved.orders))result.orders=saved.orders.map(order=>{
    const next=normalizeFields(order);
    if(!next||typeof next!=='object'||Array.isArray(next))return next;
    for(const key of ['quote','request'])if(next[key])next[key]=normalizeFields(next[key]);
    return next;
  });
  return result;
}
