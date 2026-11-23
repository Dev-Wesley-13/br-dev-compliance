import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { verifyKit } from '../tools/antigravity-kit/verificar-kit.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const tool = fileURLToPath(new URL('../tools/antigravity-kit/verificar-kit.mjs', import.meta.url));
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brdc-kit 'test'-"));
  t.after(() => {
    assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(root).startsWith("brdc-kit 'test'-"));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const plugin = path.join(root, '.agents/plugins/br-dev-compliance');
  fs.mkdirSync(plugin, { recursive: true });
  const files = [];
  for (let index = 0; index < 14; index++) {
    const name = index === 0 ? 'plugin.json' : `ref-${index}.txt`;
    const bytes = index === 0 ? JSON.stringify({ name: 'br-dev-compliance', version: '1.0.0', license: 'Apache-2.0' }) : 'synthetic-' + index;
    fs.writeFileSync(path.join(plugin, name), bytes);
    files.push({ path: name, sha256: digest(bytes) });
  }
  // Deliberately synthetic archive bytes: tests integrity relationships, not ZIP extraction.
  const archive = 'synthetic test archive', zipName = 'br-dev-compliance-antigravity-1.0.0.zip';
  fs.writeFileSync(path.join(root, zipName), archive);
  const inventory = JSON.stringify({ status: 'local_candidate', packages: { antigravity: { version: '1.0.0', files } } });
  fs.writeFileSync(path.join(root, 'inventory.json'), inventory);
  const expected = { zip: digest(archive), inventory: digest(inventory) };
  fs.writeFileSync(path.join(root, 'release.json'), JSON.stringify({ status: 'local_candidate', version: '1.0.0', license: 'Apache-2.0', inventory_sha256: expected.inventory, archives: [{ client: 'antigravity', file: zipName, sha256: expected.zip, files: 14 }] }));
  fs.writeFileSync(path.join(root, 'SHA256SUMS.txt'), expected.zip + '  ' + zipName + '\r\n');
  return { root, plugin, expected };
}
const snapshot = root => fs.readdirSync(root, { recursive: true }).filter(name => fs.lstatSync(path.join(root, name)).isFile())
  .sort().map(name => [name, digest(fs.readFileSync(path.join(root, name)))]);

test('Node verifier preserves the tree and distinguishes integrity from native discovery', t => {
  const f = fixture(t), before = snapshot(f.root), result = verifyKit(f.root, f.expected);
  assert.equal(result.status, 'package_verified');
  assert.equal(result.plugin_files, 14);
  assert.equal(result.native_discovery_verified, false);
  assert.equal(result.cli_probe, 'not_performed');
  assert.equal(result.files_written_by_script, 0);
  assert.deepEqual(snapshot(f.root), before);
});
test('tampered payload, missing files and extra files cannot pass', t => {
  const f = fixture(t), file = path.join(f.plugin, 'ref-1.txt');
  fs.appendFileSync(file, 'tampered');
  assert.throws(() => verifyKit(f.root, f.expected), /Plugin hash differs from inventory/);
  fs.unlinkSync(file);
  assert.throws(() => verifyKit(f.root, f.expected), /file count differs/);
  fs.writeFileSync(file, 'synthetic-1');
  fs.writeFileSync(path.join(f.plugin, 'unexpected.txt'), 'extra');
  assert.throws(() => verifyKit(f.root, f.expected), /Unexpected plugin file/);
});
test('rewriting inventory and release together cannot replace the pinned inventory', t => {
  const f = fixture(t), inventory = path.join(f.root, 'inventory.json');
  fs.appendFileSync(inventory, ' ');
  const releaseFile = path.join(f.root, 'release.json'), release = JSON.parse(fs.readFileSync(releaseFile));
  release.inventory_sha256 = digest(fs.readFileSync(inventory));
  fs.writeFileSync(releaseFile, JSON.stringify(release));
  assert.throws(() => verifyKit(f.root, f.expected), /Inventory hash differs from the selected candidate/);
});
test('an ancestor junction cannot redirect the plugin outside the kit', t => {
  const f = fixture(t), external = fs.mkdtempSync(path.join(os.tmpdir(), 'brdc-external-'));
  t.after(() => {
    assert.equal(path.dirname(fs.realpathSync(external)), fs.realpathSync(os.tmpdir()));
    fs.rmSync(external, { recursive: true, force: true });
  });
  const agents = path.join(f.root, '.agents');
  assert.equal(path.dirname(path.resolve(agents)), path.resolve(f.root));
  fs.rmSync(agents, { recursive: true, force: true });
  fs.symlinkSync(external, agents, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => verifyKit(f.root, f.expected), /real directory, without links/);
});
test('CLI reports a blocked kit even when Windows changes the entry path letter case', t => {
  const f = fixture(t), missing = path.join(f.root, 'missing');
  const entry = process.platform === 'win32' ? tool.toLowerCase() : tool;
  const response = spawnSync(process.execPath, [entry, missing], { encoding: 'utf8', timeout: 15000 });
  assert.ifError(response.error);
  assert.equal(response.status, 1, response.stderr || response.stdout);
  assert.equal(JSON.parse(response.stdout).status, 'blocked');
});
test('Restricted PowerShell blocks the ps1 while an existing permitted Node verifies independently', { skip: process.platform !== 'win32' }, t => {
  const f = fixture(t), shell = path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe');
  const psVerifier = fileURLToPath(new URL('../tools/antigravity-kit/verificar-kit.ps1', import.meta.url));
  const blocked = spawnSync(shell, ['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Restricted','-File',psVerifier,'-KitRoot',f.root], { encoding: 'utf8', timeout: 15000 });
  assert.ifError(blocked.error);
  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr + blocked.stdout, /UnauthorizedAccess|PSSecurityException/);
  const wrapper = path.join(f.root, 'node-test.mjs');
  fs.writeFileSync(wrapper, `import {verifyKit} from ${JSON.stringify(pathToFileURL(tool).href)};\nconsole.log(JSON.stringify(verifyKit(${JSON.stringify(f.root)},${JSON.stringify(f.expected)})));\n`);
  const literal = value => "'" + value.replaceAll("'", "''") + "'";
  const passed = spawnSync(shell, ['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Restricted','-Command','& ' + literal(process.execPath) + ' ' + literal(wrapper)], { encoding: 'utf8', timeout: 15000 });
  assert.ifError(passed.error);
  assert.equal(passed.status, 0, passed.stderr || passed.stdout);
  assert.equal(JSON.parse(passed.stdout).status, 'package_verified');
});
