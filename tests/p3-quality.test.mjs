import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createPlan,digest} from '../tools/p3-evaluation.mjs';
import {evaluateQuality} from '../tools/p3-quality.mjs';
const suite=JSON.parse(fs.readFileSync(new URL('../evals/p3-suite.json',import.meta.url)));
const criteria=JSON.parse(fs.readFileSync(new URL('../evals/p3-criteria-v1.json',import.meta.url)));
const fixture=()=>JSON.parse(fs.readFileSync(new URL('../evals/results/p1/p1-offline.json',import.meta.url)));
const plan=()=>({...createPlan(suite),criteria_sha256:digest(criteria)});

test('alpha17 target update preserves all numeric thresholds after the failed pilot',()=>{
 const next=JSON.parse(fs.readFileSync(new URL('../evals/p3-criteria-v2.json',import.meta.url)));
 for(const key of ['required_executions','raw_contract_valid_required','positive','clean','ambiguous','adversarial','critical_guards','critical_guard_failures_allowed','simple_audit_budget'])assert.deepEqual(next[key],criteria[key]);
 assert.notEqual(digest(next),digest(criteria));assert.equal(next.expected_environment.plugin_version,'0.1.0-alpha.17');
});
test('history-policy fix changes only the expected package version in alpha18 criteria',()=>{
 const next=JSON.parse(fs.readFileSync(new URL('../evals/p3-criteria-v3.json',import.meta.url)));
 for(const key of ['required_executions','raw_contract_valid_required','positive','clean','ambiguous','adversarial','critical_guards','critical_guard_failures_allowed','simple_audit_budget'])assert.deepEqual(next[key],criteria[key]);
 assert.notEqual(digest(next),digest(criteria));assert.equal(next.expected_environment.plugin_version,'0.1.0-alpha.18');
});

test('pending slots do not satisfy quality, budget or critical-review gates',()=>{
 const r=evaluateQuality(suite,plan(),criteria,()=>{throw Error('must not load pending evidence');});
 assert.equal(r.executions.pending,105);assert.equal(r.groups.positivo.correct,0);assert.equal(r.budgets.pending,105);assert.equal(r.critical_reviews.pending,105);assert.equal(r.implemented_gates_met,false);assert.equal(r.release_approved,false);
});

test('a complete technical evaluation can use provisional labels while legal review is pending',()=>{
 const p=plan();
 const cases=new Map(suite.cases.map(c=>[c.id,c]));
 const guards=new Set([...criteria.critical_guards,'scope_ok','no_fabricated_citation','citation_support_ok']);
 for(const run of p.runs){
  run.state='executed';
  run.environment=criteria.expected_environment;
  run.review={reviewer:'synthetic fixture',...Object.fromEntries([...guards].map(key=>[key,true]))};
 }
 const r=evaluateQuality(suite,p,criteria,run=>{
  const audit=fixture();
  const c=cases.get(run.case_id);
  const status=c.group==='adversarial'?'indicio':c.expected;
  audit.coverage=[{check_id:c.check_id,status,rationale:'Synthetic test evidence'}];
  audit.findings=status==='indicio'?[{...audit.findings[0],check_id:c.check_id,citations:[]}]:[];
  return {audit,resultBytes:4000,metrics:{main:{assistant_requests:6},subagents:[{}],totals:{input_tokens:1,cache_creation_input_tokens:1,cache_read_input_tokens:1,output_tokens:4000}}};
 });
 assert.equal(r.executions.valid_contract,105);
 assert.equal(r.technical_gates_met,true);
 assert.equal(r.gates.independent_label_review_declared,false);
 assert.equal(r.implemented_gates_met,false);
 assert.equal(r.release_approved,false);
});
test('criteria changes require a new binding rather than retroactive approval',()=>{
 const p=plan(),changed=structuredClone(criteria);changed.positive.minimum_correct=0;
 assert.throws(()=>evaluateQuality(suite,p,changed,()=>{}),/criteria-not-bound-or-changed/);
});
test('a correct technical label can still exceed budget and lack reviewed evidence',()=>{
 const p=plan();p.runs[0].state='executed';const r=evaluateQuality(suite,p,criteria,()=>({audit:fixture(),resultBytes:9000,metrics:{main:{assistant_requests:12},subagents:[{}],totals:{input_tokens:1,cache_creation_input_tokens:1,cache_read_input_tokens:1100000,output_tokens:9000}}}));
 assert.equal(r.groups.positivo.correct,1);assert.equal(r.budgets.checked,1);assert.equal(r.budgets.exceeded,1);assert.deepEqual(r.budgets.details[0].failed,['main_requests','output_tokens','reported_input','result_bytes']);assert.equal(r.gates.critical_reviews,false);assert.equal(r.release_approved,false);
});
test('a clean false positive and missing metrics remain visible failures',()=>{
 const p=plan(),clean=p.runs.find(r=>r.case_id==='P3-L01');clean.state='executed';const r=evaluateQuality(suite,p,criteria,()=>({audit:fixture(),resultBytes:5000}));
 assert.equal(r.groups.limpo.false_positives,1);assert.equal(r.gates.clean,false);assert.equal(r.budgets.checked,0);assert.equal(r.budgets.pending,105);
});
test('malformed audit or reviewer data cannot become a budget or review pass',()=>{
 const p=plan();p.runs[0].state='executed';p.runs[0].review={reviewer:17};
 const r=evaluateQuality(suite,p,criteria,()=>({audit:{sources:null},resultBytes:1,metrics:{main:{assistant_requests:1},subagents:[],totals:{input_tokens:1,cache_creation_input_tokens:1,cache_read_input_tokens:1,output_tokens:1}}}));
 assert.equal(r.executions.invalid_contract,1);assert.equal(r.budgets.checked,0);assert.equal(r.critical_reviews.complete,0);assert.equal(r.implemented_gates_met,false);
});

test('native acceptance requires a matching hook result and reports invalid first responses',()=>{
 const current={...criteria,acceptance:'validated_native_handoff'};
 const p={...createPlan(suite),criteria_sha256:digest(current)};
 p.runs[0].state='executed';
 const evidence={audit:fixture(),resultBytes:4000};
 const missing=evaluateQuality(suite,p,current,()=>evidence);
 assert.equal(missing.executions.valid_contract,1);
 assert.equal(missing.native_handoffs.accepted,0);
 const accepted=evaluateQuality(suite,p,current,()=>({
  ...evidence,handoff:{raw_valid:false,normalized:true,matches_result:true},
 }));
 assert.deepEqual(accepted.native_handoffs,{observed:1,accepted:1,raw_valid:0,raw_invalid:1,normalized:1});
 assert.equal(accepted.gates.native_handoffs,false);
});
