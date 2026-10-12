// One route namespace for current navigation and historical public entry points.
export const APP_STAGES = Object.freeze(['home','search','routes','navigation','arrival','orders','account','services','checkout','station','info']);
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
  const oldPage=pathname.split('/').pop();
  const fallback=oldPage==='metro.html'?'station':oldPage==='research.html'?'info':query.has('station')?'station':'home';
  const stage=normalizeAppStage(rawHash||fallback,available);
  return {stage,station:validStation(hashParams.get('station')??query.get('station'))};
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
