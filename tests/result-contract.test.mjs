import test from 'node:test';
import assert from 'node:assert/strict';
import { validateResult, reviewLocalSources, checkIds } from '../tools/validate-result.mjs';

// Synthetic access ledger: exercises consistency, not actual consultation or legal correctness.
function sample() {
  return {
    schema_version: '1.0', audit_id: 'contract-fixture', generated_at: '2026-11-07T12:00:00Z',
    mode: 'plano', status: 'concluida_no_escopo', review_level: 'tecnica_sem_revisao_juridica_independente',
    scope: { examined: ['plano'], excluded: ['operacao', 'outras verificacoes'], limitations: [] },
    coverage: [{ check_id: 'LGPD-01', status: 'indicio', rationale: 'Plano descreve registro do objeto inteiro.' }],
    sources: [{ id: 'S-001', kind: 'norma', location: 'https://www2.camara.leg.br/legin/fed/lei/2018/lei-13709-14-agosto-2018-787077-normaatualizada-pl.html',
      status: 'consultada', accessed_at: '2026-11-07T11:00:00Z', version: null, attempts: 1,
      fragments: [{ locator: 'art. 46', excerpt: 'Texto sintético do ledger de teste; não usar como citação real.' }], limitation: null }],
    findings: [{ id: 'F-001', check_id: 'LGPD-01', confidence: 'forte', impact: 'medio', summary: 'Objeto inteiro no log.',
      evidence: [{ location: 'plano:1', description: 'Intenção declarada no plano sintético.' }], rationale: 'Investigar proteção dos logs.',
      citations: [{ source_id: 'S-001', locator: 'art. 46', location_status: 'localizada', support_status: 'sustenta', claim_kind: 'obrigacao', rationale: 'Análise simulada de sustentação para exercitar o contrato.' }],
      missing_context: [], suggestion: 'Investigar necessidade e acesso aos logs.' }], decision: 'pendente',
  };
}
function invalid(change, code) {
  const audit = sample(); change(audit);
  const result = validateResult(audit);
  assert.equal(result.valid, false, JSON.stringify(result));
  assert.ok(result.errors.some(error => error.includes(code)), JSON.stringify(result));
  assert.equal(result.legal_verification, 'not_performed');
}

test('valid contract does not certify truth, authenticity, or legality', () => {
  assert.deepEqual(validateResult(sample()), { valid: true, errors: [], legal_verification: 'not_performed' });
});
test('canonical catalog contains exactly nine LGPD and four license checks', () => {
  assert.equal([...checkIds].filter(id => id.startsWith('LGPD-')).length, 9);
  assert.equal([...checkIds].filter(id => id.startsWith('LIC-')).length, 4);
});
test('invented check IDs and unknown fields are rejected', () => {
  invalid(a => { a.findings[0].check_id = 'LGPD-LOG-01'; }, 'enum');
  invalid(a => { a.certificado = true; }, 'unknown_property');
});
test('unavailable source cannot provide a located reference', () => {
  invalid(a => { a.sources[0].status = 'indisponivel'; a.sources[0].fragments = []; a.sources[0].limitation = 'HTTP 403'; }, 'locator_not_confirmed');
});
test('article absent from source fragments cannot be declared located', () => {
  invalid(a => { a.findings[0].citations[0].locator = 'art. 999'; }, 'locator_not_confirmed');
});
test('opening a guide cannot turn its recommendation into a statutory obligation', () => {
  invalid(a => { a.sources[0].kind = 'guia'; }, 'guide_or_metadata_is_not_law');
});
test('an unrelated reference may be located but must remain unsupported and partial', () => {
  const a = sample(); a.status = 'parcial'; a.scope.limitations = ['Referência não sustenta o achado.'];
  a.findings[0].citations[0].support_status = 'nao_sustenta';
  assert.equal(validateResult(a).valid, true);
  a.status = 'concluida_no_escopo';
  assert.ok(validateResult(a).errors.includes('$.status:incomplete_cannot_be_complete'));
});
test('offline review remains partial with truthful failed access and pending citation', () => {
  const a = sample(); a.status = 'parcial'; a.scope.limitations = ['Fonte indisponível.'];
  Object.assign(a.sources[0], { status: 'indisponivel', fragments: [], limitation: 'HTTP 403' });
  Object.assign(a.findings[0].citations[0], { location_status: 'nao_consultada', support_status: 'pendente' });
  assert.equal(validateResult(a).valid, true);
});
test('failed preferred source does not invalidate a consulted official fallback', () => {
  const a = sample(); a.sources.push({ ...structuredClone(a.sources[0]), id: 'S-002', status: 'indisponivel', fragments: [], limitation: 'Acesso negado', location: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm' });
  assert.equal(validateResult(a).valid, true);
});
test('failed access may truthfully omit its exact instant but never become a successful lookup', () => {
  const a = sample(); a.status = 'parcial'; a.scope.limitations = ['Fonte indisponível; instante exato da tentativa não registrado.'];
  Object.assign(a.sources[0], { status: 'indisponivel', accessed_at: null, fragments: [], limitation: 'Falha de rede; sem acesso ao texto.' });
  Object.assign(a.findings[0].citations[0], { location_status: 'nao_consultada', support_status: 'pendente' });
  assert.equal(validateResult(a).valid, true);
  a.sources[0].status = 'consultada';
  assert.ok(validateResult(a).errors.some(error => error.includes('access_evidence_missing')));
});
test('unperformed lookup cannot contain dates, attempts, or extracted text', () => {
  invalid(a => { a.sources[0].status = 'nao_consultada'; }, 'unperformed_access');
});
test('future access and impossible calendar dates are rejected', () => {
  invalid(a => { a.sources[0].accessed_at = '2026-11-08T12:00:00Z'; }, 'future_access');
  invalid(a => { a.sources[0].accessed_at = '2026-02-31T12:00:00Z'; }, 'date_time');
});
test('unknown source IDs and duplicate IDs cannot silently redirect citations', () => {
  invalid(a => { a.findings[0].citations[0].source_id = 'S-009'; }, 'unknown_source');
  invalid(a => { a.sources.push(structuredClone(a.sources[0])); }, 'duplicate_id');
});
test('unlisted evidence locations and path traversal in local sources are rejected', () => {
  invalid(a => { a.findings[0].evidence[0].location = 'private/customer.json:1'; }, 'evidence_outside_scope');
  invalid(a => { Object.assign(a.sources[0], { kind: 'licenca', location: 'repo:../private/LICENSE' }); }, 'local_source_outside_scope');
});
test('local package license can be read without installing or fetching dependencies', () => {
  const a = sample(); a.scope.examined.push('vendor/fixture/LICENSE');
  a.coverage[0].check_id = 'LIC-04'; a.findings[0].check_id = 'LIC-04';
  Object.assign(a.sources[0], { kind: 'licenca', location: 'repo:vendor/fixture/LICENSE', attempts: 0 });
  a.findings[0].citations[0].claim_kind = 'licenciamento';
  assert.equal(validateResult(a).valid, true);
  a.sources[0].attempts = 1;
  assert.ok(validateResult(a).errors.some(error => error.includes('local_source_remote_attempts')));
});
test('scope uses canonical locations, not descriptions or source URI prefixes', () => {
  invalid(a => { a.scope.examined = ['plano: descrição do plano']; }, 'pattern');
  invalid(a => { a.scope.examined = ['repo:LICENSE']; }, 'pattern');
});
test('the virtual plan is evidence and never a repository source', () => {
  invalid(a => {
    a.sources.push({
      id: 'S-002', kind: 'metadados', location: 'repo:plano', status: 'consultada',
      accessed_at: a.generated_at, version: null, attempts: 0, fragments: [], limitation: null,
    });
  }, 'virtual_plan_is_not_local_source');
});
test('local provenance requires a matching observed read and literal excerpt', () => {
  const audit = { sources: [{
    id: 'S-001', location: 'repo:vendor/LICENSE', status: 'consultada',
    fragments: [{ locator: 'lines 1–2', excerpt: 'Keep the notice.' }],
  }] };
  assert.deepEqual(reviewLocalSources(audit, new Map([['LICENSE', ['Keep the notice.']]])), [
    { source_id: 'S-001', code: 'local_read_not_observed' },
  ]);
  assert.deepEqual(reviewLocalSources(audit, new Map([['vendor/LICENSE', ['A different excerpt.']]])), [
    { source_id: 'S-001', locator: 'lines 1–2', code: 'local_excerpt_not_observed' },
  ]);
  assert.deepEqual(reviewLocalSources(audit, new Map([['vendor/LICENSE', ['Keep the\r\nnotice.']]])), []);
});
test('a local file cannot impersonate an authoritative law', () => {
  invalid(a => { a.scope.examined.push('law.md'); a.sources[0].location = 'repo:law.md'; }, 'local_source_not_normative');
});
test('normative origin is matched by hostname, not substring', () => {
  invalid(a => { a.sources[0].location = 'https://www.gov.br.example.invalid/anpd'; }, 'untrusted_normative_origin');
});
test('query budget prevents a complete-looking report from hiding excess lookups', () => {
  invalid(a => { a.sources[0].attempts = 3; a.sources.push({ ...structuredClone(a.sources[0]), id: 'S-002', attempts: 1 }); }, 'query_budget');
});
test('coverage and findings cannot contradict one another', () => {
  invalid(a => { a.coverage[0].status = 'sem_indicio'; }, 'coverage_conflict');
  invalid(a => { a.findings = []; }, 'missing_finding');
});
test('unknown context or unexamined coverage prevents completed status', () => {
  invalid(a => { a.findings[0].missing_context.push('Retenção dos logs.'); }, 'incomplete_cannot_be_complete');
  invalid(a => { a.coverage.push({ check_id: 'LGPD-07', status: 'nao_examinado', rationale: 'Sem evidência.' }); }, 'incomplete_cannot_be_complete');
});
test('unexecuted, malformed, oversized and review-claiming results are rejected appropriately', () => {
  invalid(a => { a.status = 'nao_executada'; }, 'unexecuted_with_findings');
  invalid(a => { a.review_level = 'parecer_juridico'; }, 'const');
  invalid(a => { a.findings[0].summary = 'x'.repeat(70000); }, 'size_limit');
  assert.equal(validateResult(null).valid, false);
});

test('V05 original Senate publication cannot support a consolidated edition label', () => {
  const audit = sample();
  const source = audit.sources[0];
  source.location = 'https://legis.senado.leg.br/norma/27457334/publicacao/27457731?origem=teste#art6';
  source.version = 'Texto consolidado';
  assert.equal(validateResult(audit).valid, false);
  source.version = 'Publicação original (DOU 15/08/2018)';
  source.edition_kind = 'original';
  source.last_amendment = null;
  assert.equal(validateResult(audit).valid, true);
  source.edition_kind = 'atualizado';
  assert.equal(validateResult(audit).valid, false);
});
