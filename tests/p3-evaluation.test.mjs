import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createPlan,summarize} from '../tools/p3-evaluation.mjs';
const suite=JSON.parse(fs.readFileSync(new URL('../evals/p3-suite.json',import.meta.url),'utf8'));
const fixture=()=>JSON.parse(fs.readFileSync(new URL('../evals/results/p1/p1-offline.json',import.meta.url),'utf8'));
test('P3 plan preserves 35 cases and all 105 repetitions as pending, never as successes',()=>{
 const plan=createPlan(suite),r=summarize(suite,plan,()=>{throw Error('must not load pending output')});assert.equal(r.executions.planned,105);assert.equal(r.executions.pending,105);assert.equal(r.provisional_label_agreement.precision,null);assert.equal(r.gates.no_known_guard_violations,null);assert.equal(r.technical_gates_met,false);assert.equal(r.release_approved,false);assert.equal(new Set(suite.cases.map(c=>c.check_id)).size,13);
});
test('partial result can match the technical label without passing review or legal release gates',()=>{
 const plan=createPlan(suite);plan.runs[0].state='executed';const r=summarize(suite,plan,fixture);assert.equal(r.executions.valid_contract,1);assert.equal(r.executions.pending,104);assert.equal(r.provisional_label_agreement.tp,1);assert.equal(r.gates.all_trace_reviews_complete,false);assert.equal(r.technical_gates_met,false);
});
test('missing or malformed executed output remains a failure in the denominator',()=>{
 const plan=createPlan(suite);plan.runs[0].state='executed';plan.runs[1].state='execution_failed';const r=summarize(suite,plan,()=>{throw Error('missing')});assert.equal(r.executions.planned,105);assert.equal(r.executions.executed,1);assert.equal(r.executions.invalid_contract,1);assert.equal(r.executions.execution_failed,1);assert.equal(r.executions.pending,103);assert.equal(r.provisional_label_agreement.positive_cases,2);assert.equal(r.provisional_label_agreement.positive_abstentions,2);assert.equal(r.provisional_label_agreement.recall_including_abstentions,0);
});
test('clean-case false positive and positive abstention are counted rather than silently excluded',()=>{
 const plan=createPlan(suite);plan.runs[0].state='executed';const clean=plan.runs.find(r=>r.case_id==='P3-L01');clean.state='executed';
 const r=summarize(suite,plan,run=>{const a=fixture();if(run.case_id==='P3-P01')a.coverage.find(c=>c.check_id==='LGPD-01').status='insuficiente';return a;});assert.equal(r.provisional_label_agreement.fp,1);assert.equal(r.provisional_label_agreement.positive_abstentions,1);assert.equal(r.provisional_label_agreement.recall_including_abstentions,0);
});
test('changing labels, deleting planned runs or duplicating slots cannot improve a report',()=>{
 const plan=createPlan(suite),changed=structuredClone(suite);changed.cases[0].expected='sem_indicio';assert.throws(()=>summarize(changed,plan,fixture),/suite-changed/);plan.runs.pop();assert.throws(()=>summarize(suite,plan,fixture),/run-plan-mismatch/);
 const other=createPlan(suite);other.runs[1]=other.runs[0];assert.throws(()=>summarize(suite,other,fixture),/run-plan-mismatch/);
});

test('the provisional v3 plan covers delivery for all checks without inheriting approvals', () => {
 const suite = JSON.parse(fs.readFileSync(new URL('../evals/p3-suite-v3.json', import.meta.url),'utf8'));
 const plan = createPlan(suite);
 assert.equal(plan.runs.length, 162);
 assert.ok(plan.runs.every(run => run.state === 'pending'));
 assert.equal(new Set(suite.cases.filter(c => c.mode === 'entrega').map(c => c.check_id)).size, 13);
 assert.equal(suite.cases.every(c => c.review.status === 'pending'), true);
});
