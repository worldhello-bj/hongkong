import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {verifyTerminalResolverPolicy} from '../../scripts/terminal-policy/verify-policy.mjs';

test('production terminal proof is enabled only for the reviewed resolver and exact integration', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const result = await verifyTerminalResolverPolicy(root);
  assert.equal(result.verified, true, JSON.stringify(result.profiles));
  assert.equal(result.policyId, 'hongkong-public-terminal-ingress-v1');
  const generated = await readFile(new URL('../../dist/assets/terminal-policy-verified.js', import.meta.url), 'utf8');
  assert.match(generated, /export const TERMINAL_POLICY_ID="hongkong-public-terminal-ingress-v1";/);
  for (const file of ['src/navigation/main.recovered.js', 'dist/assets/main-integrated.js']) {
    const source = await readFile(new URL('../../' + file, import.meta.url), 'utf8');
    assert.equal(source.split('/* HK_TERMINAL_PRECHECK_HOOK_BEGIN */').length, 2);
    assert.equal(source.split('/* HK_TERMINAL_PRECHECK_IMPORT_BEGIN */').length, 2);
  }
});
