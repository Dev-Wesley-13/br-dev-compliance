// Shared by maintainer tools and Node-based adapters. Claude uses its PowerShell validator.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundledSchema = new URL('../shared/referencias/resultado.schema.json', import.meta.url);
const sourceSchema = path.join(root, 'plugins/br-dev-compliance/referencias/resultado.schema.json');
export const schema = JSON.parse(fs.readFileSync(fs.existsSync(sourceSchema) ? sourceSchema : bundledSchema, 'utf8'));
export const checkIds = new Set(schema.$defs.check_id.enum);

// Implements only the keywords used by this fixed schema, not arbitrary JSON Schema.
function shape(value, spec, location, errors) {
  if (spec.$ref) spec = schema.$defs[spec.$ref.split('/').at(-1)];
  if (Object.hasOwn(spec, 'const') && value !== spec.const) errors.push(`${location}:const`);
  if (spec.enum && !spec.enum.includes(value)) errors.push(`${location}:enum`);
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  if (spec.type) {
    const types = Array.isArray(spec.type) ? spec.type : [spec.type];
    if (!types.includes(type) && !(types.includes('integer') && Number.isInteger(value))) {
      errors.push(`${location}:type`); return;
    }
  }
  if (type === 'object') {
    for (const key of spec.required ?? []) if (!Object.hasOwn(value, key)) errors.push(`${location}.${key}:required`);
    for (const [key, child] of Object.entries(value)) {
      if (spec.properties?.[key]) shape(child, spec.properties[key], `${location}.${key}`, errors);
      else if (spec.additionalProperties === false) errors.push(`${location}:unknown_property`);
    }
  }
  if (type === 'array') {
    if (value.length < (spec.minItems ?? 0) || value.length > (spec.maxItems ?? Infinity)) errors.push(`${location}:items`);
    if (spec.uniqueItems && new Set(value.map(item => JSON.stringify(item))).size !== value.length) errors.push(`${location}:duplicate`);
    if (spec.items) value.forEach((item, index) => shape(item, spec.items, `${location}[${index}]`, errors));
  }
  if (type === 'string') {
    if (value.length < (spec.minLength ?? 0) || value.length > (spec.maxLength ?? Infinity)) errors.push(`${location}:length`);
    if (spec.pattern && !new RegExp(spec.pattern).test(value)) errors.push(`${location}:pattern`);
    if (spec.format === 'date-time') {
      const parsed = Date.parse(value);
      if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value) || !Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 19) !== value.slice(0, 19)) errors.push(`${location}:date_time`);
    }
  }
  if (type === 'number' && (value < (spec.minimum ?? -Infinity) || value > (spec.maximum ?? Infinity))) errors.push(`${location}:range`);
}

function unique(items, key, location, errors) {
  if (new Set(items.map(item => item[key])).size !== items.length) errors.push(`${location}:duplicate_id`);
}

export function validateResult(audit) {
  const errors = [];
  try {
    if (Buffer.byteLength(JSON.stringify(audit), 'utf8') > 65536) errors.push('$:size_limit');
    shape(audit, schema, '$', errors);
  } catch { errors.push('$:invalid_input'); }
  if (errors.length) return { valid: false, errors, legal_verification: 'not_performed' };
  unique(audit.coverage, 'check_id', '$.coverage', errors);
  unique(audit.sources, 'id', '$.sources', errors);
  unique(audit.findings, 'id', '$.findings', errors);
  const sources = new Map(audit.sources.map(source => [source.id, source]));
  const coverage = new Map(audit.coverage.map(check => [check.check_id, check]));
  const examined = new Set(audit.scope.examined);
  let remoteAttempts = 0;
  let incomplete = !audit.sources.some(source => source.status === 'consultada' && source.fragments.length && source.kind !== 'metadados') || !audit.coverage.length;
  const official = new Set(['www.planalto.gov.br', 'www2.camara.leg.br', 'legis.senado.leg.br', 'normas.leg.br', 'www.gov.br', 'dspace.mj.gov.br']);
  for (const [index, source] of audit.sources.entries()) {
    const at = `$.sources[${index}]`;
    const local = source.location.startsWith('repo:');
    if (local) {
      const relative = source.location.slice(5);
      if (relative === 'plano') errors.push(`${at}:virtual_plan_is_not_local_source`);
      if (!relative || /(^|[\\/])\.\.([\\/]|$)|^[\\/]|:/.test(relative) || !examined.has(relative)) errors.push(`${at}:local_source_outside_scope`);
      if (!['licenca', 'metadados'].includes(source.kind)) errors.push(`${at}:local_source_not_normative`);
      if (source.attempts !== 0) errors.push(`${at}:local_source_remote_attempts`);
    } else {
      try {
        const url = new URL(source.location);
        const originalLgpd = url.hostname === 'legis.senado.leg.br' && /^\/norma\/27457334\/publicacao\/27457731\/?$/i.test(url.pathname);
        if (originalLgpd && (/consolidad|compilad|atualizad|consolidat|updated/i.test(source.version ?? '') ||
            (source.edition_kind != null && source.edition_kind !== 'original'))) {
          errors.push(at + ':incorrect_publication_edition');
        }
        if (url.protocol !== 'https:' || url.username || url.password) errors.push(`${at}:source_url`);
        if (['norma', 'ato_regulatorio'].includes(source.kind) && !official.has(url.hostname)) errors.push(`${at}:untrusted_normative_origin`);
      } catch { errors.push(`${at}:source_url`); }
      remoteAttempts += source.attempts;
    }
    unique(source.fragments, 'locator', `${at}.fragments`, errors);
    if (source.status === 'nao_consultada') {
      if (source.accessed_at !== null || source.attempts !== 0 || source.fragments.length) errors.push(`${at}:unperformed_access`);
    } else {
      if ((!local && source.attempts < 1) || (source.status === 'consultada' && !source.accessed_at)) errors.push(`${at}:access_evidence_missing`);
      if (Date.parse(source.accessed_at) > Date.parse(audit.generated_at)) errors.push(`${at}:future_access`);
    }
    if (source.status === 'indisponivel' && (source.fragments.length || !source.limitation)) errors.push(`${at}:unavailable_source`);
  }
  if (remoteAttempts > 3) errors.push('$.sources:query_budget');
  for (const [index, finding] of audit.findings.entries()) {
    const at = `$.findings[${index}]`;
    if (!['indicio', 'insuficiente'].includes(coverage.get(finding.check_id)?.status)) errors.push(`${at}:coverage_conflict`);
    for (const evidence of finding.evidence) {
      if (![...examined].some(location => evidence.location === location || evidence.location.startsWith(location + ':'))) errors.push(`${at}:evidence_outside_scope`);
    }
    if (!finding.citations.length || finding.missing_context.length || finding.confidence === 'insuficiente') incomplete = true;
    for (const citation of finding.citations) {
      const source = sources.get(citation.source_id);
      if (!source) { errors.push(`${at}:unknown_source`); continue; }
      if (citation.location_status === 'localizada') {
        if (source.status !== 'consultada' || !source.fragments.some(fragment => fragment.locator === citation.locator)) errors.push(`${at}:locator_not_confirmed`);
      }
      if (source.status !== 'consultada' && citation.location_status !== 'nao_consultada') errors.push(`${at}:access_conflict`);
      if (citation.support_status === 'sustenta') {
        if (citation.location_status !== 'localizada') errors.push(`${at}:unsupported_citation`);
        if (citation.claim_kind === 'obrigacao' && !['norma', 'ato_regulatorio'].includes(source.kind)) errors.push(`${at}:guide_or_metadata_is_not_law`);
        if (citation.claim_kind === 'licenciamento' && source.kind !== 'licenca') errors.push(`${at}:not_license_source`);
      }
      if (citation.location_status !== 'localizada' || citation.support_status !== 'sustenta') incomplete = true;
    }
  }
  for (const check of audit.coverage) {
    if (['insuficiente', 'nao_examinado'].includes(check.status)) incomplete = true;
    if (check.status === 'indicio' && !audit.findings.some(finding => finding.check_id === check.check_id)) errors.push('$.coverage:missing_finding');
  }
  if (audit.status === 'concluida_no_escopo' && (incomplete || !audit.scope.examined.length)) errors.push('$.status:incomplete_cannot_be_complete');
  if (audit.status === 'nao_executada' && (audit.findings.length || audit.coverage.length)) errors.push('$.status:unexecuted_with_findings');
  if (audit.status !== 'concluida_no_escopo' && !audit.scope.limitations.length) errors.push('$.scope:missing_limitation');
  return { valid: errors.length === 0, errors: [...new Set(errors)], legal_verification: 'not_performed' };
}

export function reviewLocalSources(audit, observedReads) {
  const normalizeText = text => text.replace(/\s+/gu, ' ').trim();
  const issues = [];
  for (const source of audit.sources) {
    if (source.status !== 'consultada' || !source.location.startsWith('repo:')) continue;
    const relative = source.location.slice(5);
    const texts = observedReads.get(relative) ?? [];
    if (relative === 'plano' || texts.length === 0) {
      issues.push({ source_id: source.id, code: 'local_read_not_observed' });
      continue;
    }
    const readTexts = texts.map(normalizeText);
    for (const fragment of source.fragments) {
      const excerpt = normalizeText(fragment.excerpt);
      if (!excerpt || !readTexts.some(text => text.includes(excerpt))) {
        issues.push({ source_id: source.id, locator: fragment.locator, code: 'local_excerpt_not_observed' });
      }
    }
  }
  return issues;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let result;
  try {
    const input = process.argv[2] === '-' ? 0 : process.argv[2];
    // Windows PowerShell can prepend a UTF-8 BOM when piping to a native program.
    const text = fs.readFileSync(input, 'utf8').replace(/^\uFEFF/u, '');
    result = validateResult(JSON.parse(text));
  }
  catch { result = { valid: false, errors: ['$:invalid_json_or_file'], legal_verification: 'not_performed' }; }
  console.log(JSON.stringify(result));
  process.exitCode = result.valid ? 0 : 1;
}
