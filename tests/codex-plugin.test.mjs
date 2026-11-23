import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const claude = path.join(root, 'plugins/br-dev-compliance/scripts/history.ps1');
const auditFixture = new URL('../evals/results/p3/candidate-alpha33/p3-a33-p01-r3.json', import.meta.url);

test('Codex aggregates current coverage without moving or trusting a foreign history', { skip: process.platform !== 'win32' }, t => {
  const marketplace = execFileSync(process.execPath, [path.join(root, 'tools/build-codex-plugin.mjs')], { encoding: 'utf8' }).trim();
  const plugin = path.join(marketplace, 'plugins/br-dev-compliance');
  const codex = path.join(plugin, 'shared/scripts/history.ps1');
  const project = path.join(plugin, 'scripts/projeto.ps1');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'brdc-p4-test-'));
  for (const directory of [base, marketplace]) {
    const parent = directory === base ? os.tmpdir() : path.join(root, '.test-output');
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(parent));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  }
  const powershell = path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe');
  const invoke = (script, input, shell = script === claude ? powershell : 'pwsh.exe') => {
    const result = spawnSync(shell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', script], {
      input: JSON.stringify(input), encoding: 'utf8', timeout: 30000,
    });
    assert.ifError(result.error);
    assert.ok(result.stdout.trim(), result.stderr);
    return JSON.parse(result.stdout);
  };
  const createRepository = name => {
    const directory = path.join(base, name);
    fs.mkdirSync(directory);
    execFileSync('git', ['init', '-q', directory]);
    return directory;
  };
  const web = createRepository('web');
  const api = createRepository("api teste 'a'");
  const other = createRepository('outro produto');
  // Windows PowerShell 5.1 and PowerShell 7 collate this pair differently.
  for (const name of ['p3-native-manual.ts', 'p3-native-manual-28.ts']) {
    fs.writeFileSync(path.join(web, name), '');
  }
  const context = 'produto e premissas conhecidos';
  const plan = 'Plano sintético';
  const fixture = JSON.parse(fs.readFileSync(auditFixture, 'utf8'));
  const record = (helper, directory, auditId) => {
    const captured = invoke(helper, { action: 'capture', root: directory, scope: ['plano'], context, plan });
    assert.equal(captured.ok, true, JSON.stringify(captured));
    const result = invoke(helper, {
      action: 'record', root: directory, baseline: captured.baseline,
      audit: { ...fixture, audit_id: auditId, generated_at: new Date().toISOString() },
    });
    assert.equal(result.ok, true, JSON.stringify(result));
    return result.record_id;
  };
  const ids = [record(claude, web, 'p4-claude-test'), record(codex, api, 'p4-codex-test')];
  const directories = [web, api];
  const request = {
    product_id: 'produto-teste',
    repositories: directories.map((directory, index) => ({ id: index === 0 ? 'web' : 'api', root: directory, context, plan })),
    dependencies: [{ from: 'web', to: 'api' }],
  };
  const before = fs.readdirSync(base, { recursive: true }).sort();
  const report = invoke(project, request);
  assert.equal(report.written, false, JSON.stringify(report));
  assert.deepEqual(report.repositories.map(row => row.coverage.records[0].record_id), ids);
  assert.ok(report.repositories.every(row => row.coverage.records[0].freshness === 'correspondencia_tecnica_confirmada'));
  assert.equal(report.dependencies[0].status, 'analise_da_integracao_pendente');
  assert.deepEqual(fs.readdirSync(base, { recursive: true }).sort(), before);
  assert.equal(invoke(claude, { action: 'coverage', root: api, context, plan }).records[0].record_id, ids[1]);

  // Emulate a valid same-path record with a different machine policy fingerprint.
  const file = path.join(api, '.br-dev-compliance/auditorias', ids[1] + '.json');
  const envelope = JSON.parse(fs.readFileSync(file, 'utf8'));
  const original = fs.readFileSync(file);
  envelope.payload.baseline.snapshot.policy_hash = '0'.repeat(64);
  const payload = JSON.stringify(envelope.payload);
  envelope.digest = createHash('sha256').update(payload).digest('hex');
  fs.writeFileSync(file, JSON.stringify(envelope));
  const transplanted = invoke(project, request).repositories[1].coverage;
  assert.equal(transplanted.records[0].record_id, ids[1]);
  assert.deepEqual(transplanted.records[0].reasons, ['policy_hash_alterado']);
  fs.writeFileSync(file, original);

  request.repositories[1].context += ' mudou';
  assert.deepEqual(invoke(project, request).repositories[1].coverage.records[0].reasons, ['context_hash_alterado']);
  request.repositories[1].root = web;
  assert.equal(invoke(project, request).error, 'overlapping-roots');

  fs.mkdirSync(path.join(other, '.br-dev-compliance'));
  fs.copyFileSync(path.join(api, '.br-dev-compliance/projeto.json'), path.join(other, '.br-dev-compliance/projeto.json'));
  request.repositories[1].root = other;
  assert.equal(invoke(project, request).repositories[1].coverage.error, 'foreign-or-invalid-project');
});
