import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const validator = path.join(root, 'tools/validate-result.mjs');
const raw = fs.readFileSync(path.join(root, 'evals/results/release-1.0/ag-r1-02-audit.json'), 'utf8').trimEnd();
const valid = { valid: true, errors: [], legal_verification: 'not_performed' };
const invoke = input => spawnSync(process.execPath, [validator, '-'], { input, encoding: 'utf8' });
const quotePS = text => `'${text.replaceAll("'", "''")}'`;

test('audit stdin accepts UTF-8 with or without one leading BOM', () => {
  for (const input of [raw, `\uFEFF${raw}`]) {
    const result = invoke(input);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.deepEqual(JSON.parse(result.stdout), valid);
  }
});

test('a transport BOM does not relax JSON parsing or audit validation', () => {
  for (const input of ['\uFEFF', `\uFEFF\uFEFF${raw}`, `\uFEFF${raw} trailing`, `\uFEFF${raw.slice(0, -1)}`]) {
    const result = invoke(input);
    assert.equal(result.status, 1);
    assert.deepEqual(JSON.parse(result.stdout), {
      valid: false, errors: ['$:invalid_json_or_file'], legal_verification: 'not_performed',
    });
  }
  const audit = JSON.parse(raw);
  audit.certificado = true;
  const result = invoke(`\uFEFF${JSON.stringify(audit)}`);
  assert.equal(result.status, 1);
  assert.ok(JSON.parse(result.stdout).errors.includes('$:unknown_property'));
});

test('audit file input accepts the same UTF-8 BOM as stdin', t => {
  fs.mkdirSync(path.join(root, '.test-output'), { recursive: true });
  const parent = fs.realpathSync(path.join(root, '.test-output'));
  const directory = fs.mkdtempSync(path.join(parent, 'result-transport-'));
  t.after(() => {
    assert.equal(path.dirname(fs.realpathSync(directory)), parent);
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const file = path.join(directory, 'audit.json');
  fs.writeFileSync(file, `\uFEFF${raw}`);
  const result = spawnSync(process.execPath, [validator, file], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), valid);
});

test('Windows PowerShell 5.1 pipes the audit with the documented UTF8 encoding without BOM', { skip: process.platform !== 'win32' }, () => {
  assert.ok(!/^'@/mu.test(raw), 'Fixture must remain safe inside a literal here-string.');
  const command = [
    // Encoding.UTF8 has a preamble in Windows PowerShell 5.1. After earlier
    // native hooks it can emit two BOMs; that is not the documented transport.
    // Keep the validator strict and use the same no-preamble encoding as users.
    '$utf8NoBom = [System.Text.UTF8Encoding]::new($false)',
    '$OutputEncoding = $utf8NoBom',
    '[Console]::OutputEncoding = $utf8NoBom',
    "@'", raw, `'@ | & ${quotePS(process.execPath)} ${quotePS(validator)} -`,
    'exit $LASTEXITCODE',
  ].join('\r\n');
  const result = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command], {
    encoding: 'utf8', timeout: 15_000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout.replace(/^\uFEFF/u, '')), valid);
});
