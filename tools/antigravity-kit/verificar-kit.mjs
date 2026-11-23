import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Anchors of the selected candidate, independent of the extracted metadata.
const anchors = Object.freeze({
  zip: 'a8ece334ce8878f7d85863fd3ff569b8a52bc36baa826c1cc125dce45b0e4f8e',
  inventory: '5ce7d52643e40af55bfb595a14552f4af84b48b943e65eddf324c5ab48106408',
});
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

export function verifyKit(directory, expected = anchors) {
  const root = path.resolve(directory);
  const read = file => {
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('Expected a regular kit file.');
    if (stat.size > 32 * 1024 * 1024) throw new Error('Kit file exceeds verification budget.');
    return fs.readFileSync(file);
  };
  const json = name => JSON.parse(read(path.join(root, name)).toString('utf8').replace(/^\uFEFF/, ''));
  const directoryAt = file => {
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Expected a real directory, without links.');
  };
  directoryAt(root);
  for (const relative of ['.agents', '.agents/plugins', '.agents/plugins/br-dev-compliance']) directoryAt(path.join(root, relative));
  try {
    fs.lstatSync(path.join(root, '.agents/skills'));
    throw new Error('Standalone workspace skills found; use the fresh kit folder.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const release = json('release.json');
  const inventoryBytes = read(path.join(root, 'inventory.json'));
  const inventoryHash = digest(inventoryBytes);
  if (inventoryHash !== expected.inventory || inventoryHash !== release.inventory_sha256) {
    throw new Error('Inventory hash differs from the selected candidate.');
  }
  const inventory = JSON.parse(inventoryBytes.toString('utf8').replace(/^\uFEFF/, ''));
  if (release.status !== 'local_candidate' || release.version !== '1.0.0' || release.license !== 'Apache-2.0'
      || inventory.status !== 'local_candidate' || inventory.packages?.antigravity?.version !== '1.0.0') {
    throw new Error('Unexpected release metadata.');
  }
  const zipName = 'br-dev-compliance-antigravity-1.0.0.zip';
  const archives = Array.isArray(release.archives) ? release.archives.filter(row => row.client === 'antigravity') : [];
  if (archives.length !== 1 || archives[0].file !== zipName || archives[0].sha256 !== expected.zip || archives[0].files !== 14) {
    throw new Error('Unexpected Antigravity archive metadata.');
  }
  const zipHash = digest(read(path.join(root, zipName)));
  if (zipHash !== expected.zip) throw new Error('ZIP hash differs from the selected candidate.');
  const checksums = read(path.join(root, 'SHA256SUMS.txt')).toString('utf8').split(/\r?\n/);
  if (!checksums.includes(expected.zip + '  ' + zipName)) throw new Error('Expected ZIP checksum is missing.');
  const rows = inventory.packages.antigravity.files;
  if (!Array.isArray(rows) || rows.length !== 14) throw new Error('Expected a 14-file plugin inventory.');
  const files = new Map();
  for (const row of rows) {
    if (typeof row.path !== 'string' || !row.path || /[\\:\u0000-\u001f]/.test(row.path)
        || row.path.startsWith('/') || row.path.split('/').some(part => !part || part === '.' || part === '..')
        || files.has(row.path) || !/^[a-f0-9]{64}$/.test(row.sha256)) throw new Error('Unsafe or duplicated inventory path.');
    files.set(row.path, row.sha256);
  }
  const plugin = path.join(root, '.agents/plugins/br-dev-compliance');
  let entries = 0, count = 0;
  function walk(current, relative = '', depth = 0) {
    if (depth > 12) throw new Error('Plugin directory depth exceeds verification budget.');
    for (const name of fs.readdirSync(current)) {
      if (++entries > 128) throw new Error('Plugin entry count exceeds verification budget.');
      const file = path.join(current, name), key = relative ? relative + '/' + name : name;
      const stat = fs.lstatSync(file);
      if (stat.isSymbolicLink()) throw new Error('Links are not accepted in the plugin payload.');
      if (stat.isDirectory()) walk(file, key, depth + 1);
      else {
        if (!stat.isFile() || !files.has(key)) throw new Error('Unexpected plugin file: ' + key);
        if (digest(read(file)) !== files.get(key)) throw new Error('Plugin hash differs from inventory: ' + key);
        count++;
      }
    }
  }
  walk(plugin);
  if (count !== 14) throw new Error('Extracted plugin file count differs from inventory.');
  const manifest = JSON.parse(read(path.join(plugin, 'plugin.json')).toString('utf8'));
  if (manifest.name !== 'br-dev-compliance' || manifest.version !== '1.0.0' || manifest.license !== 'Apache-2.0') {
    throw new Error('Unexpected native plugin manifest.');
  }
  return {
    status: 'package_verified', version: manifest.version, plugin_files: count,
    zip_sha256: zipHash, inventory_sha256: inventoryHash, plugin_location: '.agents/plugins/br-dev-compliance',
    runtime: 'node', runtime_version: process.version, native_discovery_verified: false,
    cli_probe: 'not_performed', files_written_by_script: 0,
    note: 'Package integrity only. No PowerShell, subprocess, network, audit, or policy change is performed.',
  };
}

function isEntrypoint() {
  if (!process.argv[1]) return false;
  try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}
if (isEntrypoint()) {
  try {
    if (process.argv.length > 3) throw new Error('Usage: node verificar-kit.mjs [kit-directory]');
    console.log(JSON.stringify(verifyKit(process.argv[2] || path.dirname(fileURLToPath(import.meta.url))), null, 2));
  } catch (error) {
    console.log(JSON.stringify({ status: 'blocked', error: error.message, files_written_by_script: 0 }));
    process.exitCode = 1;
  }
}
