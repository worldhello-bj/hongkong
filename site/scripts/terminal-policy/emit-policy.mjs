import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {verifyTerminalResolverPolicy} from './verify-policy.mjs';

export async function emitTerminalPolicy(root) {
  const verified = await verifyTerminalResolverPolicy(root);
  assert.ok(verified.verified && verified.policyId, 'Terminal resolver changed: review ingress proof before enabling the optimization.');
  for (const file of ['src/navigation/main.recovered.js', 'dist/assets/main-integrated.js']) {
    const source = await readFile(resolve(root, file), 'utf8');
    for (const marker of ['IMPORT', 'HOOK']) {
      assert.equal(source.split('/* HK_TERMINAL_PRECHECK_' + marker + '_BEGIN */').length, 2, 'Missing or repeated terminal proof integration: ' + file);
    }
  }
  await writeFile(resolve(root, 'dist/assets/terminal-policy-verified.js'), 'export const TERMINAL_POLICY_ID=' + JSON.stringify(verified.policyId) + ';\n');
  console.log('Verified terminal ingress policy:', verified.profileId, verified.policyId);
  return verified;
}
