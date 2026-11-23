// Maintainer-only: aggregate usage from one explicitly selected test transcript.
// Does not print prompts, responses, tool arguments, credentials, or reasoning.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {evidencePath} from './p3-evaluation.mjs';
import {reviewLocalSources} from './validate-result.mjs';

const file = path.resolve(process.argv[2] ?? '');
if (!file.endsWith('.jsonl') || !file.includes('projeto-revisao-legal-br-dev-compliance-evals-workspace')) {
  throw new Error('Select a JSONL transcript from the synthetic evaluation workspace.');
}
const fields = ['input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens', 'output_tokens'];
const auditPath = process.argv[4] ? evidencePath(process.argv[4]) : null;
if (auditPath && fs.statSync(auditPath).size > 65536) throw new Error('Audit exceeds result size limit.');
let audit = null;
let auditParseError = false;
if (auditPath) {
  const raw = fs.readFileSync(auditPath, 'utf8');
  try { audit = JSON.parse(raw); } catch { auditParseError = true; }
}
const workspace = fileURLToPath(new URL('../evals/workspace', import.meta.url));
const reviewableSources = Array.isArray(audit?.sources) && audit.sources.every(source =>
  typeof source?.location === 'string' && Array.isArray(source.fragments) &&
  source.fragments.every(fragment => typeof fragment?.excerpt === 'string'));
const expectedLocalReads = new Set((reviewableSources ? audit.sources : [])
  .filter(source => source.status === 'consultada' && source.location.startsWith('repo:'))
  .map(source => source.location.slice(5)));
const observedReads = new Map();
function summarize(transcript) {
  const messages = new Map();
  const durations = [];
  let malformed = 0;
  const timestamps = [];
  const tools = new Map();
  const localReadIds = new Map();
  const cases = new Set();
  const hookFeedback = { plan_reminder_records: 0, delivery_reminder_records: 0 };
  for (const line of fs.readFileSync(transcript, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (line.includes('BR Dev Compliance: antes das acoes dependentes do plano')) hookFeedback.plan_reminder_records++;
    if (line.includes('BR Dev Compliance: houve mudanca no repositorio')) hookFeedback.delivery_reminder_records++;
    let entry;
    try { entry = JSON.parse(line); } catch { malformed++; continue; }
    const timestamp = Date.parse(entry.timestamp);
    if (Number.isFinite(timestamp)) timestamps.push(timestamp);
    if (entry.type === 'system' && entry.subtype === 'turn_duration' && Number.isFinite(entry.durationMs)) {
      durations.push(entry.durationMs);
    }
    const message = entry.message;
    if (entry.type === 'user') {
      const texts = typeof message?.content === 'string' ? [message.content] :
        Array.isArray(message?.content) ? message.content.filter(block => block.type === 'text').map(block => block.text) : [];
      for (const text of texts) {
        const commandArgs = String(text).match(/<command-args>([\s\S]*?)<\/command-args>/)?.[1];
        const marker = (commandArgs ?? String(text)).match(/^(?:\/br-dev-compliance:[a-z-]+\s+)?(P[0-9]+-[A-Z0-9-]+)/);
        if (marker) cases.add(marker[1]);
      }
      for (const block of Array.isArray(message?.content) ? message.content : []) {
        const relative = localReadIds.get(block.tool_use_id);
        if (block.type !== 'tool_result' || !relative || block.is_error || typeof block.content !== 'string') continue;
        const lines = block.content.split(/\r?\n/).filter(line => /^\s*\d+\t/.test(line));
        if (!lines.length) continue;
        const excerpt = lines.map(line => line.replace(/^\s*\d+\t/, '')).join('\n');
        const texts = observedReads.get(relative) ?? [];
        texts.push(excerpt);
        observedReads.set(relative, texts);
      }
    }
    if (entry.type === 'assistant' && Array.isArray(message?.content)) {
      for (const block of message.content) {
        if (block.type !== 'tool_use' || !block.id) continue;
        const name = String(block.name);
        const metadata = { name, timestamp: entry.timestamp };
        if (name === 'Agent') metadata.run_in_background = block.input?.run_in_background ?? 'not_supplied';
        if (name === 'Skill') metadata.skill = block.input?.skill;
        if (name === 'Read') {
          const base = path.basename(String(block.input?.file_path ?? ''));
          metadata.file = ['preparacao.md', 'metodo.md', 'fontes.md', 'verificacoes.md', 'resultado.schema.json', 'p1-fonte-nao-oficial.md', 'EXEMPLO.md', 'auto-01.ts', 'auto-06.ts', 'auto-formal.ts'].includes(base) ? base : '<other>';
          const requested = block.input?.file_path;
          if (expectedLocalReads.size && typeof requested === 'string' && path.isAbsolute(requested)) {
            const relative = path.relative(workspace, requested).split(path.sep).join('/');
            if (expectedLocalReads.has(relative)) localReadIds.set(block.id, relative);
          }
        }
        tools.set(block.id, metadata);
      }
    }
    if (entry.type !== 'assistant' || !message?.id || !message.usage) continue;
    const previous = messages.get(message.id) ?? {};
    for (const key of fields) {
      if (Number.isFinite(message.usage[key])) previous[key] = Math.max(previous[key] ?? 0, message.usage[key]);
    }
    messages.set(message.id, previous);
  }
  const usage = Object.fromEntries(fields.map(key => [key, [...messages.values()].reduce((sum, u) => sum + (u[key] ?? 0), 0)]));
  return { file: path.basename(transcript), assistant_requests: messages.size, ...usage,
    cases: [...cases],
    hook_feedback_records: hookFeedback,
    native_turn_duration_ms: durations,
    tools: [...tools.values()],
    transcript_span_ms: timestamps.length ? Math.max(...timestamps) - Math.min(...timestamps) : null,
    malformed_lines: malformed };
}
const main = summarize(file);
const childDirectory = path.join(path.dirname(file), path.basename(file, '.jsonl'), 'subagents');
const subagents = fs.existsSync(childDirectory) ? fs.readdirSync(childDirectory)
  .filter(name => name.endsWith('.jsonl')).map(name => summarize(path.join(childDirectory, name))) : [];
const totals = Object.fromEntries(fields.map(key => [key, main[key] + subagents.reduce((sum, child) => sum + child[key], 0)]));
const report = { main, subagents, totals,
  note: 'Native usage counters, deduplicated by assistant message ID within each transcript. Cached input is repeated consumption, not unique context. Transcript span includes waiting/idle time; it is not model latency. Missing/unlogged work is not inferred; price not calculated.' };
if (auditPath) {
  report.local_source_review = {
    audit_id: audit?.audit_id ?? null,
    audit_parse_error: auditParseError,
    observed_files: observedReads.size,
    issues: reviewableSources ? reviewLocalSources(audit, observedReads) : null,
  };
}
if (process.argv[3]) {
  const destination = evidencePath(process.argv[3]);
  if (destination === auditPath) throw new Error('Report cannot replace the audit.');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ saved: destination, assistant_requests: main.assistant_requests, subagents: subagents.length, totals }));
} else console.log(JSON.stringify(report, null, 2));
