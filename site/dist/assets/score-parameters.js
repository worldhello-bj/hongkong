import {JOURNEY_WEIGHTS,journeyScore,validatedJourneyWeights} from './journey-score.js?v=616dc1f931e4';
export const SCORE_PARAMETER_FIELDS=Object.freeze([
 {key:'minutes',label:'全程时间',unit:'综合分钟 / 分钟',max:10,step:.05},
 {key:'cost',label:'价格',unit:'综合分钟 / HK$',max:10,step:.05},
 {key:'walkMinutes',label:'额外步行负担',unit:'综合分钟 / 步行分钟',max:10,step:.05},
 {key:'waitMinutes',label:'额外候车负担',unit:'综合分钟 / 候车分钟',max:10,step:.05},
 {key:'transfers',label:'换乘负担',unit:'综合分钟 / 次',max:60,step:.5}
]);
export function scoreParameters(saved,priority='time'){
 try{return validatedJourneyWeights(priority,saved?.[priority]??{});}catch{return {...(JOURNEY_WEIGHTS[priority]??JOURNEY_WEIGHTS.time)};}
}
export function updateScoreParameter(saved,priority,key,value){
 if(!JOURNEY_WEIGHTS[priority]||!SCORE_PARAMETER_FIELDS.some(field=>field.key===key))throw new Error('未知评分参数');
 if(typeof value==='string'&&!value.trim())throw new Error('参数不能为空');
 const next=validatedJourneyWeights(priority,{...scoreParameters(saved,priority),[key]:Number(value)});
 return {...saved,[priority]:next};
}
export function resetScoreParameters(saved,priority){const next={...saved};delete next[priority];return next;}
export function scoreParameterPanel({choices=[],priority='time',need='ordinary',saved,escape=String,remember=false,open=false}){
 const weights=scoreParameters(saved,priority),e=escape;
 const fields=SCORE_PARAMETER_FIELDS.map(field=>`<label>${field.label}<input data-score-weight="${field.key}" type="number" inputmode="decimal" min="0" max="${field.max}" step="${field.step}" value="${weights[field.key]}" aria-label="${field.label}权重"><small>${field.unit}</small></label>`).join('');
 const rows=choices.filter(c=>c.available).map(choice=>{
  const score=journeyScore(choice,priority,need,weights),term=score.terms,number=v=>Number.isFinite(v)?v.toFixed(1):'待估';
  return `<li><b>${e(choice.title??choice.id)}</b><span>综合 ${number(score.total)} 分钟</span><small>时间 ${number(term.minutes)} + 价格 ${number(term.cost)} + 步行 ${number(term.walkMinutes)} + 候车 ${number(term.waitMinutes)} + 换乘 ${number(term.transfers)} + 设施偏好 ${number(term.facilities)}</small>${choice.result?.luggageCarryRequired?'<small>需搬运行李备选：优先级低于无搬运方案，开始前须确认。</small>':''}</li>`;
 }).join('');
 return `<details class="na-evaluation na-score-parameters" data-app="score-parameters" ${open?'open':''}><summary>规划公式与权重 · ${e(weights.label)}</summary><p>综合分钟 = 全程分钟 × ${weights.minutes} + 港元 × ${weights.cost} + 步行分钟 × ${weights.walkMinutes} + 候车分钟 × ${weights.waitMinutes} + 换乘次数 × ${weights.transfers} + 设施偏好负担。</p><p class="na-note">全程时间已包含步行、候车；后两项是额外体验惩罚，不再增加实际行程时间，也不重复收费。设施偏好按当前出行需求固定计算；关闭设施、明确通行限制和端点约束不受权重调整影响；未知设施能力不计为已核验可用。</p><div class="na-weight-grid">${fields}</div><button class="na-secondary" data-action="reset-score-weights">恢复当前方案默认值</button><p class="na-note">参数调整立即重新计算已有候选的评分与排序，不重跑路网。后续算出的候选也使用新参数。${remember?'随本机偏好保存，可在“我的”中清除。':'仅本次页面有效；开启“记住本机”才会保存。'}至少一项权重大于 0。</p>${rows?`<ol class="na-score-breakdown">${rows}</ol>`:'<p class="na-note">选择起终点后可查看每条路线的分项贡献。</p>'}<p class="na-note">权重与票价均为演示假设，不是官方报价或用户研究。出租车各段独立计算起步费；跨海附加 HK$25 是模拟参数。仅覆盖已载入网络，不能据此宣称香港全网最优。</p></details>`;
}
