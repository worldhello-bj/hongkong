/** Two preselected real source ODs, four passenger preferences, both taxi policies. */
import {readFileSync} from 'node:fs';
import {ROOT,FIXTURE,readJSON,digest,runtimeIdentity} from './point-matrix-fixture.mjs';
export {ROOT,FIXTURE,readJSON,digest,runtimeIdentity};
export const PREFERENCES=Object.freeze(['ordinary','luggage','escalator','lift']);
export const ROW_IDS=Object.freeze(['mall-floors','exits-cross']);
export function fourPreferenceFixture(){
 const original=readJSON(FIXTURE);
 const rows=ROW_IDS.map(id=>{const row=original.rows.find(r=>r.id===id);if(!row)throw Error('Missing fixed real source row: '+id);return row;});
 for(const row of rows)if(row.request.departureDate!=='2026-10-12'||row.request.departureS!==39600)throw Error('Fixed Hong Kong request clock changed.');
 return {...original,preferences:[...PREFERENCES],rows,sourceFixtureSha256:digest(readFileSync(FIXTURE))};
}
export function fourPreferenceCells(){return fourPreferenceFixture().rows.flatMap(row=>PREFERENCES.flatMap(need=>[false,true].map(taxi=>({id:`${row.id}-${need}-taxi-${taxi?'on':'off'}`,rowId:row.id,need,taxi}))));}
export function fourPreferencePlan(runtime){const fixture=fourPreferenceFixture();return {schema:1,runtime:runtime.version,signature:runtime.signature,sourceFixtureSha256:fixture.sourceFixtureSha256,rows:fixture.rows,preferences:PREFERENCES,taxi:[false,true],cells:fourPreferenceCells(),departureTimezone:fixture.departureTimezone,windowMs:fixture.observationWindowMs,watchdogMs:fixture.externalWatchdogMs,execution:'Serial fresh process per cell; main heap 768 MiB, each Worker 384 MiB. These are heap limits, not a process RSS cap.',maximumRouteObservationMinutes:16,maximumExternalWatchdogMinutes:24,acceptance:'Each cell must actually run the pinned new build, complete its comparison, retain at least one valid source endpoint route, and pass every inherited plus additive audit. Pending/empty/error cells are not passes.'};}
