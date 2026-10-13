import {JOURNEY_3D_MODELS, JOURNEY_3D_SOURCES} from './journey-3d-data.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const clamp = (value, low, high, fallback = low) => Number.isFinite(value) ? Math.max(low, Math.min(high, value)) : fallback;
const directions = new Set(['departure', 'arrival']);
const NO_LOCATION = '当前步骤未定位到站内楼层；已清除高亮。可手动查看示意，实际走法以导航与现场标志为准。';
const safeUrl = value => {
  try { const url = new URL(value); return url.protocol === 'https:' ? esc(url.href) : ''; } catch { return ''; }
};
export const JOURNEY_3D_STATIONS = Object.freeze(Object.values(JOURNEY_3D_MODELS).map(({id, name}) => Object.freeze({id, name})));
/** Immutable display metadata only. Intentionally has no graph/route input. */
export function buildJourney3DModel(stationId) {
  return Object.hasOwn(JOURNEY_3D_MODELS, stationId) ? JOURNEY_3D_MODELS[stationId] : null;
}

/**
 * Resolve ONLY canonical procedure kinds and structured trip direction.
 * Names, map coordinates, generic waits and mainline geometry are not indoor
 * evidence. Returning null is deliberate; callers must not preserve stale focus.
 */
export function resolveJourney3DStep(step, {trip} = {}) {
  if (!step || !['procedure', 'wait'].includes(step.kind)) return null;
  const procedure = step.highSpeedProcedure;
  const from = trip?.fromStopId ?? trip?.fromId;
  const to = trip?.toStopId ?? trip?.toId;
  const north = from === 'HSR:WEK' && to === 'HSR:FUT';
  const south = from === 'HSR:FUT' && to === 'HSR:WEK';
  let stationId, direction, stageId, floorIds, nodeIds;
  if (north && ['verification', 'security', 'immigration', 'boarding'].includes(procedure)) {
    stationId = 'HSR:WEK'; direction = 'departure'; stageId = procedure;
  } else if (south && procedure === 'immigration') {
    stationId = 'HSR:WEK'; direction = 'arrival'; stageId = 'immigration';
  } else if (south && procedure === 'departure-buffer') {
    stationId = 'HSR:FUT'; direction = 'departure'; stageId = 'boarding';
    floorIds = ['B2', 'B3']; nodeIds = ['waiting', 'boarding', 'platform'];
  } else if ((north || south) && procedure === 'onboard-wait') {
    stationId = from; direction = 'departure'; stageId = 'boarding';
    floorIds = [north ? 'B4' : 'B3']; nodeIds = ['platform'];
  } else return null;
  const model = buildJourney3DModel(stationId), journey = model.journeys[direction];
  const index = journey.stages.findIndex(stage => stage.id === stageId), stage = journey.stages[index];
  return {stationId, direction, stageId, stageIndex:index, floorIds:floorIds ?? [...stage.floors], nodeIds:nodeIds ?? [...stage.nodes],
    locationMode:'procedure-only', geometryMode:'schematic-ui', routeEligible:false,
    label:procedure === 'departure-buffer' ? '进站手续概览：仅限定候车层与站台层，未细分各手续位置' : stage.label,
    note:procedure === 'onboard-wait' ? '车内等候发车；仅显示对应站台层，不代表列车实际停靠位置。' : stage.note};
}

const fallback = message => `<div class="j3d-fallback" role="status">${esc(message || '站内示意暂不可用，请继续使用文字导航与官方站图。')}</div>`;
const validModel = model => Boolean(
  model?.floors?.length && model.floors.length <= 8 && Array.isArray(model.nodes) && Array.isArray(model.sourceIds) && Array.isArray(model.warnings) &&
  model.floors.every(f => typeof f.id === 'string') && new Set(model.floors.map(f => f.id)).size === model.floors.length &&
  model.nodes.every(n => model.floors.some(f => f.id === n.floor) && Array.isArray(n.displayPoint) && n.displayPoint.length === 2 && n.displayPoint.every(v => Number.isFinite(v) && Math.abs(v) <= 154)) &&
  ['departure', 'arrival'].every(direction => {
    const journey = model.journeys?.[direction];
    return journey?.stages?.length > 0 && journey.stages.length <= 12 && Array.isArray(journey.sequence) && journey.stages.every(stage => Array.isArray(stage.nodes) && Array.isArray(stage.floors));
  })
);
function viewState(model, options = {}) {
  const direction = directions.has(options.direction) ? options.direction : 'departure';
  const journey = model.journeys[direction];
  const floor = options.floor === 'ALL' || model.floors.some(f => f.id === options.floor) ? options.floor : 'ALL';
  const progress = clamp(options.progress, 0, 1);
  const stageIndex = Number.isInteger(options.stageIndex) ? clamp(options.stageIndex, -1, journey.stages.length - 1) : Math.round(progress * (journey.stages.length - 1));
  const current = journey.stages[stageIndex];
  return {direction, journey, floor, progress, stageIndex, current, exploded: options.exploded !== false, angle: clamp(options.angle, -.65, .65, -.18),
    nodeIds: Array.isArray(options.nodeIds) ? options.nodeIds.filter(id => model.nodes.some(n => n.id === id)) : current?.nodes ?? [],
    floorIds: Array.isArray(options.floorIds) ? options.floorIds.filter(id => model.floors.some(f => f.id === id)) : current?.floors ?? []};
}

/** Self-contained SVG. All positions are unitless schematic display units. */
export function journey3DModelSvg(model, options = {}) {
  if (!validModel(model)) return fallback();
  const state = viewState(model, options), {journey} = state;
  const floorCount = model.floors.length;
  const single = state.floor !== 'ALL';
  const gap = single ? 0 : state.exploded ? 88 : 45;
  const topY = single ? 210 : state.exploded ? 104 : 167;
  const project = (point, floor) => {
    const x = point[0], y = point[1], c = Math.cos(state.angle), s = Math.sin(state.angle), dx = x*c-y*s, dy = x*s+y*c;
    return [428 + dx*1.13 - dy*.66, topY + model.floors.findIndex(f => f.id === floor)*gap + dx*.12 + dy*.28];
  };
  const visible = model.floors.filter(f => !single || f.id === state.floor);
  const activeNodes = new Set(state.nodeIds), activeFloors = new Set(state.floorIds);
  const sequence = journey.sequence.map(id => model.nodes.find(node => node.id === id)).filter(Boolean);
  const nodeSet = new Set([...sequence.map(n => n.id), ...journey.stages.flatMap(s => s.nodes)]);
  const fmt = p => p.map(n => Number(n).toFixed(2)).join(',');
  const points = array => array.map(fmt).join(' ');
  const plate = [[-154,-72],[154,-72],[154,72],[-154,72]];
  const floors = [...visible].reverse().map(f => {
    const p = plate.map(point => project(point, f.id)), low = p.map(([x,y]) => [x,y+9]);
    const active = activeFloors.has(f.id), fy = project([0,0],f.id)[1];
    const nodes = model.nodes.filter(n => n.floor === f.id && nodeSet.has(n.id)).map(n => {
      const [x,y] = project(n.displayPoint,f.id), focus = activeNodes.has(n.id);
      return `<g class="j3d-node${focus ? ' is-active' : ''}" data-model-node="${esc(n.id)}"><title>${esc(n.label)}：位置为示意，非实时定位</title>${focus ? `<circle class="j3d-node-halo" cx="${x}" cy="${y}" r="17"/>` : ''}<circle class="j3d-node-dot" cx="${x}" cy="${y}" r="${focus ? 7 : 5}"/><text x="${x}" y="${y+26}" text-anchor="middle">${esc(n.label)}</text></g>`;
    }).join('');
    const platform = /站台|月台/.test(f.label) ? [-32,20].map(y => `<path class="j3d-platform" d="M${fmt(project([-126,y],f.id))} L${fmt(project([126,y],f.id))}"/>`).join('') : '';
    return `<g data-model-floor="${esc(f.id)}" class="j3d-layer${active ? ' is-active' : ''}"><polygon class="j3d-slab-side" points="${points([p[1],p[2],p[3],low[3],low[2],low[1]])}"/><polygon class="j3d-slab" points="${points(p)}"/>${platform}<path class="j3d-floor-guide" d="M152,${fy} L${p[3][0]-9},${fy}"/><text class="j3d-floor-id" x="24" y="${fy-2}">${esc(f.id)}</text><text class="j3d-floor-name" x="24" y="${fy+21}">${esc(f.label)}</text>${nodes}</g>`;
  }).join('');
  // Links explain procedural order. They are outside any routing data structure.
  const links = sequence.slice(1).map((next,index) => {
    const prev = sequence[index];
    if (single && (prev.floor !== state.floor || next.floor !== state.floor)) return '';
    const a = project(prev.displayPoint,prev.floor), b = project(next.displayPoint,next.floor);
    const active = activeNodes.has(prev.id) || activeNodes.has(next.id);
    return `<path class="j3d-process-link${active ? ' is-active' : ''}" data-procedure-link="true" d="M${fmt(a)} C${fmt([a[0]+30,a[1]+15])} ${fmt([b[0]-30,b[1]-15])} ${fmt(b)}"><title>手续先后示意，不是步行通道</title></path>`;
  }).join('');
  return `<svg class="j3d-svg" viewBox="0 0 720 460" role="img" aria-label="${esc(model.name)} ${esc(journey.label)}立体楼层示意"><title>${esc(model.name)}：官方楼层用途，程序化几何；非实测站内导航</title><desc>仅展示楼层层级与手续关系，虚线不代表可走通道。不含精确出口、实时位置或无障碍承诺。</desc><text class="j3d-svg-caption" x="24" y="32">${esc(model.englishName)} / ${single ? esc(state.floor) : 'FLOOR STUDY'}</text><text class="j3d-svg-disclaimer" x="24" y="441">非比例示意 · 未建模夹层与完整设施 · ${floorCount} 个流程相关楼层</text>${floors}<g class="j3d-procedure-links">${links}</g></svg>`;
}

/** Optional pure markup helper for integration snapshots/offline verification. */
export function journey3DModelPanel(model, options = {}) {
  if (!validModel(model)) return fallback();
  const state = viewState(model, options), selected = state.current;
  const stationChoices = JOURNEY_3D_STATIONS.map(station => `<option value="${esc(station.id)}"${station.id === model.id ? ' selected' : ''}>${esc(station.name)}</option>`).join('');
  const note = options.notice || selected?.note || NO_LOCATION;
  const sources = model.sourceIds.map(id => JOURNEY_3D_SOURCES[id]).filter(Boolean);
  return `<section class="j3d-model" aria-label="高铁站立体流程示意">
    <header class="j3d-heading"><div><p class="j3d-eyebrow">站内空间 / 流程演练</p><h2>${esc(model.name)}</h2></div><span class="j3d-schematic-badge">示意模型</span></header>
    <p class="j3d-evidence"><span>资料依据</span> ${esc(model.factsLabel)} <span class="j3d-modeled">程序化</span> 体量 · 位置 · 连线</p>
    <div class="j3d-toolbar"><label>车站<select data-j3d-control="station" aria-label="选择高铁模型车站">${stationChoices}</select></label><label>楼层<select data-j3d-control="floor" aria-label="选择示意楼层"><option value="ALL"${state.floor === 'ALL' ? ' selected' : ''}>全部楼层</option>${model.floors.map(f => `<option value="${esc(f.id)}"${state.floor === f.id ? ' selected' : ''}>${esc(f.id)} · ${esc(f.label)}</option>`).join('')}</select></label></div>
    <div class="j3d-view-options"><div class="j3d-directions" role="group" aria-label="选择站内流程">${['departure','arrival'].map(direction => `<button type="button" data-j3d-action="${direction}" aria-pressed="${state.direction === direction}">${esc(model.journeys[direction].label)}</button>`).join('')}</div><div class="j3d-camera" role="group" aria-label="模型视角"><button type="button" data-j3d-action="left" aria-label="向左旋转示意模型">↶</button><button type="button" data-j3d-action="right" aria-label="向右旋转示意模型">↷</button><button type="button" data-j3d-action="explode" aria-pressed="${state.exploded}">${state.exploded ? '收拢楼层' : '展开楼层'}</button></div></div>
    <div class="j3d-view">${journey3DModelSvg(model,state)}</div>
    <p class="j3d-legend"><span class="j3d-legend-point"></span>手续所在楼层 <span class="j3d-legend-line"></span>流程关系，非步行通道</p>
    <div class="j3d-progress"><label>流程进度 · 手动演练<input data-j3d-control="progress" type="range" min="0" max="${state.journey.stages.length-1}" step="1" value="${Math.max(0,state.stageIndex)}" aria-label="手动选择流程阶段" aria-valuetext="${esc(selected?.label || '未定位')}" /></label><output>${state.stageIndex < 0 ? '未定位' : `${state.stageIndex+1} / ${state.journey.stages.length}`}</output></div>
    <ol class="j3d-steps">${state.journey.stages.map((stage,index) => `<li><button type="button" data-j3d-action="stage" data-j3d-stage="${index}"${index === state.stageIndex ? ' aria-current="step"' : ''}><span>${index+1}</span><span>${esc(stage.label)}<small>${esc(stage.floors.join(' → '))}</small></span></button></li>`).join('')}</ol>
    <p class="j3d-current" role="status" aria-live="polite">${options.linked ? '<strong>导航步骤对应 · 非实时定位</strong> ' : ''}${esc(note)}</p>
    <details class="j3d-disclosure"><summary>依据、精度与未覆盖内容</summary>${model.warnings.map(warning => `<p>${esc(warning)}</p>`).join('')}${model.id === 'HSR:FUT' ? '<p>福田楼层资料发布于 2015 年；当前出入口、换乘通道、设备与到达出闸位置未核验，流程只作空间说明。</p>' : ''}<ul>${sources.map(source => `<li><a href="${safeUrl(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.label)} ↗</a><small>${esc(source.supports)} 核验日期 ${esc(source.checked)}。</small></li>`).join('')}</ul></details>
    <p class="j3d-safety">请依现场标志通行。这里没有逐转指引、精确出口或已核验的无障碍路线。</p>
  </section>`;
}

/** Host-only integration; no routing dependencies, external requests or timers. */
export function createJourney3DModel(container, {stationId = 'HSR:WEK', direction = 'departure', onStationChange} = {}) {
  if (!container || typeof container.addEventListener !== 'function') throw new TypeError('Journey 3D requires a host element.');
  let model = buildJourney3DModel(stationId), disposed = false;
  let state = {direction:directions.has(direction) ? direction : 'departure', floor:'ALL', exploded:true, angle:-.18, progress:0, stageIndex:0, notice:'', linked:false};
  const controller = new AbortController();
  function render() {
    if (disposed) return;
    const active = container.ownerDocument?.activeElement;
    const control = active && container.contains?.(active) ? active.dataset?.j3dControl : undefined;
    const action = active && container.contains?.(active) ? active.dataset?.j3dAction : undefined;
    const index = active?.dataset?.j3dStage;
    const open = container.querySelector?.('.j3d-disclosure')?.open;
    container.innerHTML = journey3DModelPanel(model,state);
    if (open) { const details = container.querySelector?.('.j3d-disclosure'); if (details) details.open = true; }
    const selector = control && ['station','floor','progress'].includes(control) ? `[data-j3d-control="${control}"]` : action && ['left','right','explode','departure','arrival','stage'].includes(action) ? `[data-j3d-action="${action}"]${action === 'stage' && /^\d+$/.test(index) ? `[data-j3d-stage="${index}"]` : ''}` : null;
    if (selector) container.querySelector?.(selector)?.focus?.({preventScroll:true});
  }
  function chooseStage(index) {
    if (!model) return false;
    const stages = model.journeys[state.direction].stages;
    if (!Number.isInteger(index) || index < 0 || index >= stages.length) return false;
    state = {...state, stageIndex:index, progress:index/Math.max(1,stages.length-1), floor:'ALL', nodeIds:undefined, floorIds:undefined, notice:'', linked:false};
    render(); return true;
  }
  function setStation(id) {
    if (disposed) return false;
    const next = buildJourney3DModel(id); if (!next) return false;
    model = next; state = {...state, floor:'ALL', progress:0, stageIndex:0, nodeIds:undefined, floorIds:undefined, notice:'', linked:false};
    render(); return true;
  }
  container.addEventListener('change', event => {
    if (disposed || !model) return;
    const control = event.target?.dataset?.j3dControl, value = event.target?.value;
    if (control === 'station') { if (setStation(value)) onStationChange?.(value); }
    else if (control === 'floor' && (value === 'ALL' || model.floors.some(f => f.id === value))) { state.floor = value; render(); }
    else if (control === 'progress') chooseStage(Number(value));
  }, {signal:controller.signal});
  container.addEventListener('click', event => {
    if (disposed || !model) return;
    const button = event.target?.closest?.('[data-j3d-action]');
    if (!button || container.contains && !container.contains(button)) return;
    const action = button.dataset.j3dAction;
    if (action === 'stage') { chooseStage(Number(button.dataset.j3dStage)); return; }
    if (directions.has(action)) { state.direction = action; chooseStage(0); return; }
    if (action === 'left') state.angle = clamp(state.angle-.2,-.65,.65);
    else if (action === 'right') state.angle = clamp(state.angle+.2,-.65,.65);
    else if (action === 'explode') state.exploded = !state.exploded;
    else return;
    render();
  }, {signal:controller.signal});
  render();
  return {
    setStation,
    focusFloor(floor) { if (!disposed && model && (floor === 'ALL' || model.floors.some(f => f.id === floor))) { state.floor = floor; render(); return true; } return false; },
    focusStep(step, context = {}) {
      if (disposed) return null;
      const target = resolveJourney3DStep(step,context);
      if (!target) { state = {...state, floor:'ALL', stageIndex:-1, nodeIds:[], floorIds:[], notice:NO_LOCATION, linked:false}; render(); return null; }
      model = buildJourney3DModel(target.stationId);
      state = {...state, direction:target.direction, floor:target.floorIds.length === 1 ? target.floorIds[0] : 'ALL', stageIndex:target.stageIndex, progress:target.stageIndex/Math.max(1,model.journeys[target.direction].stages.length-1), nodeIds:target.nodeIds, floorIds:target.floorIds, notice:target.note, linked:true};
      render(); return target;
    },
    setProgress(progress) { if (disposed || !model || !Number.isFinite(progress)) return false; return chooseStage(Math.round(clamp(progress,0,1)*(model.journeys[state.direction].stages.length-1))); },
    getState() { return {stationId:model?.id ?? null, ...state, nodeIds:state.nodeIds?.slice(), floorIds:state.floorIds?.slice()}; },
    resize() {},
    dispose() { if (disposed) return; disposed = true; controller.abort(); container.innerHTML = ''; }
  };
}
