// Passenger-only taxi policy asset.
import {copyFile, readFile, writeFile, readdir, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
await copyFile(root + 'src/navigation/taxi-policy.js', root + 'dist/assets/taxi-policy.js');
await copyFile(root + 'src/navigation/preference-routing.js', root + 'dist/assets/preference-routing.js');
for (const file of ['terminal-isolation.js','exact-boundary-selection.js','origin-opening.js','ticket-page.js','ticket-page.css','journey-3d-model.js','journey-3d-data.js','journey-3d-model.css','highspeed-service.js','highspeed-routing.js','traffic-scenario.js','traffic-clock.js','transit-vehicles.js','map-tiles.js','passenger-preferences.js','transit-stops.js','kow-c1-corridor.js','kow-c1-corridor-data.js','ui-navigation.js','ui-content.js','journey-score.js','taxi-candidates.js','rail-reference.js','routing-queue.js','score-parameters.js','place-opening.js','pacific-place-model.js','pacific-place-model.css']) await copyFile(root+'src/navigation/'+file,root+'dist/assets/'+file);
await copyFile(root + 'src/navigation/route-quote.js', root + 'dist/assets/route-quote.js');
await copyFile(root + 'src/navigation/demo-fallback.js', root + 'dist/assets/demo-fallback.js');
await copyFile(root + 'src/navigation/public-coverage.js', root + 'dist/assets/public-coverage.js');
await copyFile(root + 'src/navigation/boot-status.js', root + 'dist/assets/boot-status.js');
await copyFile(root + 'src/navigation/main.recovered.js', root + 'dist/assets/main-integrated.js');
await copyFile(root + 'src/navigation/integrated-navigation.js', root + 'dist/assets/integrated-navigation.js');
await copyFile(root + 'src/navigation/taxi-bridge.js', root + 'dist/assets/taxi-bridge.js');
await copyFile(root + 'src/navigation/taxi-map.js', root + 'dist/assets/taxi-map.js');
await copyFile(root + 'src/navigation/station-alternatives.js', root + 'dist/assets/station-alternatives.js');
await copyFile(root + 'src/navigation/integrated.css', root + 'dist/assets/integrated.css');
await (await import('./navigation-entrypoints.mjs')).migrateNavigationEntrypoints(root);
console.log('Built navigation entry; preserved original data, geometry and Worker bundles.');

await mkdir(root + 'dist/taxi', {recursive:true});
for (const name of await readdir(root + 'src/taxi')) {
  if (name === 'roaming.js' || name === 'road-graph.js' || name === 'government-data.json' || name === 'government-sources.md')
    await copyFile(root + 'src/taxi/' + name, root + 'dist/taxi/' + name);
}

await import('./remove-routing-budgets.mjs');
await import('./repair-fifo-wait.mjs');
await import('./repair-demo-snap.mjs');
await import('./repair-preference-routing.mjs');
for (const patch of ['repair-preference-heuristic.mjs','repair-modeled-height-snap.mjs']) (await import('node:child_process')).execFileSync(process.execPath,[root+'scripts/'+patch,root],{stdio:'inherit'});
(await import('node:child_process')).execFileSync(process.execPath,[root+'scripts/repair-demo-snap-cache.mjs',root],{stdio:'inherit'});
await import('./repair-coverage-selection.mjs');
(await import('node:child_process')).execFileSync(process.execPath,[root+'scripts/repair-endpoint-region.mjs',root],{stdio:'inherit'});
(await import('node:child_process')).execFileSync(process.execPath,[root+'scripts/repair-station-identity.mjs'],{stdio:'inherit'});
await import('./repair-accessible-lifts.mjs');
await (await import('./repair-station-overlay.mjs')).applyStationOverlayRepair();
const {execFileSync} = await import('node:child_process');
execFileSync('python3', [root + 'scripts/repair-station-anchors.py', root, '--apply'], {stdio:'inherit'});
await import('./repair-local-access-geometry.mjs');
execFileSync(process.execPath,[root+'scripts/repair-pacific-place-model.mjs',root],{stdio:'inherit'});
execFileSync(process.execPath,[root+'scripts/repair-metro-worker-lifecycle.mjs'],{stdio:'inherit'});
execFileSync(process.execPath,[root+'scripts/repair-search-preparation.mjs',root],{stdio:'inherit'});
execFileSync(process.execPath,[root+'scripts/repair-lower-bound-cache.mjs',root],{stdio:'inherit'});
execFileSync(process.execPath,[root+'scripts/repair-destination-lower-bounds.mjs',root],{stdio:'inherit'});
execFileSync(process.execPath,[root+'scripts/repair-route-memory.mjs',root],{stdio:'inherit'});
execFileSync(process.execPath,[root+'scripts/repair-walk-cache-clock.mjs',root],{stdio:'inherit'});
execFileSync(process.execPath,[root+'scripts/repair-scheduled-label-buckets.mjs',root],{stdio:'inherit'});
execFileSync(process.execPath,[root+'scripts/repair-transit-stop-projection.mjs',root],{stdio:'inherit'});
execFileSync(process.execPath,[root+'scripts/repair-intermodal-endpoint-region.mjs',root],{stdio:'inherit'});
await import('./split-map-display.mjs');
await import('./repair-highspeed-navigation.mjs');
await (await import('./repair-region-refusal-message.mjs')).repairRegionRefusalMessages();
execFileSync(process.execPath,[root+'scripts/augment-exc-b3.mjs',root],{stdio:'inherit'});
await (await import('./terminal-policy/emit-policy.mjs')).emitTerminalPolicy(root);
await import('./version-runtime.mjs');
