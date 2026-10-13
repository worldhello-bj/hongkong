import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalStationEndpoint, stationOutdoorCandidates } from '../src/navigation/station-identity.js';
export function patchStationIdentity(source, worker = false) {
  const old = worker ? 'const b=M.get(l.fromId)?.node_id??l.fromId,z=M.get(l.toId)?.node_id??l.toId,x=u(b)' : 'const g=b.get(a.fromId)?.node_id??a.fromId,C=b.get(a.toId)?.node_id??a.toId,M=c(g)';
  const replacement = worker ? 'const b=canonicalStationEndpoint(l.fromId,M,c),z=canonicalStationEndpoint(l.toId,M,c),x=u(b)' : 'const g=canonicalStationEndpoint(a.fromId,b,d),C=canonicalStationEndpoint(a.toId,b,d),M=c(g)';
  const identityDone = source.includes(replacement);
  if (!identityDone && source.split(old).length !== 2) throw new Error('Station identity patch anchor drift');
  const candidateOld = worker ? 'for(const b of fe(L)){' : 'for(const g of q(D)){';
  const candidateNew = worker ? 'for(const b of [...fe(L),...stationOutdoorCandidates(L,M,c)]){' : 'for(const g of [...q(D),...stationOutdoorCandidates(D,b,d)]){';
  const candidatesDone = source.includes(candidateNew);
  if (identityDone && candidatesDone) return source;
  if (!candidatesDone && source.split(candidateOld).length !== 2) throw new Error('Station outdoor candidate patch anchor drift');
  return (identityDone ? '' : canonicalStationEndpoint.toString()+'\n') + (source.includes('function stationOutdoorCandidates(') ? '' : stationOutdoorCandidates.toString()+'\n') + source.replace(old,replacement).replace(candidateOld,candidateNew);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const [name, worker] of [['intermodal-routing-D8vKT-lN.js',false],['app-transit-worker-CaCMeUxU.js',true]]) {
    const file = new URL('../dist/assets/'+name,import.meta.url);
    fs.writeFileSync(file, patchStationIdentity(fs.readFileSync(file,'utf8'),worker));
  }
  console.log('Canonical official station identity patch applied');
}
