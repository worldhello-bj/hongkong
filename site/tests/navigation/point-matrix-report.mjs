/** Offline human-readable report. Requires matching aggregate and price outputs. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {readJSON,digest} from './point-matrix-fixture.mjs';
const dirArg=process.argv.find(x=>x.startsWith('--directory='))?.slice(12);if(!dirArg)throw Error('--directory=<runtime report directory> required');
const dir=resolve(dirArg),summary=readJSON(resolve(dir,'matrix-summary.json')),prices=readJSON(resolve(dir,'price-sensitivity.json'));
if(summary.runtime.signature!==prices.runtime.signature)throw Error('Aggregate and price runtimes differ');
const observed=summary.rows.filter(r=>r.report),raw=new Map(observed.map(r=>[r.id,readJSON(resolve(dir,r.report))])),priced=new Map(prices.rows.map(r=>[r.file.replace(/\.json$/,''),r]));
for(const row of observed){const p=priced.get(row.id);if(!p||p.sha256!==digest(readFileSync(resolve(dir,row.report))))throw Error('Price observation mismatch: '+row.id);}
const cands=[...raw.values()].flatMap(r=>r.candidates),sec=n=>Number.isFinite(n)?(n/1000).toFixed(3):'—',num=n=>Number.isFinite(n)?Number(n.toFixed(4)):'—',money=n=>Number.isFinite(n)?n.toFixed(2):'—';
const lines=[`# 香港点位实测：${summary.runtime.version}`,'',`Runtime signature: \`${summary.runtime.signature}\`。Fixture: \`${summary.fixtureSha256}\`。`, '',
`固定六组真实/固定种子 OD × 五偏好 × 出租车开关，共 ${summary.expectedCells} 格；已观察 ${summary.observedCells} 格，${summary.completedComparisonCells} 格到真实完整比较终态，${summary.completedAndAuditedCells} 格有完整可用候选并通过审计。`, '',
`本版保留 ${cands.length} 个完整候选、${cands.reduce((n,c)=>n+c.fare.legs.length,0)} 个逐段收费记录。分类：${Object.entries(summary.classificationCounts).map(([k,n])=>`${k}=${n}`).join('；')}。`, '',
'## 时间分布','', '| 范围 | N | 最小秒 | 中位秒 | P90秒 | P95秒 | 最大秒 |','| --- | ---: | ---: | ---: | ---: | ---: | ---: |'];
for(const [label,s] of [['首个完整可用结果',summary.firstResult],['完整候选比较',summary.fullCandidateComparison]])lines.push(`| ${label} | ${s.count} | ${sec(s.minMs)} | ${sec(s.medianMs)} | ${sec(s.p90Ms)} | ${sec(s.p95Ms)} | ${sec(s.maxMs)} |`);
lines.push('', '分位数用 nearest-rank。单次新进程 Node S1/真实 Worker 观察，数据加载完后开始计路由；不是浏览器绘制、手机性能或重复抽样置信区间。观察窗为60秒；pending/error无完整比较时长。接近60秒的个别成功不保证稳定低于60秒。','',
'## 每格结果与默认权重赢家','', '价格权重0.75，其余为生产 time-priority 默认值。分项顺序为时间/价格/步行/等待/换乘/设施；行李原生搬运优先排序保留。各行链接到不可覆盖的原始观察。所有费用均为生产模型示意报价。','',
'| 单元 | 分类 | 首/完整秒 | 可用数 | 默认赢家 | 模型HK$ | 分项贡献 = 总分 |','| --- | --- | ---: | ---: | --- | ---: | --- |');
for(const row of observed){const p=priced.get(row.id),s=p.samples.find(s=>s.priceWeight===.75),winner=s.ranked[0],terms=winner?.contributions;lines.push(`| [${row.id}](${row.report}) | ${row.classification.replace('completed-with-candidates','可用/通过').replace('completed-without-candidate-needs-diagnosis',row.need==='accessible'?'完整比较/严格负结果':'完整比较/无候选待诊断')} | ${sec(row.firstResultMs)}/${sec(row.fullCandidateWallMs)} | ${row.candidates.length} | ${winner?.id??'—'} | ${money(winner?.metrics.cost)} | ${terms?['minutes','cost','walkMinutes','waitMinutes','transfers','facilities'].map(k=>num(terms[k])).join(' + ')+' = '+num(winner.score):'—'} |`);}
lines.push('','## 逐段费用','', '以下为默认赢家的每个生产定价分段；所有完整候选的全部逐段报价另存 [price-sensitivity.json](price-sensitivity.json) 的 candidateFares，原报告也保留不可用情景报价、incompleteReason及endpointAccess。未核验精确端点的出租车报价不进入完整导航排名。','', '| 单元 | 赢家 | 分段HK$ | 合计HK$ |','| --- | --- | --- | ---: |');
for(const row of observed){const p=priced.get(row.id),winner=p.samples.find(s=>s.priceWeight===.75).winner,fare=p.candidateFares.find(c=>c.id===winner)?.fare;if(fare)lines.push(`| ${row.id} | ${winner} | ${fare.legs.map(l=>`${l.index+1}.${l.mode} ${money(l.amountCents/100)}`).join(' + ')} | ${money(fare.totalCents/100)} |`);}
const changes=prices.rows.filter(r=>r.winnerChanges);lines.push('','## 价格敏感性','', `价格权重0、0.25、0.75、1.5、3；${changes.length} 格首选改变，其余已观察格首选在该五点扫描中不变。仅完整可用且通过审计的候选参加；没有强求出租车接驳胜出。所有候选每个权重的指标/分项贡献在 [price-sensitivity.json](price-sensitivity.json)。`, '', '| 单元 | 0 | 0.25 | 0.75 | 1.5 | 3 |','| --- | --- | --- | --- | --- | --- |');
for(const r of changes)lines.push(`| ${r.file.replace(/\.json$/,'')} | ${r.samples.map(s=>s.winner??'—').join(' | ')} |`);
lines.push('','## 严格负结果的解释','',
'- 出口过海及站点/固定种子过海：严格公共登乘与接入证据不足，且无对应跨海步行方案。HUH站内真实严格来源连通已另行证实，不能把本负结果写成该升降机或整座车站不可达。',
'- 九龍C1及岛内地图点：原报告明确首末无障碍接入未核验，公共登乘也未核验。普通出租车不因开关开启而满足严格轮椅条件，这是模式/证据政策。',
'- 太古LG1→L4：11时开放规则允许进入，但当前来源层缺通往L4的严格合格连接；全域比较未提供完整方案。源层缺证据不等于现实设施不可达。',
'- 不可用原因原文保存在每格unavailable；以上解释不把算法错误、超时或OOM归为来源限制。旧端点降级与区域身份错误均单独保留历史证据。');
const floorFile=resolve(dir,'source-floors-clock-aware.json');if(existsSync(floorFile)){const f=readJSON(floorFile);if(f.runtime.signature!==summary.runtime.signature)throw Error('Source-floor runtime differs');lines.push('','## 独立来源楼层层','',`同runtime：${f.rows.length} 格（5真实楼层×5偏好×08/11时×2方向），${f.rows.filter(r=>r.complete).length} 条来源路线，${f.rows.filter(r=>!r.complete).length} 个不可用结果；${f.rows.filter(r=>Object.values(r.checks).some(x=>!x)).length} 个断言失败。仅${f.plan.graph.physicalEdges}个物理边/${f.plan.graph.nodes}节点，不计入上述60格。`, '', '11时42/50返回路线：四种非严格偏好覆盖所有楼层双向，严格仅LG1可连F。08时21/50明确在外等到开放后进入；25个闭店楼层内出发被拒，另4个严格上层到达缺合格连接。完整时刻/楼层/边证据见 [source-floors-clock-aware.json](source-floors-clock-aware.json)。');}
lines.push('','## 复现与边界','',
'- 使用固定fixture内原node/XYZ/floor、2026-10-12香港11时与原seed20261011；非路线成功筛选。',
'- 精确端点、同层真实portal、相邻几何、完整源严格predicate、已知关闭/设施限制、全部生产逐段费用、真实取消和无迟发候选均在原报告中审计。',
'- 车行站位投影、跨海铁路示意、未知接入和设施状态分别保留，不因图形连续而变成官方实体通道。',
'- 六组OD是分层诊断覆盖，不能推出香港全域可达、实时开放或官方票价正确。没有浏览器视觉验收结论。',
'- 本报告只属于标题runtime；后续构建的定向补验须另列，不能继承本版60格覆盖。','');
writeFileSync(resolve(dir,'REPORT.md'),lines.join('\n'));console.log(JSON.stringify({out:resolve(dir,'REPORT.md'),observed:observed.length,candidates:cands.length,priceSwitches:changes.length}));
