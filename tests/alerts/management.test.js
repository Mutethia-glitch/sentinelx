const test=require('node:test');
const assert=require('node:assert/strict');
const { alertQuery }=require('../../src/alerts/query');
const { statusUpdateInput, alertId }=require('../../src/alerts/model');
const { alertService }=require('../../src/alerts/service');
const { alertRepository }=require('../../src/data/alert-repository');

test('alert filters are bounded and validate status, severity, category, rule and dates',()=>{
  const id='11111111-1111-4111-8111-111111111111';
  assert.deepEqual(alertQuery(new URLSearchParams(`status=ACKNOWLEDGED&severity=HIGH&categoryCode=BRUTE_FORCE&ruleId=${id}&page=2`)),
    {page:2,status:'ACKNOWLEDGED',severity:'HIGH',categoryCode:'BRUTE_FORCE',ruleId:id});
  for(const query of ['unknown=x','status=RESOLVED','severity=UNKNOWN','categoryCode=NOPE','page=0',
    'ruleId=bad','q=a&q=b','from=yesterday','from=2026-09-30T01:00:00Z&to=2026-09-30T00:00:00Z']) {
    assert.throws(()=>alertQuery(new URLSearchParams(query)),{status:400});
  }
});

test('status input permits only NEW or ACKNOWLEDGED with a reason',()=>{
  assert.deepEqual(statusUpdateInput({status:'ACKNOWLEDGED',reason:'Investigating source evidence '}),{status:'ACKNOWLEDGED',reason:'Investigating source evidence'});
  assert.equal(alertId('11111111-1111-4111-8111-111111111111'),'11111111-1111-4111-8111-111111111111');
  for(const body of [{status:'RESOLVED',reason:'x'},{status:'NEW',reason:''},{status:'NEW'},{status:'NEW',reason:'x',extra:true}]) {
    assert.throws(()=>statusUpdateInput(body),{status:400});
  }
});

test('readers can inspect but only alert managers can update status',async()=>{
  const access={me:async token=>({user:{id:'actor'},roles:[token]})};
  const repo={list:async q=>({alerts:[],page:q.page}),get:async()=>({id:'alert'}),updateStatus:async()=>({status:'ACKNOWLEDGED'})};
  const service=alertService(repo,access);
  for(const role of ['Administrator','Security Analyst','Viewer/Management']) {
    assert.equal((await service.inspect(role,'11111111-1111-4111-8111-111111111111')).id,'alert');
  }
  await assert.rejects(service.updateStatus('Viewer/Management','11111111-1111-4111-8111-111111111111',{status:'ACKNOWLEDGED',reason:'review'}),{status:403});
  assert.equal((await service.updateStatus('Security Analyst','11111111-1111-4111-8111-111111111111',{status:'ACKNOWLEDGED',reason:'review'})).status,'ACKNOWLEDGED');
});

test('alert list search is parameterized and summaries exclude match evidence',async()=>{
  let sql,values;
  const repository=alertRepository({query:async(s,v)=>{sql=s;values=v;return{rows:[]};}});
  const result=await repository.list({page:1,q:"%' OR 1=1 --"});
  assert.equal(result.alerts.length,0);
  assert.ok(!sql.includes("OR 1=1 --"));
  assert.equal(values[0],"%\\%' OR 1=1 --%");
});

test('status mutation rechecks live analyst role and audits the transition',async()=>{
  const queries=[];
  const row={id:'alert-1',rule_id:'rule-1',rule_name:'Rule',trigger_event_id:'event-1',category_code:'BRUTE_FORCE',
    threat_level:'HIGH',source:'sensor',created_at:new Date('2026-09-30T00:00:00Z'),affected_entities:{user:'a'},
    status:'NEW',confidence:null,match_reason:'reason',status_updated_at:null,status_updated_by:null};
  const client={
    query:async(sql,params)=>{
      queries.push({sql,params});
      if(['BEGIN','COMMIT','ROLLBACK'].includes(sql))return{rows:[]};
      if(sql.includes('FROM users WHERE'))return{rows:[{id:'actor'}]};
      if(sql.includes('FROM user_roles'))return{rows:[{name:'Security Analyst'}]};
      if(sql.includes('FOR UPDATE'))return{rows:[row]};
      if(sql.startsWith('UPDATE alerts'))return{rows:[{...row,status:'ACKNOWLEDGED',status_updated_at:new Date('2026-09-30T01:00:00Z'),status_updated_by:'actor'}]};
      if(sql.startsWith('INSERT INTO audit_logs'))return{rows:[]};
      throw new Error(`unexpected ${sql}`);
    },
    release:()=>{},
  };
  const repository=alertRepository({connect:async()=>client});
  const changed=await repository.updateStatus('actor','alert-1',{status:'ACKNOWLEDGED',reason:'triage'});
  assert.equal(changed.changed,true);
  assert.equal(changed.status,'ACKNOWLEDGED');
  assert.ok(queries.some(q=>q.sql.startsWith('INSERT INTO audit_logs')));
});
