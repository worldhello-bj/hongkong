/** Existing timetable stop coordinates only. All arrivals are simulated, never live. */
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const displayDirection = route => /RAIL:/.test(route.direction ?? '') && /→/.test(route.label ?? '') ? '' : route.direction;
const modeName = mode => ({bus:'公交', tram:'电车', metro:'港铁',highspeed:'高铁'}[mode] ?? '公共交通');

export function stopCatalog(services) {
  const links = new Map();
  for (const pattern of services?.patterns ?? []) {
    if (!['bus', 'tram', 'metro','highspeed'].includes(pattern.mode)) continue;
    for (const entry of pattern.stops ?? []) {
      if(pattern.mode==='highspeed'&&entry.stopId!==pattern.fromId)continue;
      let routes = links.get(entry.stopId);
      if (!routes) links.set(entry.stopId, routes = []);
      if (!routes.some(route => route.mode === pattern.mode && route.label === pattern.label && route.direction === pattern.direction)) {
        routes.push({mode:pattern.mode, label:pattern.label, direction:pattern.direction});
      }
    }
  }
  return (services?.stops ?? [])
    .filter(stop => links.has(stop.id) && stop.coordinates?.length >= 2 && stop.coordinates.slice(0, 2).every(Number.isFinite))
    .map(stop => {
      const routes = links.get(stop.id);
      return {...stop, name:String(stop.name ?? stop.id).split(/<br\s*\/?>|\n/i)[0].replace(/<[^>]*>/g, '').trim(),
        routes, mode:['highspeed','metro', 'tram', 'bus'].find(mode => routes.some(route => route.mode === mode))};
    });
}

export function layoutStops(stops, view, width, project) {
  const scale = view.w / width, cell = 44 * scale, groups = new Map();
  for (const stop of stops) {
    const [x, y] = project(stop.coordinates);
    if (x < view.x - cell || x > view.x + view.w + cell || y < view.y - cell || y > view.y + view.h + cell) continue;
    const key = view.w > 1500 ? `${stop.mode}:${Math.floor(x / cell)}:${Math.floor(y / cell)}` : stop.id;
    let group = groups.get(key);
    if (!group) groups.set(key, group = {key, mode:stop.mode, x:0, y:0, stops:[]});
    group.x += x; group.y += y; group.stops.push(stop);
  }
  return [...groups.values()].map(group => ({...group, x:group.x / group.stops.length, y:group.y / group.stops.length, scale}));
}

export function renderStopMarkers(groups, labels = false) {
  return groups.map((group, index) => {
    const multiple = group.stops.length > 1, name = modeName(group.mode);
    const description = multiple ? `${group.stops.length}个${name}站，点击展开` : `${group.stops[0].name}，${name}站，查看模拟下一班`;
    return `<g class="na-transit-stop ${esc(group.mode)}" data-transit-stop="${index}" role="button" tabindex="0" aria-label="${esc(description)}" transform="translate(${group.x} ${group.y}) scale(${group.scale})"><circle class="na-stop-hit" r="22"/><rect x="-13" y="-13" width="26" height="26" rx="${group.mode === 'tram' ? 4 : group.mode === 'metro' ? 7 : 13}"/><text text-anchor="middle" y="5">${multiple ? group.stops.length : {tram:'电', bus:'巴', metro:'铁',highspeed:'高'}[group.mode]}</text>${labels && !multiple && index < 12 ? `<text class="na-stop-label" x="18" y="4">${esc(group.stops[0].name.slice(0, 13))}</text>` : ''}<title>${esc(group.stops.map(stop => stop.name).join('、'))}</title></g>`;
  }).join('');
}

/** Schedule seconds may extend past midnight; retain the day rather than wrapping silently. */
export function formatStopTime(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const day = Math.floor(seconds / 86400), withinDay = ((Math.floor(seconds) % 86400) + 86400) % 86400;
  const prefix = day === 0 ? '' : day === 1 ? '次日 ' : day === -1 ? '前日 ' : `${day > 0 ? '+' : ''}${day}日 `;
  return `${prefix}${String(Math.floor(withinDay / 3600)).padStart(2, '0')}:${String(Math.floor(withinDay / 60) % 60).padStart(2, '0')}`;
}

function countdown(seconds) {
  const value = Math.max(0, Math.ceil(seconds));
  if (!value) return '即将到站';
  if (value < 60) return `${value}秒后到站`;
  const hours = Math.floor(value / 3600), minutes = Math.floor(value / 60) % 60, remainder = value % 60;
  return `${hours ? `${hours}小时` : ''}${minutes}分${remainder ? `${remainder}秒` : ''}后到站`;
}

export function stopDepartures(stop, {timeS, departureDate, model} = {}) {
  const clock = Number.isFinite(timeS) ? `<p class="na-stop-clock">模拟时间：${departureDate ? `${esc(departureDate)} ` : ''}${formatStopTime(timeS)}（香港）</p>` : '';
  if (!model?.departures || !Number.isFinite(timeS)) {
    return `${clock}<p class="na-stop-empty">模拟时刻表尚未就绪。</p>`;
  }
  const departures = model.departures(stop.id, timeS, departureDate, {limit:3})
    .filter(departure => Number.isFinite(departure.departureS) && departure.departureS >= timeS)
    .sort((a, b) => a.departureS - b.departureS).slice(0, 3);
  if (!departures.length) return `${clock}<p class="na-stop-empty">当前模拟时段暂无可乘班次，可能为终点站、已收车或尚未覆盖。</p>`;
  const highSpeed=stop.mode==='highspeed',bufferS=stop.id==='HSR:WEK'?2700:1800;
  const eligible=highSpeed?model.departures(stop.id,timeS+bufferS,departureDate,{limit:1})[0]:null;
  const eligibility=highSpeed?`<p class="na-stop-empty">从现在开始办理，模型需预留 ${bufferS/60} 分钟；${eligible?`最早可规划 ${formatStopTime(eligible.departureS)} ${esc(eligible.label)}`:'本时段暂无可规划班次'}。下列为发车表，未必赶得上。</p>`:'';
  const row = (departure, index) => {
    const arrivalS = Number.isFinite(departure.arrivalS) ? departure.arrivalS : departure.departureS;
    const arriving = highSpeed?countdown(departure.departureS-timeS).replace('后到站','后发车').replace('即将到站','即将发车'):arrivalS < timeS ? '已到站' : countdown(arrivalS - timeS);
    return `<li class="${index === 0 ? 'na-stop-next' : 'na-stop-upcoming'}"><span>${index === 0 ? '下一班' : '随后'} · ${esc(modeName(departure.mode))}</span><p><b>${esc(departure.label)}</b> ${esc(displayDirection(departure))}</p><strong class="na-stop-countdown" role="timer" aria-live="off">${arriving}</strong><small>${highSpeed?`模拟抵达终点 ${formatStopTime(departure.destinationArrivalS)} · ${departure.departureS-timeS<bufferS?"不足手续预留时间":"手续时间按模型预留"}`:`模拟到站 ${formatStopTime(arrivalS)} · 发车 ${formatStopTime(departure.departureS)}`}</small></li>`;
  };
  return `${clock}${eligibility}<ol aria-label="未来模拟班次">${departures.map(row).join('')}</ol>`;
}

export function stopCard(stop, sources = {}, options = {}) {
  // Metro comes from the existing demonstration network, not the TD stop archive.
  const source = stop.mode === 'highspeed' ? '<a target="_blank" rel="noreferrer" href="https://www.highspeed.mtr.com.hk/en/trip-planner.html">港铁高铁一般时刻表</a>（核验于 2026-10-13，重复日期仅为模拟；不保证当日开行或余票）' : stop.mode === 'metro' ? '现有港铁站点与演示时刻表' : '<a target="_blank" rel="noreferrer" href="https://static.data.gov.hk/td/pt-headway-sc/stops.txt">运输署站点资料</a>';
  return `<button class="na-stop-close" data-stop-close aria-label="关闭站点详情">×</button><small>${modeName(stop.mode)}站 · 已有资料覆盖</small><h3 id="na-stop-card-title">${esc(stop.name)}</h3><p class="na-stop-simulation">模拟下一班 · 非实时到站</p><section class="na-stop-departures" data-stop-departures aria-label="模拟到站与后续班次" aria-live="off">${stopDepartures(stop, options)}</section><div class="na-stop-lines" aria-label="途经线路与方向">${stop.routes.map(route => `<p><b>${esc(route.label)}</b> ${esc(displayDirection(route))}</p>`).join('')}</div><p class="na-stop-source">来源：${source} · ${stop.mode==='highspeed'?'站点坐标及轨道线形为示意，非实测定位。':''}线路与班次为当前演示数据，非实时到站</p><div class="na-stop-actions"><button data-stop-side="origin">设为起点</button><button data-stop-side="destination">设为终点</button></div>`;
}

export function createTransitStopLayer({map, layer, card, project, onChoose, onExpand}) {
  let data, stops = [], groups = [], selected, pending, frame, lastKey = '', down, trigger;
  let clock = {}, lastClockKey = '', lastModel;
  card.setAttribute?.('role', 'region');
  card.setAttribute?.('aria-labelledby', 'na-stop-card-title');
  const close = (restoreFocus = false) => {
    card.hidden = true;
    if (restoreFocus) trigger?.focus?.();
  };
  const refresh = (options = {}) => {
    clock = {...clock, ...options};
    if (!selected || card.hidden) return;
    const key = [selected.id, Math.floor(clock.timeS), clock.departureDate].join(':');
    if (lastClockKey === key && lastModel === clock.model) return;
    lastClockKey = key; lastModel = clock.model;
    const content = card.querySelector?.('[data-stop-departures]');
    if (content) content.innerHTML = stopDepartures(selected, clock);
    else card.innerHTML = stopCard(selected, data?.sources, clock);
  };
  map.addEventListener('pointerdown', event => { down = [event.clientX, event.clientY]; });
  const activate = event => {
    const hit = event.target.closest?.('[data-transit-stop]');
    if (!hit) return;
    if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
    if (event.type === 'click' && down && Math.hypot(event.clientX - down[0], event.clientY - down[1]) > 8) return;
    event.preventDefault(); event.stopPropagation();
    const group = groups[Number(hit.dataset.transitStop)];
    if (!group) return;
    if (group.stops.length > 1) { close(); onExpand(group.stops.map(stop => stop.coordinates)); return; }
    selected = group.stops[0]; trigger = hit; lastClockKey = '';
    card.innerHTML = stopCard(selected, data?.sources, clock); card.hidden = false;
    if (event.type === 'keydown') card.querySelector?.('[data-stop-close]')?.focus?.();
  };
  map.addEventListener('click', activate);
  map.addEventListener('keydown', activate);
  card.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
  });
  card.addEventListener('click', event => {
    const button = event.target.closest?.('button');
    if (!button) return;
    if (button.hasAttribute('data-stop-close')) close(true);
    if (button.dataset.stopSide && selected) { close(); onChoose(selected, button.dataset.stopSide); }
  });
  return {
    render(services, view, width, options = {}) {
      if (data !== services) {
        data = services; stops = stopCatalog(services); lastKey = '';
        if (selected) {
          selected = stops.find(stop => stop.id === selected.id);
          if (!selected) close();
          else if (!card.hidden) card.innerHTML = stopCard(selected, data?.sources, {...clock, ...options});
          lastClockKey = '';
        }
      }
      refresh(options); pending = {...view, width};
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const view = pending, key = [view.x, view.y, view.w, view.h, view.width].join(':');
        if (lastKey === key) return;
        lastKey = key; groups = layoutStops(stops, view, view.width, project);
        layer.innerHTML = renderStopMarkers(groups, view.w < 1500);
      });
    },
    refresh,
    updateClock:refresh,
  };
}
