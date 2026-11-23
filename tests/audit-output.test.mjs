import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { validateResult } from '../tools/validate-result.mjs';

const root = new URL('../', import.meta.url);
const script = new URL('plugins/br-dev-compliance/scripts/audit-output.ps1', root);
const windowsPowerShell = path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe');
const skill = 'br-dev-compliance:executar-auditoria';
const fixture = name => JSON.parse(fs.readFileSync(new URL('evals/results/p3/' + name, root), 'utf8'));
const extraScope = 'pilot-alpha29/p3-ret29-p02-r1.json';
const virtualSource = 'candidate-alpha28/p3-a28-p02-r1.json';

function check(audit, invokedSkill = skill) {
  return invoke({
    hook_event_name: 'PostToolUse',
    tool_name: 'Skill',
    tool_input: { skill: invokedSkill },
    tool_response: {
      success: true,
      commandName: invokedSkill,
      status: 'forked',
      agentId: 'fixture-agent',
      result: typeof audit === 'string' ? audit : JSON.stringify(audit),
    },
  })?.hookSpecificOutput ?? null;
}

function invoke(event) {
  const result = spawnSync(windowsPowerShell, [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-File', fileURLToPath(script),
  ], { input: JSON.stringify(event), encoding: 'utf8', timeout: 15000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim() ? JSON.parse(result.stdout) : null;
}

test('empty extra scope fields from real first responses are removed without changing findings', () => {
  for (const file of [extraScope, 'candidate-alpha28/p3-a28-p07-r1.json', 'candidate-alpha31/p3-a31-m02-r1-first.txt']) {
    const raw = fixture(file);
    assert.equal(validateResult(raw).valid, false);
    const validated = check(raw);
    assert.match(validated.additionalContext, /retorno normalizado e validado/);
    assert.equal(validated.updatedToolOutput.agentId, 'fixture-agent');
    const final = JSON.parse(validated.updatedToolOutput.result);
    assert.equal(validateResult(final).valid, true);
    assert.deepEqual(final.findings, raw.findings);
    assert.deepEqual(final.coverage, raw.coverage);
    assert.deepEqual(Object.keys(final.scope), ['examined', 'excluded', 'limitations']);
  }
});

test('only the plugin auditor gets one request to correct malformed output', () => {
  const audit = fixture(extraScope);
  audit.scope.excluded_note = 'Material ambiguity';
  const event = {
    hook_event_name: 'SubagentStop',
    agent_type: 'br-dev-compliance:auditor',
    stop_hook_active: false,
    last_assistant_message: JSON.stringify(audit),
  };
  const request = invoke(event);
  assert.equal(request.decision, 'block');
  assert.match(request.reason, /result-unknown-property/);
  assert.equal(invoke({ ...event, stop_hook_active: true }), null);
  assert.equal(invoke({ ...event, agent_type: 'other-plugin:auditor' }), null);
  assert.equal(invoke({ ...event, last_assistant_message: JSON.stringify(fixture(extraScope)) }), null);
});

test('the virtual chat source can be dropped only without access or linked citations', () => {
  const raw = fixture(virtualSource);
  const output = check(raw);
  const final = JSON.parse(output.updatedToolOutput.result);
  assert.equal(validateResult(final).valid, true);
  assert.deepEqual(final.sources, []);
  assert.ok(final.scope.limitations.includes(raw.sources[0].limitation));
  assert.deepEqual(final.findings, raw.findings);
  raw.findings[0].citations.push({ source_id: raw.sources[0].id });
  const refused = check(raw);
  assert.match(refused.additionalContext, /retorno recusado/);
  assert.doesNotMatch(refused.updatedToolOutput.result, /schema_version/);
});

test('material unexpected fields and malformed output are withheld; other skills are ignored', () => {
  const raw = fixture(extraScope);
  raw.scope.excluded_note = 'An additional material limitation.';
  const refused = check(raw);
  assert.match(refused.additionalContext, /retorno recusado/);
  assert.doesNotMatch(refused.updatedToolOutput.result, /schema_version/);
  assert.match(check('invalid JSON').additionalContext, /retorno recusado/);
  assert.equal(check(raw, 'other-plugin:review'), null);
});

test('both validators accept the official Senate publication and reject lookalike hosts', () => {
  const url = new URL('evals/results/p4/codex-fonte-oficial-2026-11-14.json', root);
  const audit = JSON.parse(fs.readFileSync(url, 'utf8'));
  audit.sources[1].location = 'https://legis.senado.leg.br/norma/27457334/publicacao/27457731';
  audit.sources[1].version = 'Publicação original';
  assert.equal(validateResult(audit).valid, true);
  assert.match(check(audit).additionalContext, /retorno validado/);

  audit.sources[1].location = 'https://legis.senado.leg.br.example.invalid/norma/27457334';
  assert.match(validateResult(audit).errors.join(), /untrusted_normative_origin/);
  assert.match(check(audit).additionalContext, /retorno recusado/);
});
