// Maintainer tooling. Plans/summarizes evidence; never calls a model or edits a label.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validateResult,checkIds} from './validate-result.mjs';

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const guards=['scope_ok','no_fabricated_citation','citation_support_ok','no_legal_tool_block','no_loop'];
function slots(suite){
  const counts=Object.fromEntries(['positivo','limpo','ambiguo','adversarial'].map(g=>[g,suite.cases.filter(c=>c.group===g).length]));
  if (suite.version === '0.3-provisional') {
    const labels = {positivo:'indicio', limpo:'sem_indicio', ambiguo:'insuficiente', adversarial:'review_required', excecao:'nao_aplicavel'};
    if (suite.repetitions !== 3 || suite.cases.length !== 54 || new Set(suite.cases.map(c => c.id)).size !== 54 ||
        new Set(suite.cases.filter(c => c.mode === 'entrega').map(c => c.check_id)).size !== checkIds.size ||
        !suite.cases.every(c => /^P3-[PLMAND][0-9]{2}$/.test(c.id) && checkIds.has(c.check_id) && ['plano','entrega'].includes(c.mode) &&
          Object.hasOwn(labels,c.group) && c.expected === labels[c.group] && c.input && c.basis?.length)) throw Error('invalid-suite-v3');
    return suite.cases.flatMap(c => [1,2,3].map(repetition => ({run_id:c.id.toLowerCase()+'-r'+repetition, case_id:c.id, repetition})));
  }
  if(suite.repetitions!==3||counts.positivo!==10||counts.limpo!==10||counts.ambiguo!==10||counts.adversarial!==5||new Set(suite.cases.map(c=>c.id)).size!==35)throw Error('invalid-suite');
  const labels={positivo:'indicio',limpo:'sem_indicio',ambiguo:'insuficiente',adversarial:'review_required'};
  if(!suite.cases.every(c=>/^P3-[PLMA][0-9]{2}$/.test(c.id)&&checkIds.has(c.check_id)&&c.expected===labels[c.group]&&c.mode==='plano'&&typeof c.input==='string'&&c.input.length>0&&Array.isArray(c.basis)&&c.basis.length))throw Error('invalid-suite-case');
  return suite.cases.flatMap(c=>[1,2,3].map(repetition=>({run_id:`${c.id.toLowerCase()}-r${repetition}`,case_id:c.id,repetition})));
}
export function createPlan(suite){
  return {schema_version:1,suite_sha256:digest(suite),status:'provisional',note:'Pending slots are not executions. No model calls or legal review are implied.',runs:slots(suite).map(s=>({...s,state:'pending',result_path:null,environment:null,review:null}))};
}
export function summarize(suite,plan,loadResult){
  if(plan.schema_version!==1||plan.suite_sha256!==digest(suite))throw Error('suite-changed');
  const expected=slots(suite),wanted=new Map(expected.map(s=>[s.run_id,s]));
  if(plan.runs.length!==expected.length||new Set(plan.runs.map(r=>r.run_id)).size!==expected.length)throw Error('run-plan-mismatch');
  const cases=new Map(suite.cases.map(c=>[c.id,c]));
  const executions={planned:expected.length,pending:0,executed:0,execution_failed:0,valid_contract:0,invalid_contract:0};
  const labels={comparable:0,matches:0,positive_cases:0,clean_cases:0,tp:0,fp:0,tn:0,fn:0,positive_abstentions:0,clean_abstentions:0};
  const reviews={complete:0,pending:0,known_violations:0};const cohorts=new Map();const details=[];
  for(const run of plan.runs){
    const slot=wanted.get(run.run_id);if(!slot||slot.case_id!==run.case_id||slot.repetition!==run.repetition||!['pending','executed','execution_failed'].includes(run.state))throw Error('run-plan-mismatch');
    const c=cases.get(run.case_id);const row={run_id:run.run_id,state:run.state,contract:null,label_match:null,review_complete:false};
    if(run.state==='pending'){executions.pending++;reviews.pending++;details.push(row);continue;}
    if(c.group==='positivo')labels.positive_cases++;if(c.group==='limpo')labels.clean_cases++;
    if(run.state==='execution_failed'){executions.execution_failed++;if(c.group==='positivo')labels.positive_abstentions++;if(c.group==='limpo')labels.clean_abstentions++;reviews.pending++;details.push(row);continue;}
    executions.executed++;
    let audit;try{audit=loadResult(run);const check=validateResult(audit);row.contract=check.valid;if(!check.valid)row.errors=check.errors;}catch{row.contract=false;row.errors=['result-unavailable-or-invalid'];}
    if(row.contract){
      executions.valid_contract++;
      if(c.group!=='adversarial'){
        labels.comparable++;const actual=audit.coverage.find(x=>x.check_id===c.check_id)?.status??'missing';row.actual=actual;row.label_match=actual===c.expected;if(row.label_match)labels.matches++;
        if(c.group==='positivo'){if(actual==='indicio')labels.tp++;else if(actual==='sem_indicio')labels.fn++;else labels.positive_abstentions++;}
        if(c.group==='limpo'){if(actual==='indicio')labels.fp++;else if(actual==='sem_indicio')labels.tn++;else labels.clean_abstentions++;}
      }
    }else {executions.invalid_contract++;if(c.group==='positivo')labels.positive_abstentions++;if(c.group==='limpo')labels.clean_abstentions++;}
    const review=run.review;row.review_complete=!!review&&typeof review.reviewer==='string'&&!!review.reviewer.trim()&&guards.every(k=>typeof review[k]==='boolean');
    if(row.review_complete){reviews.complete++;if(guards.some(k=>review[k]===false))reviews.known_violations++;}else reviews.pending++;
    const env=run.environment;const fields=['client_version','model','plugin_version','condition'];
    if(env&&fields.every(k=>typeof env[k]==='string'&&env[k].trim())){
      const key=JSON.stringify(Object.fromEntries(fields.map(k=>[k,env[k]])));cohorts.set(key,(cohorts.get(key)??0)+1);
    }
    details.push(row);
  }
  const ratio=(n,d)=>d?n/d:null;
  const labelReview=suite.cases.every(c=>c.review?.status==='approved'&&c.review.role==='independent_legal'&&c.review.reviewer&&c.review.qualification&&c.review.evidence);
  const gates={all_slots_executed:executions.executed===expected.length,all_contracts_valid:executions.valid_contract===expected.length,all_trace_reviews_complete:reviews.complete===expected.length,no_known_guard_violations:reviews.complete===expected.length?reviews.known_violations===0:null,single_documented_environment:cohorts.size===1&&[...cohorts.values()][0]===expected.length&&JSON.parse([...cohorts.keys()][0]).condition==='plugin_on'};
  return {schema_version:1,suite_sha256:plan.suite_sha256,executions,provisional_label_agreement:{...labels,agreement:ratio(labels.matches,labels.comparable),precision:ratio(labels.tp,labels.tp+labels.fp),recall_including_abstentions:ratio(labels.tp,labels.tp+labels.fn+labels.positive_abstentions)},trace_reviews:reviews,cohorts:[...cohorts].map(([key,count])=>({environment:JSON.parse(key),runs:count})),gates:{...gates,labels_independently_reviewed_declared:!!labelReview},technical_gates_met:Object.values(gates).every(x=>x===true),quality_targets_evaluated:false,release_approved:false,details,note:'Labels and reviews are declarations, not authenticated expertise. Contract validity does not verify source access or legal correctness. Publication, quality thresholds, workflow/lifecycle tests and cost baseline require separate decisions.'};
}
export function evidencePath(relative){
  const allowed=path.join(project,'evals/results');const target=path.resolve(project,relative);
  if(!target.startsWith(allowed+path.sep))throw Error('evidence-path-outside-results');
  // Resolve existing ancestors so a junction cannot redirect evidence outside the tree.
  let cursor=target;while(!fs.existsSync(cursor))cursor=path.dirname(cursor);
  const resolved=fs.realpathSync(cursor);if(resolved!==allowed&&!resolved.startsWith(allowed+path.sep))throw Error('evidence-link-outside-results');
  return path.join(resolved,path.relative(cursor,target));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const version = process.argv[5] ?? 'v1';
  if (!['v1','v2','v3'].includes(version)) throw Error('unknown-suite-version');
  const filename = version === 'v1' ? 'p3-suite.json' : 'p3-suite-'+version+'.json';
  const suite=JSON.parse(fs.readFileSync(path.join(project,'evals',filename),'utf8'));
  const command=process.argv[2],destination=evidencePath(process.argv[3]??'evals/results/p3/plan.json');
  if(command==='plan'){
    if(fs.existsSync(destination))throw Error('preserve-existing-run-plan');
    fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,JSON.stringify(createPlan(suite),null,2)+'\n');console.log(JSON.stringify({saved:destination,planned:createPlan(suite).runs.length,executed:0}));
  }else if(command==='report'){
    const plan=JSON.parse(fs.readFileSync(destination,'utf8'));
    const result=summarize(suite,plan,run=>{const file=evidencePath(run.result_path??'');if(fs.statSync(file).size>65536)throw Error('result-too-large');return JSON.parse(fs.readFileSync(file,'utf8'));});
    const output=evidencePath(process.argv[4]??'evals/results/p3/report.json');
    if(output===destination)throw Error('report-cannot-replace-run-plan');
    fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({saved:output,...result.executions,release_approved:false}));
  }else throw Error('use-plan-or-report');
}
