// Collects receipts from the synthetic Claude workspace. This tool never calls a model.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import { evidencePath } from './p3-evaluation.mjs';
import { validateResult } from './validate-result.mjs';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspace = path.join(project, 'evals', 'workspace');
const pluginRefs = path.join(project, 'plugins', 'br-dev-compliance', 'referencias');
const internalSkill = 'br-dev-compliance:executar-auditoria';
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const parseJson = value => {
  if (typeof value !== 'string') return null;
  try { return JSON.parse(value); } catch { return null; }
};
const normalizePath = file => path.resolve(workspace, file).toLowerCase();
const referenceFiles = new Set(['preparacao.md', 'metodo.md', 'verificacoes.md', 'fontes.md', 'resultado.schema.json']
  .map(file => normalizePath(path.join(pluginRefs, file))));
const hostTools = new Set(['mcp__ccd_turn__update_plan', 'mcp__ccd_turn__wrap_up']);
const clockCommand = /^date -u (?:['"]?\+['"]?)%Y-%m-%dT%H:%M:%SZ['"]?$/;
const utc = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/;

function transcript(file) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  return lines.flatMap((line, index) => {
    if (!line.trim()) return [];
    const entry = parseJson(line);
    if (entry) return [entry];
    // A concurrent append can leave the last line incomplete.
    if (index === lines.length - 1) return [];
    throw Error('invalid-transcript-line: ' + path.basename(file));
  });
}

function blocks(entries, type) {
  return entries.filter(entry => entry.type === type).flatMap(entry =>
    Array.isArray(entry.message?.content)
      ? entry.message.content.map(block => ({ ...block, timestamp: entry.timestamp }))
      : []);
}

function recordAttempt(run, evidenceDir, session, detail) {
  const file = path.join(evidenceDir, 'attempts', run.run_id + '-' + session + '.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) writeJson(file, detail);
  run.failed_attempts ??= [];
  const relative = path.relative(project, file).split(path.sep).join('/');
  if (!run.failed_attempts.includes(relative)) run.failed_attempts.push(relative);
}

const planFile = evidencePath(process.argv[2] ?? '');
const evidenceDir = path.dirname(planFile);
const transcriptDir = fs.realpathSync(process.argv[3] ?? '');
if (!path.basename(transcriptDir).endsWith('br-dev-compliance-evals-workspace')) {
  throw Error('expected-synthetic-Claude-workspace-transcript-directory');
}
const plan = readJson(planFile);
const envelope = readJson(path.join(evidenceDir, 'envelope.json'));
const promptById = new Map(envelope.prompts.map(row => [row.audit_id, row]));
const runs = new Map(plan.runs.map(run => [run.run_id, run]));
const auditIdPattern = /(?:^|\s)audit_id (p3-[a-z0-9-]+),/;
const counts = { captured: 0, interrupted: 0, rejected: 0 };

for (const file of fs.readdirSync(transcriptDir).filter(name => /^[a-f0-9-]+\.jsonl$/.test(name))) {
  const mainPath = path.join(transcriptDir, file);
  if (fs.statSync(mainPath).mtimeMs < Date.parse(envelope.date + 'T00:00:00-03:00')) continue;
  const main = transcript(mainPath);
  const prompt = main.find(entry => entry.type === 'user' && typeof entry.message?.content === 'string' &&
    promptById.has(entry.message.content.match(auditIdPattern)?.[1]))?.message.content;
  if (!prompt) continue;
  const id = prompt.match(auditIdPattern)[1];
  const slot = promptById.get(id);
  const run = runs.get(slot.run_id);
  if (!run || run.state === 'executed') continue;
  if (run.state === 'execution_failed' && run.failure_reason !== 'provider-rate-limit') continue;
  const rateLimited = main.some(entry => entry.type === 'assistant' && entry.error === 'rate_limit');
  const ended = main.some(entry => entry.subtype === 'stop_hook_summary');
  if (!ended && !rateLimited) continue;

  const session = path.basename(file, '.jsonl');
  const agentDir = path.join(transcriptDir, session, 'subagents');
  const agents = fs.existsSync(agentDir)
    ? fs.readdirSync(agentDir).filter(name => name.endsWith('.jsonl')).map(name => transcript(path.join(agentDir, name)))
    : [];
  const child = agents.flat();
  const mainTools = blocks(main, 'assistant').filter(block => block.type === 'tool_use');
  const childTools = blocks(child, 'assistant').filter(block => block.type === 'tool_use');
  const allTools = mainTools.concat(childTools);
  const results = blocks(main, 'user').concat(blocks(child, 'user')).filter(block => block.type === 'tool_result');
  const resultFor = tool => results.find(result => result.tool_use_id === tool?.id);
  const skill = mainTools.find(tool => tool.name === 'Skill' && tool.input?.skill === internalSkill);
  const hookEvent = main.find(entry => entry.attachment?.type === 'hook_success' &&
    entry.attachment.hookName === 'PostToolUse:Skill' && entry.attachment.toolUseID === skill?.id);
  const hook = parseJson(hookEvent?.attachment.stdout)?.hookSpecificOutput;
  const hookResult = parseJson(hook?.updatedToolOutput?.result);
  const deliveredText = resultFor(skill)?.content;
  const delivered = typeof deliveredText === 'string' ? parseJson(deliveredText.split('\n\nResult:\n').at(-1)) : null;
  const first = blocks(child, 'assistant').find(block => block.type === 'text' && block.text.trim())?.text ?? null;
  const promptMatches = prompt.includes(slot.prompt.slice(slot.prompt.indexOf(' ') + 1));
  const marker = hook?.additionalContext ?? null;
  const acceptedMarker = ['retorno validado', 'retorno normalizado e validado']
    .some(prefix => marker === 'BR Dev Compliance: ' + prefix + ' ' + id + '.');
  const accepted = !!hookResult && hookResult.audit_id === id && acceptedMarker &&
    isDeepStrictEqual(delivered, hookResult) && validateResult(hookResult).valid;
  if (rateLimited || !accepted) {
    recordAttempt(run, evidenceDir, session, { audit_id: id, session_id: session, provider_rate_limited: rateLimited,
      prompt_matches: promptMatches, first_auditor_text: first, native_validation: marker });
    run.state = 'execution_failed';
    run.failure_reason = rateLimited ? 'provider-rate-limit' : 'missing-validated-handoff';
    counts[rateLimited ? 'interrupted' : 'rejected']++;
    continue;
  }
  const local = slot.file ? normalizePath(slot.file) : null;
  const authorizedPath = file => typeof file === 'string' &&
    (normalizePath(file) === local || referenceFiles.has(normalizePath(file)));
  const reads = allTools.filter(tool => tool.name === 'Read');
  const localRead = reads.find(tool => typeof tool.input?.file_path === 'string' && normalizePath(tool.input.file_path) === local);
  const localResult = resultFor(localRead);
  const clock = mainTools.find(tool => tool.name === 'Bash' && clockCommand.test((tool.input?.command ?? '').trim()));
  const clockText = resultFor(clock)?.content?.trim?.() ?? '';
  const unknown = allTools.filter(tool => !hostTools.has(tool.name) &&
    !(tool.name === 'Read' && authorizedPath(tool.input?.file_path)) &&
    !(tool.name === 'Grep' && mainTools.includes(tool) && authorizedPath(tool.input?.path)) &&
    tool !== clock && tool !== skill).map(tool => tool.name);
  const auditPath = path.join(evidenceDir, id + '.json');
  const hookPath = path.join(evidenceDir, id + '-hook.json');
  const firstPath = path.join(evidenceDir, id + '-first.txt');
  const metricsPath = path.join(evidenceDir, id + '-metrics.json');
  const tracePath = path.join(evidenceDir, id + '-trace.json');
  const relative = file => path.relative(project, file).split(path.sep).join('/');
  if (!fs.existsSync(auditPath)) fs.writeFileSync(auditPath, hook.updatedToolOutput.result, { flag: 'wx' });
  if (!fs.existsSync(hookPath)) writeJson(hookPath, hook);
  if (first && !fs.existsSync(firstPath)) fs.writeFileSync(firstPath, first, { flag: 'wx' });
  if (!fs.existsSync(metricsPath)) {
    const measurement = spawnSync(process.execPath, [path.join(project, 'tools', 'measure-session.mjs'),
      mainPath, relative(metricsPath), relative(auditPath)], { cwd: project, encoding: 'utf8', timeout: 15000 });
    if (measurement.status !== 0) throw Error(measurement.stderr || 'session-measurement-failed');
  }

  const efforts = entries => [...new Set(entries.filter(entry => entry.type === 'api-request')
    .map(entry => entry.params?.output_config?.effort))];
  const medium = entries => isDeepStrictEqual(efforts(entries), ['medium']);
  const models = [...new Set(main.concat(child).filter(entry => entry.type === 'assistant' &&
    entry.message?.model && !entry.message.model.startsWith('<')).map(entry => entry.message.model))];
  const modelMatches = isDeepStrictEqual(models, ['claude-sonnet-5-5']) && medium(main) && agents.length === 1 && medium(agents[0]);
  const versions = [...new Set(main.filter(entry => entry.type === 'assistant' && entry.version).map(entry => entry.version))];
  const correctionRequests = child.filter(entry => entry.attachment?.hookName === 'SubagentStop' &&
    entry.attachment.type === 'hook_blocking_error').length;
  writeJson(tracePath, { audit_id: id, session_id: session, provider_rate_limited: false, native_validation: marker,
    native_matches_persisted_result: true, first_contract: validateResult(parseJson(first)).valid,
    first_response_path: first ? relative(firstPath) : null, native_hook_path: relative(hookPath),
    submitted_envelope_matches: promptMatches, runtime_version: versions, models, contract: validateResult(hookResult),
    raw_path: relative(auditPath), raw_bytes: fs.statSync(auditPath).size, coverage: hookResult.coverage,
    trace: { single_auditor: agents.length === 1, correction_requests: correctionRequests,
      skill_calls: mainTools.filter(tool => tool.name === 'Skill').length,
      exact_read_scope: reads.every(tool => authorizedPath(tool.input?.file_path)), unexpected_tools: unknown,
      no_model_writes: !allTools.some(tool => ['Write', 'Edit', 'NotebookEdit'].includes(tool.name) ||
        (tool.name === 'Bash' && tool !== clock)),
      clock_matches: utc.test(clockText) && clockText === hookResult.generated_at,
      clock_after_local_read: local ? !!localResult && !localResult.is_error &&
        Date.parse(clock?.timestamp) >= Date.parse(localResult.timestamp) : null,
      local_timestamp_matches: local ? hookResult.sources.some(source =>
        source.location === 'repo:' + slot.file && source.status === 'consultada' && source.accessed_at === clockText && source.attempts === 0) : null,
      external_calls_observed: allTools.filter(tool => /^(?:WebFetch|WebSearch)$/.test(tool.name)).length },
    metrics_path: relative(metricsPath), technical_trace_review_pending: true });
  run.state = 'executed';
  delete run.failure_reason;
  run.result_path = relative(auditPath);
  run.metrics_path = relative(metricsPath);
  run.trace_path = relative(tracePath);
  run.raw_path = first ? relative(firstPath) : null;
  run.hook_path = relative(hookPath);
  run.environment = { ...envelope.environment, client_version: versions.join(','),
    model: modelMatches ? envelope.environment.model : models.join(',') };
  counts.captured++;
}

writeJson(planFile, plan);
console.log(JSON.stringify(counts));
