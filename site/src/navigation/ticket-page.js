/**
 * Standalone ticketing rehearsal. There is deliberately no reservation, payment,
 * provider API, QR code, or personally identifying passenger data in this module.
 * Host owns navigation and the one global clock. Prices are reference-only.
 */
export const TICKET_STORAGE_KEY = 'hk-maas-demo-passes-v1';
export const TICKET_DISCLOSURE = '仅为联程体验演示。不会扣款、预留座位或生成可乘车票证。';
const VERSION = 1;
const MAX_PASSES = 30;
const MODES = Object.freeze({walk:'步行接驳',metro:'港铁',rail:'铁路',bus:'公交',tram:'电车',taxi:'出租车',highspeed:'高铁',bikeshare:'单车',parking:'停车'});
const STEPS = ['确认行程','票务摘要','模拟出票','行程凭证'];
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const clone = value => JSON.parse(JSON.stringify(value));
const text = (value, fallback = '') => typeof value === 'string' ? value.slice(0, 300) : fallback;
const amount = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const money = value => value === null ? '未接入' : `HK$ ${(value / 100).toFixed(2)}`;
const number = value => Number.isFinite(value) && value >= 0 ? value : null;
const placeName = value => text(typeof value === 'string' ? value : value?.name, '未选择');
const placeId = value => text(typeof value === 'string' ? value : value?.id ?? value?.node_id ?? value?.name);
const hash = (value, seed) => { let out = seed; for (let i = 0; i < value.length; i++) out = Math.imul(out ^ value.charCodeAt(i), 16777619); return (out >>> 0).toString(36).padStart(7, '0'); };

/** Revision is required, even when the parent has no quote/order to attach. */
export function ticketContext(value = {}) {
  return {
    departureDate: text(value.departureDate ?? value.baseDate),
    departureS: Number.isFinite(value.departureS ?? value.timeS) ? (value.departureS ?? value.timeS) : null,
    trafficRevision: value.trafficRevision ?? value.revision ?? null,
    scenarioKey: text(value.scenarioKey),
    epochMs: Number.isFinite(value.epochMs) ? value.epochMs : Date.parse((value.departureDate ?? value.baseDate) + 'T00:00:00Z') - 8 * 3600000 + (value.departureS ?? value.timeS) * 1000,
    routeRevision: typeof value.routeRevision === 'string' || Number.isFinite(value.routeRevision) ? value.routeRevision : null,
  };
}
function validContext(value) {
  const epoch = Date.parse(value.departureDate + 'T00:00:00Z');
  return /^\d{4}-\d{2}-\d{2}$/.test(value.departureDate) && Number.isFinite(epoch) && new Date(epoch).toISOString().slice(0,10) === value.departureDate && Number.isFinite(value.departureS) && value.departureS >= 0 && value.departureS <= 86400 * 366 * 100 &&
    Number.isInteger(value.trafficRevision) && value.trafficRevision >= 0 && value.routeRevision !== null && Number.isFinite(value.epochMs);
}
export function isTicketContextCurrent(captured, current) {
  const left = ticketContext(captured), right = ticketContext(current);
  return validContext(left) && validContext(right) && Object.keys(left).every(key => left[key] === right[key]);
}
function travelTime(context) {
  if (!context || context.departureS === null) return '模拟时刻待确认';
  const seconds = context.departureS % 86400;
  const days = Math.floor(context.departureS / 86400);
  const epoch = Date.parse(context.departureDate + 'T00:00:00Z');
  const date = Number.isFinite(epoch) ? new Date(epoch + days * 86400000).toISOString().slice(0, 10) : context.departureDate;
  return `${date} · ${String(Math.floor(seconds / 3600)).padStart(2,'0')}:${String(Math.floor(seconds / 60) % 60).padStart(2,'0')} 香港时间`;
}
function routeSegments(choice) {
  const quote = choice?.quote ?? {}, result = choice?.result ?? {};
  const segments = result.segments?.length ? result.segments : quote.segments?.length ? quote.segments :
    (result.journey?.phases ?? []).map(label => ({kind:'walk', label}));
  return segments.slice(0, 100).map((segment, index) => {
    const mode = text(segment.mode ?? segment.kind, 'walk');
    const normalized = mode === 'rail' ? 'metro' : MODES[mode] ? mode : 'walk';
    // A quote's per-segment price is usable only when the exact sequence agrees.
    const quoted = quote.segments?.[index];
    const quotedMatches = quoted && quoted.mode === normalized && quoted.label === segment.label;
    return {
      mode: normalized, label: text(segment.label, MODES[normalized]),
      minutes: number(segment.minutes ?? segment.durationMinutes),
      amountCents: normalized === 'highspeed' ? null : amount(quotedMatches ? quoted.amountCents : segment.amountCents),
    };
  });
}
/** Accepts the app's existing route choice shape. Keeps only the public trip summary. */
export function prepareTicketTrip({choice, origin, destination, context} = {}) {
  if (!choice || choice.available !== true || choice.result?.journey?.complete !== true) return null;
  const segments = routeSegments(choice);
  if (!segments.length) return null;
  const current = ticketContext(context);
  const captured = ticketContext({...current, ...choice.result.navigationSnapshot});
  const highSpeed = choice.result.highSpeed === true || choice.modes?.includes('highspeed') || segments.some(segment => segment.mode === 'highspeed');
  const pricingUnavailable = highSpeed || choice.quote?.pricingUnavailable === true || amount(choice.quote?.totalCents) === null;
  return {
    version: VERSION, routeId: text(choice.id), title: text(choice.title, '联程出行'),
    origin: placeName(origin), destination: placeName(destination),
    originId: placeId(origin), destinationId: placeId(destination),
    context: captured, minutes: number(choice.minutes ?? choice.result.totalMinutes),
    transfers: number(choice.transfers), segments, highSpeed,
    totalCents: pricingUnavailable ? null : amount(choice.quote?.totalCents),
    pricingUnavailable,
    warnings: (choice.warnings ?? choice.result.warnings ?? []).filter(value => typeof value === 'string').slice(0, 6).map(value => text(value)),
  };
}
/** Stable across reloads and repeated clicks; quote IDs and issue wall time are excluded. */
export function ticketPassId(trip) {
  const key = JSON.stringify([trip.version, trip.routeId, trip.originId, trip.destinationId, trip.context, trip.segments, trip.totalCents]);
  return `DEMO-${hash(key, 2166136261).toUpperCase()}-${hash(key, 3335557771).toUpperCase()}`;
}
function validTrip(trip) {
  return trip?.version === VERSION && typeof trip.routeId === 'string' && typeof trip.origin === 'string' && typeof trip.destination === 'string' &&
    typeof trip.originId === 'string' && typeof trip.destinationId === 'string' && validContext(ticketContext(trip.context)) &&
    (trip.totalCents === null || amount(trip.totalCents) !== null) && typeof trip.highSpeed === 'boolean' &&
    Array.isArray(trip.segments) && trip.segments.length > 0 && trip.segments.length <= 100 && trip.segments.every(segment =>
      MODES[segment.mode] && typeof segment.label === 'string' && (segment.minutes === null || number(segment.minutes) !== null) &&
      (segment.amountCents === null || amount(segment.amountCents) !== null)) &&
    (!trip.highSpeed || trip.totalCents === null) && trip.segments.every(segment => segment.mode !== 'highspeed' || (trip.highSpeed && segment.amountCents === null)) && Array.isArray(trip.warnings) && trip.warnings.every(value => typeof value === 'string');
}
function validPass(pass) {
  return pass?.version === VERSION && pass.demoOnly === true && pass.status === 'demo-issued' && validTrip(pass.trip) &&
    pass.id === ticketPassId(pass.trip) && Number.isFinite(pass.issuedAt) && pass.chargedCents === 0;
}
function action(label, name, className = 'tp-primary', extra = '') {
  return `<button type="button" class="${className}" data-ticket-action="${name}" ${extra}>${label}</button>`;
}
function stepper(step) {
  return `<ol class="tp-stepper" aria-label="演示出票进度">${STEPS.map((label,index) => `<li class="${index < step ? 'is-done' : index === step ? 'is-current' : ''}" ${index === step ? 'aria-current="step"' : ''}><span aria-hidden="true">${index < step ? '✓' : String(index + 1).padStart(2,'0')}</span><b>${label}</b></li>`).join('')}</ol>`;
}
function tripHeader(trip) {
  return `<div class="tp-route"><div><small>从这里出发</small><h2>${esc(trip.origin)}</h2></div><span class="tp-route-line" aria-hidden="true"><i></i><i></i><i></i></span><div><small>抵达这一站</small><h2>${esc(trip.destination)}</h2></div></div><div class="tp-trip-meta"><span>${esc(travelTime(trip.context))}</span><span>${trip.minutes === null ? '时长待确认' : `${Math.ceil(trip.minutes)} 分钟 · 模型估算`}</span>${trip.transfers === null ? '' : `<span>${Math.floor(trip.transfers)} 次换乘</span>`}</div>`;
}
function segmentList(trip, priced = false) {
  return `<ol class="tp-segments" aria-label="行程分段">${trip.segments.map((segment,index) => `<li><span class="tp-segment-mark" aria-hidden="true">${String(index + 1).padStart(2,'0')}</span><div><small>${esc(MODES[segment.mode])}${segment.minutes === null ? '' : ` · ${Math.ceil(segment.minutes)} 分钟`}</small><b>${esc(segment.label)}</b></div>${priced ? `<span class="tp-segment-fare">${esc(money(segment.amountCents))}<small>${segment.amountCents === null ? '价格待核验' : '模拟参考'}</small></span>` : ''}</li>`).join('')}</ol>`;
}
function boundary(trip) {
  return `<div class="tp-boundary"><span aria-hidden="true">ⓘ</span><div><b>${trip.highSpeed ? '高铁票价与余票未接入' : '一张演示凭证，串起全程'}</b><p>${trip.highSpeed ? '可以生成行程演示凭证；不会生成跨境车票、座位预订或已支付订单。请通过官方渠道另行购票并核验出入境要求。' : TICKET_DISCLOSURE}</p></div></div>`;
}
function priceSummary(trip) {
  return `<aside class="tp-summary"><span class="tp-eyebrow">JOURNEY SUMMARY</span><h2>这一程，清楚一点</h2><div class="tp-reference-price"><span>${trip.pricingUnavailable ? '全程价格' : '全程模拟参考'}</span><strong>${esc(money(trip.totalCents))}</strong><small>${trip.pricingUnavailable ? '价格与余票待官方核验' : '模型估算，不是官方票价或付款金额'}</small></div><dl><div><dt>真实扣款</dt><dd>不会发生</dd></div><div><dt>出票类型</dt><dd>本机演示凭证</dd></div><div><dt>座位与库存</dt><dd>不会预留</dd></div></dl><p>无需实名、证件或银行卡。<br>旅途先在这里，轻轻演练一遍。</p></aside>`;
}
export function renderTicketPassList(passes, selectedId = null) {
  if (!passes?.length) return '';
  return `<section class="tp-wallet"><h2>我的演示票夹 <span>${passes.length}</span></h2><div class="tp-wallet-list">${passes.map(pass => `<button type="button" class="tp-wallet-item ${pass.id === selectedId ? 'is-selected' : ''}" data-ticket-action="open-pass" data-ticket-id="${esc(pass.id)}"><span class="tp-wallet-icon" aria-hidden="true">↗</span><span><b>${esc(pass.trip.origin)} → ${esc(pass.trip.destination)}</b><small>${esc(travelTime(pass.trip.context))}</small><small>${esc(pass.id)}</small></span><span aria-hidden="true">›</span></button>`).join('')}</div></section>`;
}
function credential(pass) {
  const trip = pass.trip;
  return `<article class="tp-credential" aria-label="不可乘车的演示行程凭证"><div class="tp-credential-top"><span>层间 · HONG KONG</span><b>DEMO ONLY</b></div><div class="tp-credential-body"><span class="tp-eyebrow">YOUR JOURNEY, TOGETHER</span>${tripHeader(trip)}<div class="tp-mode-ribbon">${[...new Set(trip.segments.map(segment => segment.mode))].map(mode => `<span>${esc(MODES[mode])}</span>`).join('<i aria-hidden="true">·</i>')}</div></div><div class="tp-ticket-tear" aria-hidden="true"></div><div class="tp-credential-bottom"><div><small>演示凭证编号</small><strong>${esc(pass.id)}</strong><span>已生成 · 无真实扣款</span></div><div class="tp-demo-stamp" aria-label="演示专用，不能乘车"><b>DEMO</b><span>不能乘车</span></div></div><p class="tp-credential-warning">非车票 · 非预订 · 不能用于乘车、进站或出入境</p></article>`;
}
/** Pure HTML renderer. Every route/user-visible string is escaped at its output boundary. */
export function renderTicketPage(state = {}) {
  const {trip = null, pass = null, passes = [], phase = 'empty', stale = false, error = '', storageMessage = '仅在当前页面保存；刷新后不会保留。'} = state;
  const active = pass?.trip ?? trip;
  const step = phase === 'confirm' ? 0 : phase === 'summary' ? 1 : phase === 'issuing' ? 2 : phase === 'issued' ? 3 : 0;
  const titles = {empty:'把下一程，收进票夹。',confirm:'这一程，准备好了。',summary:'一程，一张演示凭证。',issuing:'正在把旅程串起来…',issued:'愿这一程，轻松抵达。'};
  const descriptions = {empty:'选定路线后，在这里确认行程、查看摘要，再生成一张专属的演示凭证。',confirm:'先看清去向与时刻，再从容出发。',summary:'交通分段合在一起，费用与边界也说清楚。',issuing:'整理路线与模拟时刻，生成可以回看的行程记录。',issued:'你的行程已收好，随时可以回来看看。'};
  let body = '';
  if (!active) body = `<div class="tp-empty"><div class="tp-empty-ticket" aria-hidden="true"><span>层间</span><i>HONG KONG</i><b>YOUR NEXT<br>JOURNEY</b></div><h2>每一程，都有一个开始</h2><p>先选择一条完整路线，<br>票夹就会替你记住这次演练。</p>${action('去规划行程','plan')}</div>${renderTicketPassList(passes)}`;
  else if (phase === 'issued' && pass) body = `<div class="tp-issued-layout"><div>${credential(pass)}<p class="tp-storage-note">${esc(storageMessage)}</p></div><section class="tp-journey-detail"><h2>把接下来的路，留在手边</h2>${segmentList(active)}${boundary(active)}</section></div><div class="tp-footer">${action(stale ? '按当前条件重新规划' : '开始路线演练',stale ? 'plan' : 'navigate')}${action('查看演示票夹','wallet','tp-secondary')}</div>`;
  else if (phase === 'issuing') body = `<div class="tp-issuing" role="status" aria-live="polite"><div class="tp-issue-orbit" aria-hidden="true"><i></i><span>层</span><i></i></div><h2>一程，即将成形</h2><p>正在生成本机演示凭证</p><span>没有支付或座位预订正在进行</span></div><div class="tp-footer">${action('返回票务摘要','back','tp-secondary')}</div>`;
  else body = `<div class="tp-content-grid"><section class="tp-itinerary" aria-label="所选行程"><span class="tp-eyebrow">${esc(active.title)}</span>${tripHeader(active)}${segmentList(active,phase === 'summary')}${active.warnings.length ? `<details class="tp-warnings"><summary>路线说明与核验提醒</summary><ul>${active.warnings.map(warning => `<li>${esc(warning)}</li>`).join('')}</ul></details>` : ''}</section>${priceSummary(active)}</div>${boundary(active)}<div class="tp-footer"><div><small>${phase === 'confirm' ? '下一步' : '这是一次安全的旅程演练'}</small><b>${phase === 'confirm' ? '确认分段与模拟参考费用' : '不扣款，不预留，不收集证件'}</b></div>${action(phase === 'confirm' ? '确认行程，查看摘要' : '生成演示凭证',phase === 'confirm' ? 'confirm' : 'issue','tp-primary',stale ? 'disabled' : '')}${phase === 'summary' ? action('修改行程','back','tp-secondary') : ''}</div>`;
  return `<section class="tp-page tp-phase-${esc(phase)}" aria-labelledby="ticket-page-title"><header class="tp-topbar">${action('‹ <span>返回</span>','back','tp-back','aria-label="返回上一页"')}<span>ONE JOURNEY · ONE PASS</span><b>演示专用</b></header><div class="tp-page-inner">${active ? stepper(step) : ''}<div class="tp-heading"><span class="tp-eyebrow">一站式购票 · 体验演示</span><h1 id="ticket-page-title" tabindex="-1" data-ticket-focus>${titles[phase] ?? titles.empty}</h1><p>${descriptions[phase] ?? descriptions.empty}</p></div>${stale && active ? `<div class="tp-alert" role="status"><b>${phase === 'issued' ? '这是当时行程的演示记录' : '出发时间或路线条件已变化'}</b><p>${phase === 'issued' ? '凭证仍可回看；继续演练前，请按当前模拟时刻重新规划。' : '当前摘要已过期，请重新比较路线后再生成凭证。'}</p>${action('重新规划','plan','tp-text-button')}</div>` : ''}${error ? `<p class="tp-alert" role="alert">${esc(error)}</p>` : ''}${body}<footer class="tp-page-note"><span>DEMO</span><p>${TICKET_DISCLOSURE}<br>${esc(storageMessage)}</p></footer></div></section>`;
}

/**
 * getContext(): {departureDate, departureS, trafficRevision, scenarioKey,
 * routeRevision, epochMs}. routeRevision must change on route/endpoint edits.
 * onChange(state) lets the host rerender; call focusTicketPage(host) afterward.
 * Optional storage is used ONLY when rememberOnDevice is explicitly true.
 */
export function createTicketPageController({getContext, onChange, onBack, onPlan, onNavigate,
  storage = null, rememberOnDevice = false, reducedMotion = false, schedule = setTimeout,
  cancelSchedule = clearTimeout, ceremonyMs = 1050} = {}) {
  if (typeof getContext !== 'function') throw new TypeError('Ticket page needs the current global clock and route revision');
  let trip = null, pass = null, phase = 'empty', error = '', passes = [], timer = null, generation = 0, disposed = false;
  let remember = rememberOnDevice === true, storageMessage = '仅在当前页面保存；刷新后不会保留。';
  const current = () => { try { return getContext() ?? {}; } catch { return {}; } };
  const snapshot = () => clone({trip, pass, phase, passes, error, stale: !!(pass?.trip ?? trip) && !isTicketContextCurrent((pass?.trip ?? trip).context, current()), storageMessage});
  const notify = () => { if (!disposed) onChange?.(snapshot()); };
  function load() {
    if (!remember) return;
    if (!storage) { storageMessage = '浏览器存储不可用；凭证仅在当前页面保存。'; return; }
    try {
      const raw = storage.getItem(TICKET_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.version !== VERSION || !Array.isArray(saved.passes) || saved.passes.length > MAX_PASSES || !saved.passes.every(validPass)) throw new Error('Invalid saved passes');
        passes = [...new Map(saved.passes.map(item => [item.id,item])).values()];
      }
      storageMessage = '已启用本机保存；刷新后可从演示票夹回看，不会跨设备同步。';
    } catch { storageMessage = '无法读取本机票夹；当前凭证仍可在本页查看。'; }
  }
  function persist() {
    if (!remember) { storageMessage = '仅在当前页面保存；刷新后不会保留。'; return; }
    try {
      if (!storage) throw new Error('Storage unavailable');
      storage.setItem(TICKET_STORAGE_KEY, JSON.stringify({version:VERSION,passes}));
      storageMessage = '已保存在此浏览器；刷新后可从演示票夹回看，不会跨设备同步。';
    } catch { storageMessage = '浏览器保存失败；凭证仍可在当前页面查看，刷新后可能丢失。'; }
  }
  function cancelCeremony() { generation++; if (timer !== null) cancelSchedule(timer); timer = null; }
  function guard() {
    if (disposed || !trip || !validTrip(trip) || !isTicketContextCurrent(trip.context,current())) {
      error = '出发时间或路线已变化，请重新比较后再试。';
      if (phase === 'issuing') phase = 'summary';
      notify(); return false;
    }
    return true;
  }
  function finish(token) {
    timer = null;
    if (disposed || token !== generation || phase !== 'issuing' || !guard()) return;
    const id = ticketPassId(trip), existing = passes.find(item => item.id === id);
    const epoch = current().epochMs;
    // No Date.now(): issue records read the same global simulation clock.
    if (!existing && !Number.isFinite(epoch)) { phase = 'summary'; error = '模拟时钟尚未准备好，请返回路线后重试。'; notify(); return; }
    pass = existing ?? {version:VERSION,id,demoOnly:true,status:'demo-issued',chargedCents:0,issuedAt:epoch,trip:clone(trip)};
    if (!existing) { passes = [pass,...passes].slice(0,MAX_PASSES); persist(); }
    phase = 'issued'; error = ''; notify();
  }
  load();
  return {
    snapshot,
    render: () => renderTicketPage(snapshot()),
    listPasses: () => clone(passes),
    passListHtml: () => renderTicketPassList(passes,pass?.id),
    open(input) {
      if (disposed) return false;
      cancelCeremony(); pass = null; error = '';
      trip = prepareTicketTrip({...input,context:input?.context ?? current()});
      phase = trip ? 'confirm' : 'empty';
      if (input?.choice && !trip) error = '请先选择一条完整、可演练的路线。';
      notify(); return !!trip;
    },
    openPass(id) {
      if (disposed) return false;
      const found = passes.find(item => item.id === id);
      if (!found) { error = '这张演示凭证不在当前票夹中。'; notify(); return false; }
      cancelCeremony(); pass = clone(found); trip = clone(found.trip); phase = 'issued'; error = ''; notify(); return true;
    },
    showWallet() {
      if (disposed) return false;
      cancelCeremony(); trip = null; pass = null; phase = 'empty'; error = ''; notify(); return true;
    },
    handleAction(name, id) {
      if (disposed) return false;
      if (name === 'open-pass') return this.openPass(id);
      if (name === 'wallet') return this.showWallet();
      if (name === 'plan') { this.suspend(); onPlan?.(); return true; }
      if (name === 'back') {
        if (phase === 'issuing') { cancelCeremony(); phase = 'summary'; error = ''; notify(); }
        else if (phase === 'summary') { phase = 'confirm'; error = ''; notify(); }
        else { this.suspend(); onBack?.(); }
        return true;
      }
      if (name === 'confirm') { if (phase === 'confirm' && guard()) { phase = 'summary'; error = ''; notify(); } return true; }
      if (name === 'issue') {
        if (phase !== 'summary' || !guard()) return true;
        const existing = passes.find(item => item.id === ticketPassId(trip));
        if (existing) return this.openPass(existing.id);
        phase = 'issuing'; error = ''; const token = ++generation; notify();
        // onChange can synchronously close the page; never schedule that old view.
        if (disposed || token !== generation || phase !== 'issuing') return true;
        const reduce = typeof reducedMotion === 'function' ? reducedMotion() : reducedMotion;
        timer = schedule(() => finish(token), reduce ? 0 : Math.max(0,Math.min(3000,ceremonyMs)));
        return true;
      }
      if (name === 'navigate') { if (phase === 'issued' && pass && guard()) onNavigate?.(clone(pass)); return true; }
      return false;
    },
    suspend() { cancelCeremony(); if (phase === 'issuing') phase = 'summary'; },
    setPersistence(enabled) {
      if (disposed) return;
      const next = enabled === true;
      if (next === remember) return;
      remember = next;
      if (!remember) {
        try { storage?.removeItem(TICKET_STORAGE_KEY); storageMessage = '仅在当前页面保存；刷新后不会保留。'; }
        catch { storageMessage = '停止保存，但旧票夹未能从浏览器删除；请在浏览器设置中清理。'; }
      } else persist();
      notify();
    },
    clear() {
      if (disposed) return;
      cancelCeremony(); trip = null; pass = null; passes = []; phase = 'empty'; error = '';
      try { storage?.removeItem(TICKET_STORAGE_KEY); }
      catch { error = '无法删除浏览器中的旧票夹；请在浏览器设置中清理。'; }
      storageMessage = '当前票夹已清空。'; notify();
    },
    dispose() { cancelCeremony(); disposed = true; },
  };
}

/** Call only on entering a page/step, not on every background app redraw. */
export function focusTicketPage(host) {
  const heading = host?.querySelector?.('[data-ticket-focus]');
  heading?.focus?.({preventScroll:true});
  const scroller = host?.closest?.('.na-sheet') ?? host;
  scroller?.scrollTo?.({top:0,behavior:'instant'});
}
