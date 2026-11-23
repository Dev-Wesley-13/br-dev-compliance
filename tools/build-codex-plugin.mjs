import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const adapter = path.join(root, 'plugins/br-dev-compliance-codex');
const shared = path.join(root, 'plugins/br-dev-compliance');
const { version } = JSON.parse(await fs.readFile(path.join(adapter, '.codex-plugin/plugin.json'), 'utf8'));
// Build a fresh marketplace so stale files cannot leak into a package.
const outputRoot = path.join(root, '.test-output');
await fs.mkdir(outputRoot, { recursive: true });
const output = await fs.mkdtemp(path.join(outputRoot, 'codex-marketplace-' + version + '-'));
const plugin = path.join(output, 'plugins/br-dev-compliance');
await fs.mkdir(path.join(output, '.agents/plugins'), { recursive: true });
await fs.copyFile(path.join(root, 'codex/.agents/plugins/marketplace.json'), path.join(output, '.agents/plugins/marketplace.json'));
await fs.cp(adapter, plugin, { recursive: true });
for (const name of ['LICENSE', 'NOTICE', 'TRADEMARKS.md']) {
  await fs.copyFile(path.join(root, name), path.join(plugin, name));
}
await fs.copyFile(path.join(root, 'tools/validate-result.mjs'), path.join(plugin, 'scripts/validate-result.mjs'));
// Preserve the original method fingerprint and on-disk schema for both clients.
// This subtree is data and bundled helpers. The Codex manifest exposes only its own skills.
await fs.cp(shared, path.join(plugin, 'shared'), {
  recursive: true,
  filter: file => !['README.md', 'LICENSE', 'NOTICE', 'TRADEMARKS.md'].includes(path.basename(file))
    && file !== path.join(shared, 'assets'),
});
console.log(output);
