/** Diagnostic reference only. These points are NOT snapped nodes or route edges.
 * Verified 2026-10-12 against MTR's own journey-planner response.
 * Platform-to-platform estimates include possible waiting and exclude entrance access.
 */
const adm=[114.164826,22.278752],mok=[114.169246,22.319336];
const nearby=(point,target,meters)=>Array.isArray(point?.coordinates)&&Math.hypot((point.coordinates[0]-target[0])*102900,(point.coordinates[1]-target[1])*111320)<=meters;
export function limitedRailReference(request){
 const forward=nearby(request.origin,adm,900)&&nearby(request.destination,mok,1200),reverse=nearby(request.destination,adm,900)&&nearby(request.origin,mok,1200);
 if(!forward&&!reverse)return '';
 const url=forward?'https://www.mtr.com.hk/share/customer/jp/api/HRRoutes/?o=2&d=6&lang=E':'https://www.mtr.com.hk/share/customer/jp/api/HRRoutes/?o=6&d=2&lang=E';
 return `<p class="na-note na-coverage-reference">线路覆盖提示：金钟—旺角有荃湾线直达，<a href="${url}" target="_blank" rel="noreferrer">港铁站台到站台参考约 10 分钟</a>（进出站另计）。本演示尚缺该线及旺角站内接续，当前比较不能代表全网最优。参考核验：2026-10-12。</p>`;
}
