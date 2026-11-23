import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'plugins/br-dev-compliance/scripts/checkpoint.ps1');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'br-dev-compliance-p0-'));
const powershell = path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe');
const environment = { ...process.env, GIT_CONFIG_GLOBAL: 'NUL', GIT_CONFIG_NOSYSTEM: '1' };
environment.CLAUDE_PLUGIN_OPTION_MODO = 'automatico';
const timings = [];
let sequence = 0;

after(() => {
  const target = path.resolve(scratch);
  assert.equal(path.dirname(target), path.resolve(os.tmpdir()));
  assert.ok(path.basename(target).startsWith('br-dev-compliance-p0-'));
  fs.rmSync(target, { recursive: true, force: true });
  const ordered = timings.toSorted((a, b) => a - b);
  console.log(JSON.stringify({ local_hook_processes: timings.length,
    median_ms: Math.round(ordered[Math.floor(ordered.length / 2)]),
    max_ms: Math.round(ordered.at(-1)), model_calls: 0,
    note: 'Local process timings; Claude integration and token usage not measured.' }));
});

function git(repo, ...args) {
  return execFileSync('git.exe', args, { cwd: repo, env: environment, encoding: 'utf8', timeout: 5000 });
}
function repo(name = `repo ${++sequence} d'agua`) {
  const directory = path.join(scratch, name);
  fs.mkdirSync(directory);
  git(directory, 'init', '--quiet');
  fs.writeFileSync(path.join(directory, 'app.txt'), 'initial');
  git(directory, 'add', '--', 'app.txt');
  git(directory, '-c', 'user.name=P0', '-c', 'user.email=p0@example.invalid', 'commit', '-qm', 'fixture');
  return directory;
}
function hook(directory, event = 'Stop', fields = {}, env = {}, raw) {
  const started = performance.now();
  const output = execFileSync(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', script], {
    cwd: directory, env: { ...environment, ...env }, timeout: 12000, encoding: 'utf8',
    input: raw ?? JSON.stringify({ cwd: directory, session_id: 'p0-session', hook_event_name: event, ...fields }),
  }).replace(/^\uFEFF/, '').trim();
  timings.push(performance.now() - started);
  if (!output) return null;
  const result = JSON.parse(output);
  assert.equal(result.decision, undefined);
  assert.equal(result.hookSpecificOutput?.permissionDecision, undefined);
  return result;
}
const start = (directory, fields) => hook(directory, 'UserPromptSubmit', fields);
function notification(result, event = 'Stop') {
  assert.equal(result?.hookSpecificOutput?.hookEventName, event, JSON.stringify(result));
  assert.ok(result.hookSpecificOutput.additionalContext.length > 0);
}

test('package declares one native agent, four public skills, a fork helper, and non-blocking hooks', () => {
  const plugin = path.join(root, 'plugins/br-dev-compliance');
  const manifest = JSON.parse(fs.readFileSync(path.join(plugin, '.claude-plugin/plugin.json'), 'utf8'));
  const marketplace = JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin/marketplace.json'), 'utf8'));
  assert.equal(marketplace.plugins[0].name, manifest.name);
  assert.equal(path.resolve(root, marketplace.plugins[0].source), plugin);
  assert.equal(fs.readdirSync(path.join(plugin, 'agents')).length, 1);
  const auditor = fs.readFileSync(path.join(plugin, 'agents/auditor.md'), 'utf8');
  assert.match(auditor, /^tools: Read$/m);
  assert.match(auditor, /^disallowedTools: .*\bGrep\b.*\bGlob\b/m);
  const skills = fs.readdirSync(path.join(plugin, 'skills'));
  assert.equal(skills.length, 5);
  const helper = fs.readFileSync(path.join(plugin, 'skills/executar-auditoria/SKILL.md'), 'utf8');
  assert.match(helper, /^user-invocable: false$/m);
  assert.match(helper, /^context: fork$/m);
  assert.match(helper, /^background: false$/m);
  const config = JSON.parse(fs.readFileSync(path.join(plugin, 'hooks/hooks.json'), 'utf8'));
  assert.ok(!config.hooks.PreToolUse);
  for (const groups of Object.values(config.hooks)) {
    for (const group of groups) for (const handler of group.hooks) {
      assert.equal(handler.onFailure, 'continue');
      assert.ok(handler.timeout <= 10);
      assert.equal(handler.async, undefined);
      assert.equal(handler.command, 'powershell.exe');
      assert.ok(fs.existsSync(handler.args.at(-1).replace('${CLAUDE_PLUGIN_ROOT}', plugin)));
    }
  }
});

test('no change is silent, including a repository already dirty before the prompt', () => {
  const r = repo();
  fs.writeFileSync(path.join(r, 'app.txt'), 'existing dirty state');
  assert.equal(start(r), null);
  assert.equal(hook(r), null);
});

test('a nested Windows workspace can save and replace checkpoint state', () => {
  const name = ('nested-workspace-').padEnd(157 - scratch.length - 1, 'x');
  const r = repo(name);
  assert.equal(start(r), null);
  assert.equal(hook(r), null);
  fs.writeFileSync(path.join(r, 'app.txt'), 'updated');
  notification(hook(r));
  assert.equal(hook(r), null);
  const stateFiles = fs.readdirSync(path.join(r, '.br-dev-compliance/runtime'));
  assert.deepEqual(stateFiles.map(name => path.extname(name)).sort(), ['.json', '.lock']);
});

test('tracked changes notify once; operational state is pending, never audited', () => {
  const r = repo(); start(r);
  fs.writeFileSync(path.join(r, 'app.txt'), 'logger.info(user)');
  notification(hook(r));
  assert.equal(hook(r), null);
  assert.equal(hook(r, 'Stop', { stop_hook_active: true }), null);
  const stateDir = path.join(r, '.br-dev-compliance/runtime');
  const state = JSON.parse(fs.readFileSync(path.join(stateDir, fs.readdirSync(stateDir).find(n => n.endsWith('.json')))));
  assert.equal(state.audit_status, 'pending');
  assert.equal(state.audited, undefined);
});

test('new file and later same-length edit of that untracked file both notify', () => {
  const r = repo(); start(r);
  const file = path.join(r, 'new file.js');
  fs.writeFileSync(file, 'send(email)'); notification(hook(r));
  start(r); fs.writeFileSync(file, 'send(phone)'); notification(hook(r));
});

test('staged deletion and a commit during the turn are detected', () => {
  const r = repo(); start(r);
  fs.unlinkSync(path.join(r, 'app.txt')); git(r, 'add', '-u'); notification(hook(r));
  start(r); git(r, '-c', 'user.name=P0', '-c', 'user.email=p0@example.invalid', 'commit', '-qm', 'delete');
  notification(hook(r));
});

test('history writes never create another delivery checkpoint', () => {
  const r = repo(); start(r);
  fs.writeFileSync(path.join(r, '.br-dev-compliance/resumo.md'), 'pending');
  assert.equal(hook(r), null);
});

test('manual and disabled modes produce no checkpoint or state', () => {
  for (const mode of ['manual', 'desligado']) {
    const r = repo();
    assert.equal(hook(r, 'UserPromptSubmit', {}, { CLAUDE_PLUGIN_OPTION_MODO: mode }), null);
    fs.writeFileSync(path.join(r, 'app.txt'), 'changed');
    assert.equal(hook(r, 'Stop', {}, { CLAUDE_PLUGIN_OPTION_MODO: mode }), null);
    assert.equal(fs.existsSync(path.join(r, '.br-dev-compliance')), false);
  }
});

test('formal plan reminder only responds to ExitPlanMode', () => {
  const r = repo();
  notification(hook(r, 'PostToolUse', { tool_name: 'ExitPlanMode' }), 'PostToolUse');
  assert.equal(hook(r, 'PostToolUse', { tool_name: 'Read' }), null);
});

test('invalid and unresolved modes report incomplete configuration without audit or state', () => {
  for (const mode of [undefined, '', 'invalid', '${user_config.modo}']) {
    const r = repo();
    const result = hook(r, 'UserPromptSubmit', {}, { CLAUDE_PLUGIN_OPTION_MODO: mode });
    assert.ok(result?.systemMessage);
    assert.equal(result.hookSpecificOutput, undefined);
    assert.equal(fs.existsSync(path.join(r, '.br-dev-compliance')), false);
  }
});

test('invalid input is non-blocking and visibly unconfirmed; no Git repository is silent', () => {
  const r = repo();
  assert.ok(hook(r, 'Stop', {}, {}, '{broken')?.systemMessage);
  assert.equal(hook(scratch), null);
});

test('corrupt state cannot certify the change and requests bounded review', () => {
  const r = repo(); start(r);
  const directory = path.join(r, '.br-dev-compliance/runtime');
  const file = fs.readdirSync(directory).find(n => n.endsWith('.json'));
  fs.writeFileSync(path.join(directory, file), '{broken');
  notification(hook(r));
});

test('repository without a first commit is supported', () => {
  const r = path.join(scratch, `unborn-${++sequence}`); fs.mkdirSync(r); git(r, 'init', '--quiet');
  start(r); fs.writeFileSync(path.join(r, 'first.txt'), 'created'); notification(hook(r));
});

test('separate sessions do not reuse each other baseline', () => {
  const r = repo(); start(r, { session_id: 'a' });
  fs.writeFileSync(path.join(r, 'app.txt'), 'changed'); start(r, { session_id: 'b' });
  assert.equal(hook(r, 'Stop', { session_id: 'b' }), null);
  notification(hook(r, 'Stop', { session_id: 'a' }));
});

test('state directory junction is refused and nothing is written outside the repository', () => {
  const r = repo(); const external = path.join(scratch, `external-${++sequence}`); fs.mkdirSync(external);
  fs.symlinkSync(external, path.join(r, '.br-dev-compliance'), 'junction');
  assert.ok(start(r)?.systemMessage);
  assert.deepEqual(fs.readdirSync(external), []);
});

test('snapshot budget is reported as partial and never presented as a successful audit', () => {
  const r = repo(); start(r);
  fs.writeFileSync(path.join(r, 'large.bin'), Buffer.alloc(17 * 1024 * 1024));
  notification(hook(r));
  const stateDir = path.join(r, '.br-dev-compliance/runtime');
  const state = JSON.parse(fs.readFileSync(path.join(stateDir, fs.readdirSync(stateDir).find(n => n.endsWith('.json')))));
  assert.equal(state.last_snapshot.complete, false);
  assert.equal(state.last_snapshot.skipped, 1);
  assert.equal(state.audit_status, 'pending');
});

test('repository fsmonitor program is not executed by Git discovery', () => {
  const r = repo(); const sentinel = path.join(r, 'executed.txt');
  fs.writeFileSync(path.join(r, 'monitor.sh'), '#!/bin/sh\ntouch executed.txt\n');
  git(r, 'config', 'core.fsmonitor', './monitor.sh');
  start(r); fs.writeFileSync(path.join(r, 'app.txt'), 'changed'); notification(hook(r));
  assert.equal(fs.existsSync(sentinel), false);
});
