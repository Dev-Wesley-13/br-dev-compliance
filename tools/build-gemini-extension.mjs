import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const adapter = path.join(root, 'plugins/br-dev-compliance-gemini');
const references = path.join(root, 'plugins/br-dev-compliance/referencias');
const { version } = JSON.parse(await fs.readFile(path.join(adapter, 'gemini-extension.json'), 'utf8'));

const outputRoot = path.join(root, '.test-output');
await fs.mkdir(outputRoot, { recursive: true });
const output = await fs.mkdtemp(path.join(outputRoot, 'gemini-extension-' + version + '-'));
await fs.cp(adapter, output, { recursive: true });
for (const name of ['LICENSE', 'NOTICE', 'TRADEMARKS.md']) {
  await fs.copyFile(path.join(root, name), path.join(output, name));
}

// Gemini grants read access to the activated skill directory.
const skill = path.join(output, 'skills/br-dev-compliance-auditar');
const bundledReferences = path.join(skill, 'shared/referencias');
await fs.mkdir(bundledReferences, { recursive: true });
for (const name of ['metodo.md', 'verificacoes.md', 'fontes.md', 'resultado.schema.json']) {
  await fs.copyFile(path.join(references, name), path.join(bundledReferences, name));
}

await fs.mkdir(path.join(skill, 'scripts'), { recursive: true });
await fs.copyFile(path.join(root, 'tools/validate-result.mjs'), path.join(skill, 'scripts/validate-result.mjs'));
console.log(output);
