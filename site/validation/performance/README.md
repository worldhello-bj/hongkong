# 香港导航性能取证：基线 6e52ec3d2521 / 生产复测 5274ca0d14f4

初始取证范围：仅新增性能探针及输出；A/B/C/D 实验没有直接更改生产 src/dist/build 或原有测试。下方另列最终已采用的生产改动及同输入复测。所有实验使用冻结运行时副本，真实 S1 点击入口、真实生产 Worker 算法和相同随机陆地 OD。每次仍观察 60 秒；超时只表示 pending，不表示 NO_ROUTE。

## 先看结论

1. **已验证调度问题**：OD7 luggage 的详细纯步行占住唯一重型队列，阻塞出租车后续比较。单独将 walk 排在 public+taxi 工作之后（B）使出租车阶段由 60 秒未结束变为 24.86 秒完成，候选由 3 个增至 5 个，未移走端点或删掉 walk。详细 walk 本身仍 pending。
2. **OD36 的问题不同**：public/taxi 图 owner 交替、重复初始化、时刻相关公共子查询是主要长尾；B 下仍未全部完成。不能将 B 宣称为全域性能修复。
3. **Worker 重建可测**：A-OD36 创建 7 个 Worker；主线程发送克隆累计约 6.67 秒，Worker graph-prepare 累计 11.68 秒（包含内部 validate，不能再加上 validate 时间）。A-OD7 创建 4 个 Worker，克隆累计约 3.48 秒，prepare 累计约 6.09 秒。
4. **g2 有缓存**：A-OD7 首次 g2 约 1.603 秒，其后 3 次总计约 0.057 毫秒，不能当成每次重新合图。main F1 merge 同样主要是首次约 0.956 秒。
5. **不是面板字符串渲染主导**：A 中 x+n1 各样本总计不到 0.4 秒。主线程最大事件循环阻塞约 4.05/5.13 秒，主要风险在图处理/发送克隆；这是 Node JS 证据，不是浏览器布局/绘制验收。
6. **FIFO 死工作不足以独立解决问题**：C 仅把没有结果用途的祖先环扫描包进 !hkFifoWaiting。OD7 的详细 walk 在探针 384 MiB Worker 堆限制下发生 OOM；OD36 仍 pending。C 开启了 CPU 采样，不能拿 C/A 的绝对耗时作严格速度比较；OOM 和待完成状态本身可复核。

## 13 格未完的正确解释

原 validation/preference-matrix/summary.json 的 30 格中，17 格完全结束；6 格 accessible 在纯公共比较已可用时由原 harness 提前停止；只有 OD7 的 luggage/escalator/lift 与 OD36 的 ordinary/luggage/escalator/lift 共 7 格达到 60 秒。此次详细取证是两格代表样本，未冒充对另外 11 格的完整终态测量。

## 详细 walk 内存膨胀的实测计数

search-states-6e52ec3d2521-od7-luggage 使用原算法/原调度、不开 CPU 采样，仅每 1,024 次出队记录一次计数。该详细 walk 实际 timed=true、fifo=true。截止前最后一次采样：

- 出队 217,088；累计 label 分配 218,301
- W 状态记录 218,302；前驱记录 218,301
- 基础状态 22,740；单基础状态累计最多 56 个 label
- 失效 label 集合 10,916；队列峰值仅 1,542
- 当前 Worker heapUsed 350,576,192 bytes（约 334.3 MiB）
- 此查询 tie 最长 15 字符、label key 最长 51 字符

因此不是单纯优先队列过大或整条路径字符串不断拷贝。状态/前驱累计存留及多目标 label 数量才是明确方向；失效集合约占已分配 label 的 5%，单纯清它也不是完整解决方案。不要未经证明把带设施成本与等待语义的 Pareto frontier 强行压成单 label。

## A / B / C 结果

| 实验 | OD / 偏好 | 公共最快阶段 | 出租车阶段 | 60 秒状态 | Worker | 峰 RSS GiB | 可用候选 |
|---|---|---:|---:|---|---:|---:|---:|
| A 原调度 | 7 luggage | 10.30s | pending | detailed walk 阻塞队列 | 4 | 1.311 | 3 |
| B 仅推后 walk | 7 luggage | 9.69s | 24.86s | detailed walk pending | 4 | 1.274 | 5 |
| C 仅 FIFO 祖先扫描保护 | 7 luggage | 12.60s | pending | walk OOM，其他继续 | 5 | 1.220 | 3 |
| A 原调度 | 36 ordinary | 8.09s，待细化 | pending | public/taxi pending | 7 | 1.467 | 2 |
| B 仅推后 walk | 36 ordinary | 8.73s，待细化 | pending | public/taxi pending | 8 | 1.478 | 2 |
| C 仅 FIFO 祖先扫描保护 | 36 ordinary | 15.47s，待细化 | pending | public/taxi pending | 8 | 1.484 | 2 |
| D = B + 共享基础 owner | 36 ordinary | 8.14s，待细化 | pending | detailed transit 阻塞 taxi | 7 | 1.582 | 2 |

单次测量存在主机调度/GC噪声；A/B 使用相同无 CPU 采样方式，C 加入 CPU 采样。以上不是 p95 或稳定加速比。

B-OD7 新增：出租车首程+电车 59 分钟/HK$43.69；公共末段接出租车 66 分钟/HK$41.28。已返回候选均保持用户原坐标，没有已知关闭/禁用边，行李出租车均保留车辆确认要求。尚未返回候选不能据此判定安全或不存在。

## D 共享基础 owner 结果与额外生命周期问题

D 在 B 上单独共享 fastPublicRouter/taxiRouter，按要求取消 publicWork 与 guardedDemoWork 对共享 owner 的无条件 dispose；非共享出租车 router 才在 n3 finally 释放，最终 S1 的统一释放保留。

- OD36 的 Worker 初始化 8→7，graph-prepare 累计 12.90→10.43 秒；首个基础 Worker 连续完成 public+taxi 两请求
- 返回的出租车直达 31 分钟/HK$140.25、公共模拟方案 151 分钟/HK$16.56 完全保持；端点及已知边检查均通过
- 60 秒内详细 transit 仍占用队列，taxi仍等待；峰 RSS 1.478→1.582 GiB，不支持宣称整体内存改善
- 该改动减少一次初始化，但不足以解决 OD36；完整过程尚未终态，不能当作全量正确性验收

另发现 metro Worker 释放盲点：metro-planning-CBAOotPX.js 的 WeakMap C 缓存完成后没有 dispose 接口。u2 请求回调清理 signal abort listener，完成后的空闲 Worker 也不在 E2/activeWalkWorkers 的释放集合中。A-OD36 的 metro Worker 从进程 21.13 秒创建，26.82 秒响应后一直保留，直到探针 64.36 秒强制清理才退出。建议为 metro 单独实现可验证的空闲释放；目前没有测量它的精确独立堆大小，不能凭总 RSS 反推。

## 重建和重复子查询

- 原 harness 在 publicDataPromise 后立即点击；block 图晚到会触发 u1()+S1() 自动重规划。两个 A 样本均有首个 Worker 被废弃重来。此成本要与 owner 切换区分，也应再测细图加载完后的 warm 路径。
- A-OD7：约进程 25.73 秒进入 D2，约 27.88 秒详细 walk-query 开始，一直占用到 60 秒路由观察结束。图规模 65,304 节点/144,603 边。
- A-OD36：1,532 次底层 walk 子查询；去时刻后的空间键约 42 个。同一 Worker 内、相同图描述和完整请求的重复启动数为 **0**。
- 不同 departureS 是合法时变请求，不能一律合并。跨 Worker 相同 version/节点数也不证明相同语义，特别是官方图与 demo_connector_geography 图必须隔离。原始 summary 的跨 Worker exact key 数只作线索。
- B-OD7 同一个 taxi Worker 连续服务 6 个公共子查询，避免了 walk 抢占与中途销毁其缓存。

## 最小可验证优化建议

1. 先单独采用 B 的排程，将 runBounded([publicWork,taxiWork],2) 完成后再 await walkWork()。保留取消、stale 检查、步行候选及全部原约束。验证公共/出租车及时完成和后续 walk 正常结束/报错显示。
2. D 已验证可少建一次 Worker、尚未解决终态：共享输入完全相同的 fastPublicRouter 与 taxiRouter 基础图 owner，不能仅替换对象后保留 publicWork 的无条件 dispose；需要让队列生命周期拥有销毁，避免误杀正在运行的共享请求。不要无界保留多个大索引。
3. 详细步行优先排查 accepted-label/前驱/无效label生命周期。tie 只有首末接入标识，状态键是节点/轨道标记/升降机乘坐状态/label编号，没有每条边复制整段路径。每个被替代 label 仍保留在状态及前驱 Map 中，必须通过安全的引用计数或可达性回收验证，不能随意删除可能被后继引用的前驱。
4. C 的 FIFO 祖先检查移位是语义保持的局部优化候选，需要 FIFO、非 FIFO、opening-wait、偏好启发式 oracle 验证；它不是状态膨胀的完整修复。
5. 后续可研究具有可证明下界的出租车 Pareto 剪枝；不得用经验阈值或设施偏好奖励截断。当前未实现/未测试。

## 重现

从项目根目录运行：

```sh
HK_MATRIX_OD=7 HK_NEED=luggage HK_PROFILE_LABEL=baseline node tests/navigation/profile-navigation.mjs
HK_MATRIX_OD=7 HK_NEED=luggage HK_PROFILE_LABEL=defer-walk HK_PROFILE_VARIANT=defer-walk node tests/navigation/profile-navigation.mjs
HK_MATRIX_OD=7 HK_NEED=luggage HK_PROFILE_LABEL=fifo-guard HK_PROFILE_VARIANT=fifo-guard HK_PROFILE_CPU=1 node tests/navigation/profile-navigation.mjs
HK_MATRIX_OD=36 HK_NEED=ordinary HK_PROFILE_RUNTIME=6e52ec3d2521 HK_PROFILE_LABEL=shared-base HK_PROFILE_VARIANT=shared-base node tests/navigation/profile-navigation.mjs
HK_MATRIX_OD=7 HK_NEED=luggage HK_PROFILE_LABEL=search-states HK_PROFILE_SEARCH_STATS=1 node tests/navigation/profile-navigation.mjs
node tests/navigation/profile-summarize.mjs validation/performance/<对应运行目录>
```

将 OD=36、NEED=ordinary 可重现另一格。每个目录含 report.json、events.ndjson、summary.json、实际 instrumented 入口与 Worker；C 还有 CPU profiles。V8 导出中的无效 RegExp JSON 转义已在可读 cpuprofile 中规范化，原样保存在 .cpuprofile.raw。

共享 runtime-6e52ec3d2521 快照仅一份约 56 MB，其余实验不复制图数据。它用于固定生产资源，切勿拿实验 instrumented 文件覆盖生产。发布后的新版本应新建 runtime 快照，用同一输入与环境重复测量。

## 限制

- 不是真实浏览器视觉验收；DOM stand-in 不执行布局/绘制，不证明用户操作视觉结果。
- 只测两格代表样本；没有完整跑完全部 30 格，更没有以延长超时替代优化。
- 60 秒是观测窗口，生产搜索未加该终止条件；探针截止后仅为结束实验执行取消。
- 384 MiB 是原 harness 的 Node Worker old-generation 限制，OOM 不能直接等同所有浏览器都会在同一时刻失败。
- event 时间覆盖冷启动及一次自动重规划；routePerformance 阶段时长包含自身排队，不能直接相加为 CPU 时间。

## E 数字 label ID 候选：未执行

静态检查看到 Map/Set、comparable 与前驱重建支持数字 ID，JSON.parse 前也经过 Me/V 恢复 baseState。但是优先队列 Te.less/lt.less 在 access/cost/tie 相等时仍比较 e.id/n.id：原实现是含节点/rail/ride/编号的 JSON 字典序，替换成整数会改变等成本状态排序、可能改变选择及探索量。因此没有将 E 当作语义严格等价的一行内存优化执行，也没有扩大成新的 tie-break 算法。纯内存归因需要保留原排序语义并独立 oracle 验证。


## Repository packaging

The frozen runtime copies, instrumented modules, raw event streams, CPU profiles and verbose per-run summaries are reproducible local outputs excluded from Git. The source probes, per-run report.json, this report and comparison.json remain versioned. Do not copy duplicate 56 MB runtime assets into the public PR.

## 最终生产复测：5274ca0d14f4

生产仅采用 B 的详细步行后置，以及空闲 metro Worker 可验证释放。共享 owner、FIFO 祖先扫描、数字 label 实验未采用；没有缩短搜索预算、减少设施硬约束或把超时当成无路。

| 同一输入 | 公共阶段 | 出租车比较阶段 | 峰 RSS | 60 秒时剩余 |
|---|---:|---:|---:|---|
| OD7 luggage | 11.24s ready | 27.66s ready，5 候选 | 1.305 GiB | 详细纯步行 pending |
| OD36 ordinary | 9.38s 待站内细化 | pending | 1.230 GiB | 详细公共/接驳仍未全部完成 |

OD7 从基线 60 秒仍缺两条接驳，变为 27.66 秒已显示完整公共与出租车比较；实际行程分钟/票价与 B 实验候选保持一致。OD36 的 metro Worker 在进程 33.18 秒创建、39.78 秒退出，确实在下一 owner 使用重型索引时释放，不再一直留至观测结束。OD36 峰值较基线 1.467 GiB 低约 16%，但只有单次同输入测量，不能宣称稳定 p95 或全域已优化。

两个样本所有已返回候选端点保持、禁用边检查通过，行李出租车保留车辆确认；未返回候选不能据此判定。Node DOM stand-in 仍不证明浏览器绘制性能。详细步行的 Pareto label/前驱累计和 OD36 的跨 owner 索引重建仍为已知未解决问题。

复测原始概要：production-final-5274ca0d14f4-od7-luggage/report.json、production-final-5274ca0d14f4-od36-ordinary/report.json。

## OD36 follow-up after live v38 (2026-10-12)

The earlier Pareto/ancestor-scan hypothesis above is **not supported by the new production attribution** and is not the basis of this change. The current baseline is the exact live runtime `d701fed258cc`, rather than the older `5274` experiment. Same fixed OD36, ordinary preference, simulated departure/date, production S1 and real Worker bundles run under a Node DOM stand-in. This does not measure browser painting or real journeys.

1. Owner-group scheduling (`841fca7dce88`) preserves base-graph inputs and runs all taxi-dependent base queries before another graph owner evicts the Worker. Eight Workers become five; initial public and taxi comparisons complete earlier. Demo and detailed official graphs remain separate. Every original refinement still runs, cancellation prevents later phases, and there is no production search cutoff.
2. Frozen-graph timing metadata is cached only for prepared immutable graphs and their existing preference index. Origin/destination schedules and departure/date remain per-query inputs. The measured temporal preparation scan was repeated unnecessarily; no facility/waiting rule is removed.
3. Reverse lower-bound keys, Float64 values, traversal order and admissibility remain unchanged. A shared node index plus Float64 arrays and a presence bitmap retain missing values, NaN, infinities and signed zero exactly; query-only synthetic nodes retain a Map. Retention is bounded. Array budget is explicitly not a whole-heap budget: shared node-index and synthetic-map overhead are additional. The prior eight large Maps were repeatedly discarded during transit refinement.

The default FIFO ancestor guard and numeric-label experiment are **not enabled**. Cache storage and scheduling have paired original-engine oracle tests, including 720 seeded route queries and 111 successful scheduled routes across more than eight endpoint keys, reverse-order reuse and eviction. The route outputs are compared deeply, not only by arrival time. Cache unit tests also cover budget, owner isolation, missing values and precise numeric representation.

Results and the latest measured budget are recorded in the matching `od36-current-*` directories. The original 60-second observation is retained separately from an optional same-process 120-second follow-through. Pending does not mean NO_ROUTE. More searches completed inside a fixed window can increase state counts; compare the reached phases before treating this as a regression. A completed taxi comparison does not imply all detailed public or walking refinements have finished.
