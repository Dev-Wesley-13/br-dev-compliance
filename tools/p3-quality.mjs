// Maintainer-only. Frozen engineering gates; does not call models or approve a release.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {digest,summarize,evidencePath} from './p3-evaluation.mjs';
import {validateResult} from './validate-result.mjs';

export function evaluateQuality(suite,plan,criteria,loadEvidence){
  if(criteria.schema_version!==1||criteria.required_executions!==105||plan.criteria_sha256!==digest(criteria))throw Error('criteria-not-bound-or-changed');
  const cache=new Map();
  const evidence=run=>{if(!cache.has(run.run_id))cache.set(run.run_id,loadEvidence(run));return cache.get(run.run_id);};
  const report=summarize(suite,plan,run=>evidence(run).audit);
  const cases=new Map(suite.cases.map(c=>[c.id,c]));
  const rows=new Map(report.details.map(row=>[row.run_id,row]));
  const groups=Object.fromEntries(['positivo','limpo','ambiguo'].map(group=>[group,{planned:30,correct:0,false_positives:0}]));
  const nativeHandoff=criteria.acceptance==='validated_native_handoff';
  const handoffs={observed:0,accepted:0,raw_valid:0,raw_invalid:0,normalized:0};
  let reviewed=0,violations=0,budgetChecked=0,budgetExceeded=0;
  const budgets=[];
  for(const run of plan.runs){
    const row=rows.get(run.run_id),c=cases.get(run.case_id),g=groups[c.group];
    if(g&&row.contract&&row.label_match)g.correct++;
    if(c.group==='limpo'&&row.contract&&row.actual==='indicio')g.false_positives++;
    if(run.state!=='executed')continue;
    const review=run.review;
    if(typeof review?.reviewer==='string'&&review.reviewer.trim()&&criteria.critical_guards.every(key=>typeof review[key]==='boolean')){
      reviewed++;if(criteria.critical_guards.some(key=>review[key]===false))violations++;
    }
    let e;try{e=evidence(run);}catch{continue;}
    if(nativeHandoff&&e.handoff){
      handoffs.observed++;
      if(e.handoff.raw_valid)handoffs.raw_valid++;
      else handoffs.raw_invalid++;
      if(row.contract&&e.handoff.matches_result){
        handoffs.accepted++;
        if(e.handoff.normalized)handoffs.normalized++;
      }
    }
    if(!row.contract)continue;
    const m=e.metrics,b=criteria.simple_audit_budget;
    const values=[m?.main?.assistant_requests,m?.subagents?.length,m?.totals?.output_tokens,m?.totals?.input_tokens,m?.totals?.cache_creation_input_tokens,m?.totals?.cache_read_input_tokens,e.resultBytes];
    if(!Array.isArray(m?.subagents)||!values.every(value=>Number.isSafeInteger(value)&&value>=0))continue;
    budgetChecked++;
    const failed=[];
    if(m.main.assistant_requests>b.main_requests_max)failed.push('main_requests');
    if(m.subagents.length>b.auditor_instances_max)failed.push('auditor_instances');
    if(m.totals.output_tokens>b.reported_output_tokens_total_max)failed.push('output_tokens');
    if(m.totals.input_tokens+m.totals.cache_creation_input_tokens+m.totals.cache_read_input_tokens>b.reported_input_including_repeated_cache_total_max)failed.push('reported_input');
    if(e.resultBytes>b.result_bytes_max)failed.push('result_bytes');
    if(e.audit.sources.reduce((sum,s)=>sum+s.attempts,0)>b.external_attempts_max)failed.push('external_attempts');
    if(failed.length)budgetExceeded++;
    budgets.push({run_id:run.run_id,failed});
  }
  const gates={
    all_executions:report.executions.executed===criteria.required_executions,
    ...(nativeHandoff
      ? {validated_contracts:report.executions.valid_contract===criteria.required_executions,
         native_handoffs:handoffs.accepted===criteria.required_executions}
      : {raw_contracts:report.executions.valid_contract===criteria.raw_contract_valid_required}),
    positive:groups.positivo.correct>=criteria.positive.minimum_correct,
    clean:groups.limpo.correct>=criteria.clean.minimum_correct&&groups.limpo.false_positives<=criteria.clean.maximum_false_positives,
    ambiguous:groups.ambiguo.correct>=criteria.ambiguous.minimum_correct,
    critical_reviews:reviewed===criteria.required_executions&&violations<=criteria.critical_guard_failures_allowed,
    measured_budgets:budgetChecked===criteria.required_executions&&budgetExceeded===0,
    documented_environment:report.gates.single_documented_environment&&Object.entries(criteria.expected_environment).every(([key,value])=>report.cohorts[0]?.environment[key]===value)
  };
  const technicalGatesMet=Object.values(gates).every(x=>x===true);
  const independentLabelReview=report.gates.labels_independently_reviewed_declared;
  return {criteria_id:criteria.id,criteria_sha256:plan.criteria_sha256,suite_sha256:plan.suite_sha256,executions:report.executions,groups,...(nativeHandoff?{native_handoffs:handoffs}:{}),critical_reviews:{complete:reviewed,pending:105-reviewed,violations},budgets:{checked:budgetChecked,pending:105-budgetChecked,exceeded:budgetExceeded,details:budgets},gates:{...gates,independent_label_review_declared:independentLabelReview},technical_gates_met:technicalGatesMet,implemented_gates_met:technicalGatesMet&&independentLabelReview,release_approved:false,note:'Thresholds use all planned slots. Label agreement is provisional pending independent review. Permanent-context estimate, lifecycle tests, paired active-cost study and publication authorization remain separate requirements.'};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const planPath=evidencePath(process.argv[2]??''),output=evidencePath(process.argv[4]??'');
  const criteriaPath=fs.realpathSync(path.resolve(project,process.argv[3]??''));
  if(!criteriaPath.startsWith(path.join(project,'evals')+path.sep))throw Error('criteria-outside-evals');
  const read=(file,max)=>{if(fs.statSync(file).size>max)throw Error('evidence-too-large');return JSON.parse(fs.readFileSync(file,'utf8'));};
  const criteria=read(criteriaPath,65536);
  const suitePath=fs.realpathSync(path.resolve(project,criteria.suite_path??'evals/p3-suite.json'));
  if(!suitePath.startsWith(path.join(project,'evals')+path.sep))throw Error('suite-outside-evals');
  const suite=read(suitePath,1048576),plan=read(planPath,1048576);
  const inputs=[planPath,criteriaPath,suitePath,...plan.runs.flatMap(r=>[r.result_path,r.metrics_path,r.raw_path,r.hook_path].filter(Boolean).map(evidencePath))];
  if(inputs.includes(output))throw Error('report-cannot-replace-input');
  const result=evaluateQuality(suite,plan,criteria,run=>{
    const resultPath=evidencePath(run.result_path??'');
    const audit=read(resultPath,65536);
    let handoff=null;
    if(criteria.acceptance==='validated_native_handoff'&&run.raw_path&&run.hook_path){
      const rawPath=evidencePath(run.raw_path);
      if(fs.statSync(rawPath).size>65536)throw Error('raw-audit-too-large');
      const raw=fs.readFileSync(rawPath,'utf8');
      let rawValid=false;
      try { rawValid=validateResult(JSON.parse(raw)).valid; } catch {}
      const hook=read(evidencePath(run.hook_path),131072);
      const prefix='BR Dev Compliance: retorno ';
      const matched=hook.hookEventName==='PostToolUse'&&hook.updatedToolOutput?.status==='forked'&&
        hook.updatedToolOutput.commandName==='br-dev-compliance:executar-auditoria'&&
        typeof hook.updatedToolOutput.result==='string'&&
        [prefix+'validado '+audit.audit_id+'.',prefix+'normalizado e validado '+audit.audit_id+'.'].includes(hook.additionalContext);
      let matchesResult=false;
      if(matched)try { matchesResult=isDeepStrictEqual(JSON.parse(hook.updatedToolOutput.result),audit); } catch {}
      handoff={raw_valid:rawValid,normalized:hook.additionalContext===prefix+'normalizado e validado '+audit.audit_id+'.',
        matches_result:matchesResult};
    }
    return {audit,resultBytes:fs.statSync(resultPath).size,metrics:run.metrics_path?read(evidencePath(run.metrics_path),2097152):null,handoff};
  });
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({saved:output,...result.executions,technical_gates_met:result.technical_gates_met,implemented_gates_met:result.implemented_gates_met,release_approved:false}));
}
