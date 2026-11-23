import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const claudePlugin = 'plugins/br-dev-compliance';
const references = ['fontes.md', 'historico.md', 'historico.schema.json', 'metodo.md',
  'preparacao.md', 'resultado.schema.json', 'verificacoes.md'];
const claudeFiles = [
  '.claude-plugin/plugin.json', 'LICENSE', 'NOTICE', 'TRADEMARKS.md', 'README.md',
  'assets/icon.png', 'agents/auditor.md', 'hooks/hooks.json',
  ...references.map(name => 'referencias/' + name),
  ...['audit-output', 'checkpoint', 'history', 'result-validation'].map(name => 'scripts/' + name + '.ps1'),
  ...['auditar', 'auditar-plano', 'auditar-entrega', 'cobertura', 'executar-auditoria'].map(name => 'skills/' + name + '/SKILL.md'),
];
const codexFiles = [
  '.codex-plugin/plugin.json', 'LICENSE', 'NOTICE', 'TRADEMARKS.md', 'README.md',
  'assets/icon.png', 'fluxo.md', 'hooks/hooks.json',
  'scripts/checkpoint.ps1', 'scripts/projeto.ps1', 'scripts/validate-result.mjs',
  'skills/auditar/SKILL.md', 'skills/cobertura/SKILL.md',
  ...claudeFiles.filter(name => !['LICENSE', 'NOTICE', 'TRADEMARKS.md', 'README.md', 'assets/icon.png'].includes(name)).map(name => 'shared/' + name),
];
const antigravitySkill = 'skills/br-dev-compliance-auditar';
const antigravityFiles = [
  'plugin.json', 'LICENSE', 'NOTICE', 'TRADEMARKS.md', 'README.md', 'assets/icon.png',
  'agents/br-dev-compliance-auditor.md',
  ...['SKILL.md', 'validacao.md', 'scripts/validate-result.mjs'].map(name => antigravitySkill + '/' + name),
  ...['fontes.md', 'metodo.md', 'resultado.schema.json', 'verificacoes.md']
    .map(name => antigravitySkill + '/shared/referencias/' + name),
];

async function copyFile(from, to) {
  if (!(await fs.lstat(from)).isFile()) throw new Error('Expected a regular file: ' + from);
  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.copyFile(from, to);
}

async function inventory(directory, relative = '') {
  const files = [];
  for (const entry of await fs.readdir(path.join(directory, relative), { withFileTypes: true })) {
    const name = relative ? relative + '/' + entry.name : entry.name;
    if (entry.isDirectory()) {
      files.push(...await inventory(directory, name));
    } else if (entry.isFile()) {
      const contents = await fs.readFile(path.join(directory, name));
      files.push({ path: name, sha256: createHash('sha256').update(contents).digest('hex') });
    } else {
      throw new Error('Unexpected package entry: ' + name);
    }
  }
  return files.sort((a, b) => a.path < b.path ? -1 : a.path === b.path ? 0 : 1);
}

async function inspect(directory, files, manifest, license) {
  const entries = await inventory(directory);
  const expected = new Set(files);
  const actual = new Set(entries.map(entry => entry.path));
  const missing = files.filter(name => !actual.has(name));
  const unexpected = [...actual].filter(name => !expected.has(name));
  if (missing.length || unexpected.length) {
    throw new Error(JSON.stringify({ directory, missing, unexpected }));
  }
  const descriptor = JSON.parse(await fs.readFile(path.join(directory, manifest), 'utf8'));
  if (descriptor.name !== 'br-dev-compliance' || descriptor.version !== '1.0.0'
      || descriptor.license !== 'Apache-2.0') {
    throw new Error('Unexpected plugin name or version in ' + manifest);
  }
  for (const name of ['LICENSE', 'NOTICE', 'TRADEMARKS.md']) {
    const expectedNotice = await fs.readFile(path.join(root, name));
    if (!expectedNotice.equals(await fs.readFile(path.join(directory, path.dirname(license), name)))) {
      throw new Error('Package notice differs from the project: ' + directory + '/' + name);
    }
  }
  return { version: descriptor.version, files: entries };
}

function build(tool) {
  return execFileSync(process.execPath, [path.join(root, 'tools', tool)], { encoding: 'utf8' }).trim();
}

const outputRoot = path.join(root, '.test-output');
await fs.mkdir(outputRoot, { recursive: true });
const candidate = await fs.mkdtemp(path.join(outputRoot, 'rc-'));
const claude = path.join(candidate, 'claude');
const codex = path.join(candidate, 'codex');
const antigravity = path.join(candidate, 'antigravity');
const claudeMarketplace = '.claude-plugin/marketplace.json';
const codexMarketplace = '.agents/plugins/marketplace.json';
const claudePaths = [claudeMarketplace, 'LICENSE', 'NOTICE', 'TRADEMARKS.md', ...claudeFiles.map(name => claudePlugin + '/' + name)];
for (const name of claudePaths) {
  await copyFile(path.join(root, name), path.join(claude, name));
}

await fs.cp(build('build-codex-plugin.mjs'), codex, { recursive: true });
await fs.cp(build('build-antigravity-plugin.mjs'), antigravity, { recursive: true });
const codexPaths = [codexMarketplace, ...codexFiles.map(name => claudePlugin + '/' + name)];
const packages = {
  claude: await inspect(claude, claudePaths, claudePlugin + '/.claude-plugin/plugin.json', 'LICENSE'),
  codex: await inspect(codex, codexPaths, claudePlugin + '/.codex-plugin/plugin.json', claudePlugin + '/LICENSE'),
  antigravity: await inspect(antigravity, antigravityFiles, 'plugin.json', 'LICENSE'),
};
for (const name of ['LICENSE', 'NOTICE', 'TRADEMARKS.md']) {
  const claudeNotice = await fs.readFile(path.join(claude, claudePlugin, name));
  if (!claudeNotice.equals(await fs.readFile(path.join(claude, name)))) {
    throw new Error('Claude plugin notice differs from the marketplace: ' + name);
  }
}

const report = { status: 'local_candidate', packages };
await fs.writeFile(path.join(candidate, 'inventory.json'), JSON.stringify(report, null, 2) + '\n');
console.log(candidate);
