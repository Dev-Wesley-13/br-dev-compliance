import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = data => createHash('sha256').update(data).digest('hex');

test('1.0 packages preserve notices, exact inventories and executable result validation', t => {
  const candidate = execFileSync(process.execPath, [path.join(root, 'tools/build-release-candidate.mjs')], { encoding: 'utf8' }).trim();
  assert.equal(path.dirname(candidate), path.join(root, '.test-output'));
  t.after(() => fs.rmSync(candidate, { recursive: true, force: true }));
  const report = JSON.parse(fs.readFileSync(path.join(candidate, 'inventory.json'), 'utf8'));
  assert.deepEqual(Object.keys(report.packages).sort(), ['antigravity', 'claude', 'codex']);
  assert.equal(report.status, 'local_candidate');
  assert.equal(hash(fs.readFileSync(path.join(root, 'LICENSE'))), 'cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30');
  const fixture = JSON.parse(fs.readFileSync(path.join(root, 'evals/results/antigravity/ag-g01-audit.json'), 'utf8'));
  for (const [client, inventory] of Object.entries(report.packages)) {
    const directory = path.join(candidate, client);
    const plugin = client === 'antigravity' ? directory : path.join(directory, 'plugins/br-dev-compliance');
    assert.equal(inventory.version, '1.0.0');
    const actual = fs.readdirSync(directory, { recursive: true }).filter(name => fs.lstatSync(path.join(directory, name)).isFile())
      .map(name => name.split(path.sep).join('/')).sort();
    assert.deepEqual(actual, inventory.files.map(entry => entry.path).sort());
    for (const entry of inventory.files) {
      assert.equal(hash(fs.readFileSync(path.join(directory, entry.path))), entry.sha256, `${client}:${entry.path}`);
      assert.ok(!entry.path.includes('.test-output') && !entry.path.includes('.br-dev-compliance/'));
    }
    for (const name of ['LICENSE', 'NOTICE', 'TRADEMARKS.md']) {
      assert.deepEqual(fs.readFileSync(path.join(plugin, name)), fs.readFileSync(path.join(root, name)));
    }
    const validator = path.join(plugin, client === 'codex' ? 'scripts/validate-result.mjs'
      : client === 'claude' ? 'scripts/validate-result.mjs'
        : 'skills/br-dev-compliance-auditar/scripts/validate-result.mjs');
    // Claude uses a PowerShell validator in the client; validate the bundled schema with the maintainer tool.
    const command = client === 'claude' ? path.join(root, 'tools/validate-result.mjs') : validator;
    const invoke = audit => spawnSync(process.execPath, [command, '-'], { input: JSON.stringify(audit), encoding: 'utf8' });
    const valid = invoke(fixture);
    assert.equal(valid.status, 0, valid.stderr || valid.stdout);
    assert.equal(JSON.parse(valid.stdout).valid, true);
    const invalid = invoke({ ...fixture, certificado: true });
    assert.notEqual(invalid.status, 0);
    assert.equal(JSON.parse(invalid.stdout).valid, false);
    const schema = client === 'claude' ? path.join(plugin, 'referencias/resultado.schema.json')
      : client === 'codex' ? path.join(plugin, 'shared/referencias/resultado.schema.json')
        : path.join(plugin, 'skills/br-dev-compliance-auditar/shared/referencias/resultado.schema.json');
    assert.deepEqual(fs.readFileSync(schema), fs.readFileSync(path.join(root, 'plugins/br-dev-compliance/referencias/resultado.schema.json')));
  }
});
