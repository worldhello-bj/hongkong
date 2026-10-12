# 香港点位实测：b702b6920092

Runtime signature: `f32dfcc1a1ba60f3987b03f198560960bd23364aeb86d8600395d1ea86313fc3`。Fixture: `791197c289bf10787b0104c3d1fc5ba70ec030f305507cc56b924be744588b0e`。

固定六组真实/固定种子 OD × 五偏好 × 出租车开关，共 60 格；已观察 60 格，60 格到真实完整比较终态，48 格有完整可用候选并通过审计。

本版保留 84 个完整候选、292 个逐段收费记录。分类：completed-with-candidates=48；completed-without-candidate-needs-diagnosis=12。

## 时间分布

| 范围 | N | 最小秒 | 中位秒 | P90秒 | P95秒 | 最大秒 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 首个完整可用结果 | 48 | 2.592 | 7.951 | 27.948 | 28.308 | 33.005 |
| 完整候选比较 | 60 | 7.978 | 20.219 | 39.565 | 48.966 | 59.783 |

分位数用 nearest-rank。单次新进程 Node S1/真实 Worker 观察，数据加载完后开始计路由；不是浏览器绘制、手机性能或重复抽样置信区间。观察窗为60秒；pending/error无完整比较时长。接近60秒的个别成功不保证稳定低于60秒。

## 每格结果与默认权重赢家

价格权重0.75，其余为生产 time-priority 默认值。分项顺序为时间/价格/步行/等待/换乘/设施；行李原生搬运优先排序保留。各行链接到不可覆盖的原始观察。所有费用均为生产模型示意报价。

| 单元 | 分类 | 首/完整秒 | 可用数 | 默认赢家 | 模型HK$ | 分项贡献 = 总分 |
| --- | --- | ---: | ---: | --- | ---: | --- |
| [exits-cross-ordinary-taxi-off](exits-cross-ordinary-taxi-off.json) | 可用/通过 | 5.717/7.978 | 1 | transit | 7.87 | 24 + 5.9025 + 5.6 + 0.5 + 0 + 0 = 36.0025 |
| [exits-cross-ordinary-taxi-on](exits-cross-ordinary-taxi-on.json) | 可用/通过 | 6.649/15.522 | 1 | transit | 7.87 | 24 + 5.9025 + 5.6 + 0.5 + 0 + 0 = 36.0025 |
| [exits-cross-luggage-taxi-off](exits-cross-luggage-taxi-off.json) | 可用/通过 | 9.349/11.758 | 1 | transit | 7.87 | 31 + 5.9025 + 7.7 + 1.5 + 0 + 13.5308 = 59.6333 |
| [exits-cross-luggage-taxi-on](exits-cross-luggage-taxi-on.json) | 可用/通过 | 10.004/19.459 | 1 | transit | 7.87 | 31 + 5.9025 + 7.7 + 1.5 + 0 + 13.5308 = 59.6333 |
| [exits-cross-escalator-taxi-off](exits-cross-escalator-taxi-off.json) | 可用/通过 | 11.442/14.332 | 1 | transit | 7.87 | 24 + 5.9025 + 5.6 + 0.5 + 0 + 2.9392 = 38.9417 |
| [exits-cross-escalator-taxi-on](exits-cross-escalator-taxi-on.json) | 可用/通过 | 9.141/16.594 | 1 | transit | 7.87 | 24 + 5.9025 + 5.6 + 0.5 + 0 + 2.9392 = 38.9417 |
| [exits-cross-lift-taxi-off](exits-cross-lift-taxi-off.json) | 可用/通过 | 10.138/12.452 | 1 | transit | 7.87 | 24 + 5.9025 + 5.95 + 0.5 + 0 + 5.2771 = 41.6296 |
| [exits-cross-lift-taxi-on](exits-cross-lift-taxi-on.json) | 可用/通过 | 9.879/37.744 | 1 | transit | 7.87 | 24 + 5.9025 + 5.95 + 0.5 + 0 + 5.2771 = 41.6296 |
| [exits-cross-accessible-taxi-off](exits-cross-accessible-taxi-off.json) | 完整比较/严格负结果 | —/49.002 | 0 | — | — | — |
| [exits-cross-accessible-taxi-on](exits-cross-accessible-taxi-on.json) | 完整比较/严格负结果 | —/47.903 | 0 | — | — | — |
| [stops-cross-ordinary-taxi-off](stops-cross-ordinary-taxi-off.json) | 可用/通过 | 6.790/9.026 | 1 | transit | 13.57 | 57 + 10.1775 + 5.6 + 11.5 + 3 + 0 = 87.2775 |
| [stops-cross-ordinary-taxi-on](stops-cross-ordinary-taxi-on.json) | 可用/通过 | 2.674/13.206 | 4 | transit | 13.57 | 57 + 10.1775 + 5.6 + 11.5 + 3 + 0 = 87.2775 |
| [stops-cross-luggage-taxi-off](stops-cross-luggage-taxi-off.json) | 可用/通过 | 7.797/9.955 | 1 | transit | 13.57 | 60 + 10.1775 + 6.65 + 11.5 + 3 + 20.2156 = 111.5431 |
| [stops-cross-luggage-taxi-on](stops-cross-luggage-taxi-on.json) | 可用/通过 | 2.592/16.142 | 4 | taxi-direct | 95.23 | 18 + 71.4225 + 0.35 + 1.9586 + 0 + 0.5558 = 92.2869 |
| [stops-cross-escalator-taxi-off](stops-cross-escalator-taxi-off.json) | 可用/通过 | 8.095/10.467 | 1 | transit | 13.57 | 57 + 10.1775 + 5.6 + 11.5 + 3 + 1.2146 = 88.4921 |
| [stops-cross-escalator-taxi-on](stops-cross-escalator-taxi-on.json) | 可用/通过 | 3.068/14.804 | 4 | transit | 13.57 | 57 + 10.1775 + 5.6 + 11.5 + 3 + 1.2146 = 88.4921 |
| [stops-cross-lift-taxi-off](stops-cross-lift-taxi-off.json) | 可用/通过 | 10.004/11.893 | 1 | transit | 13.57 | 57 + 10.1775 + 5.6 + 11.5 + 3 + 4.4706 = 91.7481 |
| [stops-cross-lift-taxi-on](stops-cross-lift-taxi-on.json) | 可用/通过 | 2.680/16.049 | 4 | taxi-direct | 95.23 | 18 + 71.4225 + 0.35 + 1.9586 + 0 + 0 = 91.7311 |
| [stops-cross-accessible-taxi-off](stops-cross-accessible-taxi-off.json) | 完整比较/严格负结果 | —/23.391 | 0 | — | — | — |
| [stops-cross-accessible-taxi-on](stops-cross-accessible-taxi-on.json) | 完整比较/严格负结果 | —/29.608 | 0 | — | — | — |
| [mall-floors-ordinary-taxi-off](mall-floors-ordinary-taxi-off.json) | 可用/通过 | 26.080/30.776 | 1 | transit-detailed | 0.00 | 5 + 0 + 1.75 + 0 + 0 + 0 = 6.75 |
| [mall-floors-ordinary-taxi-on](mall-floors-ordinary-taxi-on.json) | 可用/通过 | 27.948/31.111 | 1 | transit-detailed | 0.00 | 5 + 0 + 1.75 + 0 + 0 + 0 = 6.75 |
| [mall-floors-luggage-taxi-off](mall-floors-luggage-taxi-off.json) | 可用/通过 | 22.692/25.623 | 1 | transit-detailed | 0.00 | 5 + 0 + 1.75 + 0 + 0 + 5.8222 = 12.5722 |
| [mall-floors-luggage-taxi-on](mall-floors-luggage-taxi-on.json) | 可用/通过 | 28.402/32.011 | 1 | transit-detailed | 0.00 | 5 + 0 + 1.75 + 0 + 0 + 5.8222 = 12.5722 |
| [mall-floors-escalator-taxi-off](mall-floors-escalator-taxi-off.json) | 可用/通过 | 27.169/30.471 | 1 | transit-detailed | 0.00 | 5 + 0 + 1.75 + 0 + 0 + 0 = 6.75 |
| [mall-floors-escalator-taxi-on](mall-floors-escalator-taxi-on.json) | 可用/通过 | 28.115/31.632 | 1 | transit-detailed | 0.00 | 5 + 0 + 1.75 + 0 + 0 + 0 = 6.75 |
| [mall-floors-lift-taxi-off](mall-floors-lift-taxi-off.json) | 可用/通过 | 28.308/32.061 | 1 | transit-detailed | 0.00 | 5 + 0 + 1.75 + 0 + 0 + 1.1813 = 7.9313 |
| [mall-floors-lift-taxi-on](mall-floors-lift-taxi-on.json) | 可用/通过 | 33.005/37.032 | 1 | transit-detailed | 0.00 | 5 + 0 + 1.75 + 0 + 0 + 1.1813 = 7.9313 |
| [mall-floors-accessible-taxi-off](mall-floors-accessible-taxi-off.json) | 完整比较/严格负结果 | —/22.393 | 0 | — | — | — |
| [mall-floors-accessible-taxi-on](mall-floors-accessible-taxi-on.json) | 完整比较/严格负结果 | —/32.812 | 0 | — | — | — |
| [kowloon-local-ordinary-taxi-off](kowloon-local-ordinary-taxi-off.json) | 可用/通过 | 5.687/10.906 | 2 | walk | 0.00 | 12 + 0 + 4.2 + 0 + 0 + 0 = 16.2 |
| [kowloon-local-ordinary-taxi-on](kowloon-local-ordinary-taxi-on.json) | 可用/通过 | 6.121/14.968 | 2 | walk | 0.00 | 12 + 0 + 4.2 + 0 + 0 + 0 = 16.2 |
| [kowloon-local-luggage-taxi-off](kowloon-local-luggage-taxi-off.json) | 可用/通过 | 5.116/38.233 | 2 | transit | 5.40 | 10 + 4.05 + 2.1 + 2 + 0 + 6.7447 = 24.8947 |
| [kowloon-local-luggage-taxi-on](kowloon-local-luggage-taxi-on.json) | 可用/通过 | 8.534/39.565 | 2 | transit | 5.40 | 10 + 4.05 + 2.1 + 2 + 0 + 6.7447 = 24.8947 |
| [kowloon-local-escalator-taxi-off](kowloon-local-escalator-taxi-off.json) | 可用/通过 | 8.242/48.966 | 2 | walk | 0.00 | 12 + 0 + 4.2 + 0 + 0 + 0 = 16.2 |
| [kowloon-local-escalator-taxi-on](kowloon-local-escalator-taxi-on.json) | 可用/通过 | 6.248/59.783 | 2 | walk | 0.00 | 12 + 0 + 4.2 + 0 + 0 + 0 = 16.2 |
| [kowloon-local-lift-taxi-off](kowloon-local-lift-taxi-off.json) | 可用/通过 | 7.895/47.413 | 2 | walk | 0.00 | 12 + 0 + 4.2 + 0 + 0 + 0.6276 = 16.8276 |
| [kowloon-local-lift-taxi-on](kowloon-local-lift-taxi-on.json) | 可用/通过 | 5.450/53.812 | 2 | walk | 0.00 | 12 + 0 + 4.2 + 0 + 0 + 0.6276 = 16.8276 |
| [kowloon-local-accessible-taxi-off](kowloon-local-accessible-taxi-off.json) | 完整比较/严格负结果 | —/21.175 | 0 | — | — | — |
| [kowloon-local-accessible-taxi-on](kowloon-local-accessible-taxi-on.json) | 完整比较/严格负结果 | —/24.494 | 0 | — | — | — |
| [land-island-ordinary-taxi-off](land-island-ordinary-taxi-off.json) | 可用/通过 | 6.381/9.544 | 1 | transit | 0.00 | 60 + 0 + 21 + 0 + 0 + 0 = 81 |
| [land-island-ordinary-taxi-on](land-island-ordinary-taxi-on.json) | 可用/通过 | 3.634/12.683 | 2 | taxi-direct | 34.76 | 14 + 26.07 + 0.7 + 2.6722 + 0 + 0 = 43.4422 |
| [land-island-luggage-taxi-off](land-island-luggage-taxi-off.json) | 可用/通过 | 8.007/11.634 | 1 | transit | 0.00 | 65 + 0 + 22.75 + 0 + 0 + 64.3677 = 152.1177 |
| [land-island-luggage-taxi-on](land-island-luggage-taxi-on.json) | 可用/通过 | 2.904/13.800 | 2 | taxi-direct | 34.76 | 14 + 26.07 + 0.7 + 2.6722 + 0 + 1.5611 = 45.0032 |
| [land-island-escalator-taxi-off](land-island-escalator-taxi-off.json) | 可用/通过 | 10.581/14.103 | 1 | transit | 0.00 | 60 + 0 + 21 + 0 + 0 + 4.0214 = 85.0214 |
| [land-island-escalator-taxi-on](land-island-escalator-taxi-on.json) | 可用/通过 | 3.541/15.137 | 2 | taxi-direct | 34.76 | 14 + 26.07 + 0.7 + 2.6722 + 0 + 0 = 43.4422 |
| [land-island-lift-taxi-off](land-island-lift-taxi-off.json) | 可用/通过 | 14.190/17.772 | 1 | transit | 0.00 | 65 + 0 + 22.75 + 0 + 0 + 0 = 87.75 |
| [land-island-lift-taxi-on](land-island-lift-taxi-on.json) | 可用/通过 | 3.330/12.916 | 2 | taxi-direct | 34.76 | 14 + 26.07 + 0.7 + 2.6722 + 0 + 0 = 43.4422 |
| [land-island-accessible-taxi-off](land-island-accessible-taxi-off.json) | 完整比较/严格负结果 | —/24.228 | 0 | — | — | — |
| [land-island-accessible-taxi-on](land-island-accessible-taxi-on.json) | 完整比较/严格负结果 | —/20.980 | 0 | — | — | — |
| [land-cross-ordinary-taxi-off](land-cross-ordinary-taxi-off.json) | 可用/通过 | 6.462/8.433 | 1 | transit | 18.16 | 107 + 13.62 + 25.9 + 3 + 6 + 0 = 155.52 |
| [land-cross-ordinary-taxi-on](land-cross-ordinary-taxi-on.json) | 可用/通过 | 2.805/16.070 | 4 | taxi-direct | 87.90 | 16 + 65.925 + 1.05 + 0.9106 + 0 + 0 = 83.8856 |
| [land-cross-luggage-taxi-off](land-cross-luggage-taxi-off.json) | 可用/通过 | 10.912/13.068 | 1 | transit | 16.17 | 124 + 12.1275 + 26.6 + 12 + 6 + 113.0589 = 293.7864 |
| [land-cross-luggage-taxi-on](land-cross-luggage-taxi-on.json) | 可用/通过 | 3.239/29.917 | 4 | taxi-direct | 87.90 | 16 + 65.925 + 1.05 + 0.9106 + 0 + 2.2342 = 86.1198 |
| [land-cross-escalator-taxi-off](land-cross-escalator-taxi-off.json) | 可用/通过 | 10.740/14.213 | 1 | transit | 18.16 | 110 + 13.62 + 26.95 + 3 + 6 + 11.9542 = 171.5242 |
| [land-cross-escalator-taxi-on](land-cross-escalator-taxi-on.json) | 可用/通过 | 3.077/30.879 | 4 | taxi-direct | 87.90 | 16 + 65.925 + 1.05 + 0.9106 + 0 + 0 = 83.8856 |
| [land-cross-lift-taxi-off](land-cross-lift-taxi-off.json) | 可用/通过 | 14.987/17.458 | 1 | transit | 18.16 | 110 + 13.62 + 26.95 + 3 + 6 + 22.3896 = 181.9596 |
| [land-cross-lift-taxi-on](land-cross-lift-taxi-on.json) | 可用/通过 | 3.247/25.601 | 4 | taxi-direct | 87.90 | 16 + 65.925 + 1.05 + 0.9106 + 0 + 0 = 83.8856 |
| [land-cross-accessible-taxi-off](land-cross-accessible-taxi-off.json) | 完整比较/严格负结果 | —/23.641 | 0 | — | — | — |
| [land-cross-accessible-taxi-on](land-cross-accessible-taxi-on.json) | 完整比较/严格负结果 | —/26.129 | 0 | — | — | — |

## 逐段费用

以下为默认赢家的每个生产定价分段；所有完整候选的全部逐段报价另存 [price-sensitivity.json](price-sensitivity.json) 的 candidateFares，原报告也保留不可用情景报价、incompleteReason及endpointAccess。未核验精确端点的出租车报价不进入完整导航排名。

| 单元 | 赢家 | 分段HK$ | 合计HK$ |
| --- | --- | --- | ---: |
| exits-cross-ordinary-taxi-off | transit | 1.walk 0.00 + 2.metro 7.87 + 3.walk 0.00 | 7.87 |
| exits-cross-ordinary-taxi-on | transit | 1.walk 0.00 + 2.metro 7.87 + 3.walk 0.00 | 7.87 |
| exits-cross-luggage-taxi-off | transit | 1.walk 0.00 + 2.metro 7.87 + 3.walk 0.00 | 7.87 |
| exits-cross-luggage-taxi-on | transit | 1.walk 0.00 + 2.metro 7.87 + 3.walk 0.00 | 7.87 |
| exits-cross-escalator-taxi-off | transit | 1.walk 0.00 + 2.metro 7.87 + 3.walk 0.00 | 7.87 |
| exits-cross-escalator-taxi-on | transit | 1.walk 0.00 + 2.metro 7.87 + 3.walk 0.00 | 7.87 |
| exits-cross-lift-taxi-off | transit | 1.walk 0.00 + 2.metro 7.87 + 3.walk 0.00 | 7.87 |
| exits-cross-lift-taxi-on | transit | 1.walk 0.00 + 2.metro 7.87 + 3.walk 0.00 | 7.87 |
| stops-cross-ordinary-taxi-off | transit | 1.walk 0.00 + 2.bus 5.70 + 3.walk 0.00 + 4.metro 7.87 + 5.walk 0.00 | 13.57 |
| stops-cross-ordinary-taxi-on | transit | 1.walk 0.00 + 2.bus 5.70 + 3.walk 0.00 + 4.metro 7.87 + 5.walk 0.00 | 13.57 |
| stops-cross-luggage-taxi-off | transit | 1.walk 0.00 + 2.bus 5.70 + 3.walk 0.00 + 4.metro 7.87 + 5.walk 0.00 | 13.57 |
| stops-cross-luggage-taxi-on | taxi-direct | 1.walk 0.00 + 2.taxi 95.23 + 3.walk 0.00 | 95.23 |
| stops-cross-escalator-taxi-off | transit | 1.walk 0.00 + 2.bus 5.70 + 3.walk 0.00 + 4.metro 7.87 + 5.walk 0.00 | 13.57 |
| stops-cross-escalator-taxi-on | transit | 1.walk 0.00 + 2.bus 5.70 + 3.walk 0.00 + 4.metro 7.87 + 5.walk 0.00 | 13.57 |
| stops-cross-lift-taxi-off | transit | 1.walk 0.00 + 2.bus 5.70 + 3.walk 0.00 + 4.metro 7.87 + 5.walk 0.00 | 13.57 |
| stops-cross-lift-taxi-on | taxi-direct | 1.walk 0.00 + 2.taxi 95.23 + 3.walk 0.00 | 95.23 |
| mall-floors-ordinary-taxi-off | transit-detailed | 1.walk 0.00 | 0.00 |
| mall-floors-ordinary-taxi-on | transit-detailed | 1.walk 0.00 | 0.00 |
| mall-floors-luggage-taxi-off | transit-detailed | 1.walk 0.00 | 0.00 |
| mall-floors-luggage-taxi-on | transit-detailed | 1.walk 0.00 | 0.00 |
| mall-floors-escalator-taxi-off | transit-detailed | 1.walk 0.00 | 0.00 |
| mall-floors-escalator-taxi-on | transit-detailed | 1.walk 0.00 | 0.00 |
| mall-floors-lift-taxi-off | transit-detailed | 1.walk 0.00 | 0.00 |
| mall-floors-lift-taxi-on | transit-detailed | 1.walk 0.00 | 0.00 |
| kowloon-local-ordinary-taxi-off | walk | 1.walk 0.00 | 0.00 |
| kowloon-local-ordinary-taxi-on | walk | 1.walk 0.00 | 0.00 |
| kowloon-local-luggage-taxi-off | transit | 1.walk 0.00 + 2.bus 5.40 | 5.40 |
| kowloon-local-luggage-taxi-on | transit | 1.walk 0.00 + 2.bus 5.40 | 5.40 |
| kowloon-local-escalator-taxi-off | walk | 1.walk 0.00 | 0.00 |
| kowloon-local-escalator-taxi-on | walk | 1.walk 0.00 | 0.00 |
| kowloon-local-lift-taxi-off | walk | 1.walk 0.00 | 0.00 |
| kowloon-local-lift-taxi-on | walk | 1.walk 0.00 | 0.00 |
| land-island-ordinary-taxi-off | transit | 1.walk 0.00 | 0.00 |
| land-island-ordinary-taxi-on | taxi-direct | 1.walk 0.00 + 2.taxi 34.76 + 3.walk 0.00 | 34.76 |
| land-island-luggage-taxi-off | transit | 1.walk 0.00 | 0.00 |
| land-island-luggage-taxi-on | taxi-direct | 1.walk 0.00 + 2.taxi 34.76 + 3.walk 0.00 | 34.76 |
| land-island-escalator-taxi-off | transit | 1.walk 0.00 | 0.00 |
| land-island-escalator-taxi-on | taxi-direct | 1.walk 0.00 + 2.taxi 34.76 + 3.walk 0.00 | 34.76 |
| land-island-lift-taxi-off | transit | 1.walk 0.00 | 0.00 |
| land-island-lift-taxi-on | taxi-direct | 1.walk 0.00 + 2.taxi 34.76 + 3.walk 0.00 | 34.76 |
| land-cross-ordinary-taxi-off | transit | 1.walk 0.00 + 2.metro 7.29 + 3.walk 0.00 + 4.metro 7.87 + 5.walk 0.00 + 6.tram 3.00 + 7.walk 0.00 | 18.16 |
| land-cross-ordinary-taxi-on | taxi-direct | 1.walk 0.00 + 2.taxi 87.90 + 3.walk 0.00 | 87.90 |
| land-cross-luggage-taxi-off | transit | 1.walk 0.00 + 2.bus 5.30 + 3.walk 0.00 + 4.metro 7.87 + 5.walk 0.00 + 6.tram 3.00 + 7.walk 0.00 | 16.17 |
| land-cross-luggage-taxi-on | taxi-direct | 1.walk 0.00 + 2.taxi 87.90 + 3.walk 0.00 | 87.90 |
| land-cross-escalator-taxi-off | transit | 1.walk 0.00 + 2.metro 7.29 + 3.walk 0.00 + 4.metro 7.87 + 5.walk 0.00 + 6.tram 3.00 + 7.walk 0.00 | 18.16 |
| land-cross-escalator-taxi-on | taxi-direct | 1.walk 0.00 + 2.taxi 87.90 + 3.walk 0.00 | 87.90 |
| land-cross-lift-taxi-off | transit | 1.walk 0.00 + 2.metro 7.29 + 3.walk 0.00 + 4.metro 7.87 + 5.walk 0.00 + 6.tram 3.00 + 7.walk 0.00 | 18.16 |
| land-cross-lift-taxi-on | taxi-direct | 1.walk 0.00 + 2.taxi 87.90 + 3.walk 0.00 | 87.90 |

## 价格敏感性

价格权重0、0.25、0.75、1.5、3；17 格首选改变，其余已观察格首选在该五点扫描中不变。仅完整可用且通过审计的候选参加；没有强求出租车接驳胜出。所有候选每个权重的指标/分项贡献在 [price-sensitivity.json](price-sensitivity.json)。

| 单元 | 0 | 0.25 | 0.75 | 1.5 | 3 |
| --- | --- | --- | --- | --- | --- |
| kowloon-local-escalator-taxi-off | transit | transit | walk | walk | walk |
| kowloon-local-escalator-taxi-on | transit | transit | walk | walk | walk |
| kowloon-local-lift-taxi-off | transit | transit | walk | walk | walk |
| kowloon-local-lift-taxi-on | transit | transit | walk | walk | walk |
| kowloon-local-luggage-taxi-off | transit | transit | transit | walk | walk |
| kowloon-local-luggage-taxi-on | transit | transit | transit | walk | walk |
| kowloon-local-ordinary-taxi-off | transit | transit | walk | walk | walk |
| kowloon-local-ordinary-taxi-on | transit | transit | walk | walk | walk |
| land-cross-escalator-taxi-on | taxi-direct | taxi-direct | taxi-direct | taxi-direct | transit |
| land-cross-lift-taxi-on | taxi-direct | taxi-direct | taxi-direct | taxi-direct | transit |
| land-cross-ordinary-taxi-on | taxi-direct | taxi-direct | taxi-direct | taxi-direct | transit |
| land-island-escalator-taxi-on | taxi-direct | taxi-direct | taxi-direct | taxi-direct | transit |
| land-island-lift-taxi-on | taxi-direct | taxi-direct | taxi-direct | taxi-direct | transit |
| land-island-ordinary-taxi-on | taxi-direct | taxi-direct | taxi-direct | taxi-direct | transit |
| stops-cross-escalator-taxi-on | taxi-direct | taxi-direct | transit | transit | transit |
| stops-cross-lift-taxi-on | taxi-direct | taxi-direct | taxi-direct | transit | transit |
| stops-cross-ordinary-taxi-on | taxi-direct | taxi-direct | transit | transit | transit |

## 严格负结果的解释

- 出口过海及站点/固定种子过海：严格公共登乘与接入证据不足，且无对应跨海步行方案。HUH站内真实严格来源连通已另行证实，不能把本负结果写成该升降机或整座车站不可达。
- 九龍C1及岛内地图点：原报告明确首末无障碍接入未核验，公共登乘也未核验。普通出租车不因开关开启而满足严格轮椅条件，这是模式/证据政策。
- 太古LG1→L4：11时开放规则允许进入，但当前来源层缺通往L4的严格合格连接；全域比较未提供完整方案。源层缺证据不等于现实设施不可达。
- 不可用原因原文保存在每格unavailable；以上解释不把算法错误、超时或OOM归为来源限制。旧端点降级与区域身份错误均单独保留历史证据。

## 独立来源楼层层

同runtime：100 格（5真实楼层×5偏好×08/11时×2方向），63 条来源路线，37 个不可用结果；0 个断言失败。仅110个物理边/98节点，不计入上述60格。

11时42/50返回路线：四种非严格偏好覆盖所有楼层双向，严格仅LG1可连F。08时21/50明确在外等到开放后进入；25个闭店楼层内出发被拒，另4个严格上层到达缺合格连接。完整时刻/楼层/边证据见 [source-floors-clock-aware.json](source-floors-clock-aware.json)。

## 复现与边界

- 使用固定fixture内原node/XYZ/floor、2026-10-12香港11时与原seed20261011；非路线成功筛选。
- 精确端点、同层真实portal、相邻几何、完整源严格predicate、已知关闭/设施限制、全部生产逐段费用、真实取消和无迟发候选均在原报告中审计。
- 车行站位投影、跨海铁路示意、未知接入和设施状态分别保留，不因图形连续而变成官方实体通道。
- 六组OD是分层诊断覆盖，不能推出香港全域可达、实时开放或官方票价正确。没有浏览器视觉验收结论。
- 本报告只属于标题runtime；后续构建的定向补验须另列，不能继承本版60格覆盖。
