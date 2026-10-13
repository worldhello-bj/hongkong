/**
 * Floor names/functions are documentation-derived; every display point, slab,
 * spacing and link below is a schematic UI coordinate, NEVER a routing node,
 * surveyed position, walkable area, passage, or accessibility assertion.
 * Sources checked 2026-10-13. No graph inputs are read or changed by this module.
 */
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
export const JOURNEY_3D_SOURCES = freeze({
  wekLayout: { label: '港铁西九龙官方站图', url: 'https://www.highspeed.mtr.com.hk/res/pdf/WEK-station-layout-B3.pdf', checked: '2026-10-13', supports: 'B1 票务、B2 抵港、B3 离港、B4 月台的层级与用途；不提供本模型几何。' },
  wekDeparture: { label: '港铁离港流程', url: 'https://www.highspeed.mtr.com.hk/en/guide/process-departure.html', checked: '2026-10-13', supports: 'B1 核验、安检、B3 两地出入境与检票的手续次序。' },
  wekArrival: { label: '港铁抵港流程', url: 'https://www.highspeed.mtr.com.hk/en/guide/process-arrival.html', checked: '2026-10-13', supports: 'B4 下车后前往 B2 办理两地出入境，再离站。' },
  futianFloors: { label: '福田区政府楼层说明（2015）', url: 'https://www.szft.gov.cn/xxgk/zwgk/gzxx/zdjsxm/xmjz/content/post_3965773.html', published: '2015-12-29', checked: '2026-10-13', supports: 'B1 换乘、B2 站厅与候车、B3 高铁站台。历史建筑资料，不证明当前闸口或设施状态。' },
  futianStation: { label: '深圳交通运输局福田站资料', url: 'https://jtys.sz.gov.cn/ydmh/jtcx/hccx/hczfb/content/post_11457303.html', checked: '2026-10-13', supports: '福田高铁站身份与交通接驳背景；不提供室内逐转路线。' }
});
const node = (id, label, floor, x, y) => ({ id, label, floor, displayPoint: [x, y], geometryMode: 'schematic-ui', routeEligible: false });
const stage = (id, label, floors, nodes, note) => ({ id, label, floors, nodes, note, routeEligible: false });
const common = {
  schemaVersion: 'journey-3d-v1', geometryMode: 'schematic-ui', coordinateSystem: 'unitless-display',
  routeEligible: false, surveyed: false, realtime: false, accessibilityVerified: false,
  warnings: [
    '楼层用途有官方资料依据；楼板、体量、设施位置、间距与连线均为程序化示意，没有实测坐标。',
    '虚线只表示手续先后，不是可行走通道。无精确出入口、闸口指派、换层设施或无障碍保证；请依现场标志。',
    '手动演练与导航步骤高亮都不代表实时定位。此模型不修改路线、耗时、通行资格或原始路网。'
  ]
};
export const JOURNEY_3D_MODELS = freeze({
  'HSR:WEK': {
    ...common, id: 'HSR:WEK', name: '香港西九龙', englishName: 'WEST KOWLOON',
    factsLabel: '官方楼层 / 离抵港流程', sourceIds: ['wekLayout', 'wekDeparture', 'wekArrival'],
    floors: [
      { id: 'B1', label: '票务大堂', sourceId: 'wekLayout' },
      { id: 'B2', label: '抵港大堂', sourceId: 'wekLayout' },
      { id: 'B3', label: '离港大堂', sourceId: 'wekLayout' },
      { id: 'B4', label: '高铁月台', sourceId: 'wekLayout' }
    ],
    nodes: [
      node('ticket', '实名核验', 'B1', -70, 0),
      node('departure-immigration', '两地出入境', 'B3', -88, -12),
      node('waiting', '候车', 'B3', 5, 0),
      node('boarding', '检票', 'B3', 84, 12),
      node('platform', '列车乘降', 'B4', 20, 0),
      node('arrival-immigration', '两地出入境', 'B2', -72, 0),
      node('arrival-exit', '离站', 'B2', 75, 0)
    ],
    journeys: {
      departure: {
        label: '离港乘车', sourceId: 'wekDeparture', evidence: 'official-procedure',
        stages: [
          stage('verification', '实名与车票核验', ['B1'], ['ticket'], '官方流程对应 B1 票务大堂；图中核验点位置仅作示意。'),
          stage('security', '安检后前往离港层', ['B1', 'B3'], [], '安检后前往 B3；未建立安检设施的精确位置或层间通道。'),
          stage('immigration', '办理两地出入境', ['B3'], ['departure-immigration'], 'B3 离港大堂办理香港与内地出入境手续；具体柜台依现场安排。'),
          stage('waiting', '候车与检票准备', ['B3'], ['waiting'], 'B3 候车；车次对应闸口、排队位置与候车耗时未在模型中确定。'),
          stage('boarding', '检票后前往月台', ['B3', 'B4'], ['boarding', 'platform'], 'B3 检票后前往 B4 月台；不指定扶梯、升降机或站台号码。')
        ],
        sequence: ['ticket', 'departure-immigration', 'waiting', 'boarding', 'platform']
      },
      arrival: {
        label: '抵港离站', sourceId: 'wekArrival', evidence: 'official-procedure',
        stages: [
          stage('alighting', '列车到达与下车', ['B4'], ['platform'], '官方流程从 B4 月台下车开始；没有列车停靠点定位。'),
          stage('immigration', '前往抵港层并过关', ['B4', 'B2'], ['arrival-immigration'], '由 B4 前往 B2 办理两地出入境；连线不代表可通行的具体换层设施。'),
          stage('exit', '出闸并继续接驳', ['B2'], ['arrival-exit'], '过关后出闸离站；接驳走法请查看已核验的独立路线或官方站图。')
        ],
        sequence: ['platform', 'arrival-immigration', 'arrival-exit']
      }
    }
  },
  'HSR:FUT': {
    ...common, id: 'HSR:FUT', name: '深圳福田高铁站', englishName: 'FUTIAN RAILWAY',
    factsLabel: '官方历史楼层说明 / 流程示意', sourceIds: ['futianFloors', 'futianStation'],
    floors: [
      { id: 'B1', label: '换乘大厅', sourceId: 'futianFloors' },
      { id: 'B2', label: '站厅与候车大厅', sourceId: 'futianFloors' },
      { id: 'B3', label: '高铁站台', sourceId: 'futianFloors' }
    ],
    nodes: [node('transfer', '接驳层', 'B1', -42, 0), node('waiting', '候车', 'B2', -44, 0), node('boarding', '检票', 'B2', 72, 6), node('platform', '列车乘降', 'B3', 12, 0)],
    journeys: {
      departure: {
        label: '进站乘车', sourceId: 'futianFloors', evidence: 'modeled-procedure',
        stages: [
          stage('transfer', '了解接驳层', ['B1'], ['transfer'], '历史官方资料说明 B1 为换乘大厅；并非所有进站路径必须经过 B1。'),
          stage('waiting', '候车层手续', ['B2'], ['waiting'], 'B2 站厅与候车层有资料依据；安检和检票设施的当前位置未核验。'),
          stage('boarding', '检票与前往月台', ['B2', 'B3'], ['boarding', 'platform'], '展示候车层至高铁站台的流程关系；不提供精确通道、设施或站台指派。')
        ],
        sequence: ['waiting', 'boarding', 'platform']
      },
      arrival: {
        label: '到站接驳', sourceId: 'futianFloors', evidence: 'modeled-procedure',
        stages: [
          stage('alighting', '高铁下车', ['B3'], ['platform'], 'B3 高铁站台有官方历史资料依据；到达闸口、出口楼层与具体走法未核验。'),
          stage('transfer', '接驳层概览', ['B1'], ['transfer'], 'B1 为接驳层概览，并非已算通的到达路线；离站路径与开放入口须现场确认。')
        ],
        sequence: []
      }
    }
  }
});
