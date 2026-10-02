const test=require('node:test');
const assert=require('node:assert/strict');
const {eventRepository}=require('../../src/data/event-repository');
const {alertRepository}=require('../../src/data/alert-repository');
const {incidentRepository}=require('../../src/data/incident-repository');
const ID='11111111-1111-4111-8111-111111111111';
function capture(){
  const queries=[];
  return {queries,pool:{query:async(sql,values)=>{queries.push({sql,values});return{rows:[]};}}};
}
test('all search domains parameterize user input and avoid joined-row duplicates',async()=>{
  const q="100%_' OR 1=1 --";
  const filters={page:1,q,ruleId:ID,mitreTechniqueId:'T1110.001',sourceIp:'192.0.2.18',
    user:'alice',categoryCode:'BRUTE_FORCE'};
  for(const factory of [eventRepository,alertRepository,incidentRepository]){
    const fixture=capture();
    const result=await factory(fixture.pool).list(filters);
    const {sql,values}=fixture.queries[0];
    assert.ok(!sql.includes(q));
    assert.ok(values.some(v=>String(v).includes("OR 1=1 --")));
    assert.ok(values.includes('T1110.001'));
    assert.ok(values.includes('192.0.2.18'));
    assert.ok(sql.includes('EXISTS (SELECT 1'));
    assert.ok(sql.includes('rule_mitre_mappings'));
    assert.ok(sql.includes('LIMIT 51'));
    assert.equal(result.page,1);
    assert.equal(result.pageSize,50);
  }
});
test('event category and MITRE apply to the same linked alert',async()=>{
  const f=capture();
  await eventRepository(f.pool).list({page:1,categoryCode:'BRUTE_FORCE',ruleId:ID,mitreTechniqueId:'T1110.001'});
  const sql=f.queries[0].sql;
  assert.ok(sql.includes('FROM alert_events ae JOIN alerts a ON a.id=ae.alert_id'));
  assert.ok(sql.includes('ae.event_id=e.id AND a.category_code='));
  assert.ok(sql.includes('a.rule_id='));
  assert.ok(sql.includes('rmm.rule_id=a.rule_id'));
});
test('entity filters on alerts must match one linked security event',async()=>{
  const f=capture();
  await alertRepository(f.pool).list({page:1,host:'h',user:'u',destinationIp:'2001:db8::1'});
  const sql=f.queries[0].sql;
  assert.ok(sql.includes('FROM alert_events ae JOIN security_events e ON e.id=ae.event_id'));
  assert.ok(sql.includes("e.normalized_data->>'host'"));
  assert.ok(sql.includes("e.normalized_data->>'user'"));
  assert.ok(sql.includes("e.normalized_data->>'destinationIp'"));
});
test('incident linked rule, source and entities match one evidence chain; unclassified is null',async()=>{
  const f=capture();
  await incidentRepository(f.pool).list({page:1,categoryCode:'UNCLASSIFIED',source:'sensor',
    ruleId:ID,mitreTechniqueId:'T1110.001',sourceIp:'192.0.2.18'});
  const sql=f.queries[0].sql;
  assert.ok(sql.includes('i.category_code IS NULL'));
  assert.ok(sql.includes('FROM incident_alerts ia JOIN alerts a ON a.id=ia.alert_id'));
  assert.ok(sql.includes('JOIN alert_events ae ON ae.alert_id=a.id JOIN security_events e ON e.id=ae.event_id'));
  assert.ok(sql.includes('ia.incident_id=i.id'));
  assert.ok(sql.includes("e.normalized_data->>'sourceIp'"));
  assert.ok(!sql.includes('T1110.001'));
});

test('standalone event category matches native normalized verdict without requiring an alert',async()=>{
  const f=capture();
  await eventRepository(f.pool).list({page:1,categoryCode:'RECONNAISSANCE'});
  const {sql,values}=f.queries[0];
  assert.ok(sql.includes("e.normalized_data->'metadata'->>'categoryCode'="));
  assert.ok(sql.includes('OR EXISTS (SELECT 1 FROM alert_events ae JOIN alerts a ON a.id=ae.alert_id'));
  assert.ok(sql.includes('a.category_code='));
  assert.equal(values.filter(v=>v==='RECONNAISSANCE').length,1);
  assert.ok(!sql.includes('JOIN alert_events ae ON'), 'no mandatory alert join');
});
test('linked rule and MITRE constraints retain a single alert evidence chain',async()=>{
  const f=capture();
  await eventRepository(f.pool).list({page:1,categoryCode:'RECONNAISSANCE',ruleId:ID,mitreTechniqueId:'T1110.001'});
  const sql=f.queries[0].sql;
  assert.ok(sql.includes('WHERE ae.event_id=e.id AND a.category_code='));
  assert.ok(sql.includes('a.rule_id='));
  assert.ok(sql.includes('rmm.rule_id=a.rule_id'));
  assert.ok(!sql.includes("e.normalized_data->'metadata'->>'categoryCode'="));
});
