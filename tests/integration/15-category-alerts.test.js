'use strict';
// Task 41 release gate: the REAL PostgreSQL detector must persist an alert for
// each of the 15 normalized issuer-bound threat categories. This runs only on
// disposable CI PostgreSQL; it does not enable production rules or forge attacks.
const test=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {createPool}=require('../../src/data/pool');
const {executeSql}=require('../../src/data/postgres');
const {migrationSql}=require('../../scripts/migrate');
const {INITIAL_RULES}=require('../../src/rules/initial-rules');
const {CATEGORY_CODES}=require('../../src/threats/taxonomy');
const {EVIDENCE_SIGNALS,normalizeEvidence}=require('../../src/integrations/evidence-catalog');
const {eventRepository}=require('../../src/data/event-repository');
const {detectionRepository}=require('../../src/data/detection-repository');
const {detectionEngine}=require('../../src/detection/engine');

test('all 15 issuer signal categories produce threshold-gated, correctly classified real PostgreSQL alerts',async t=>{
 assert.equal(process.env.SENTINELX_TEST_DATABASE,'1','Disposable PostgreSQL opt-in required');
 executeSql(migrationSql());
 const pool=createPool(),events=eventRepository(pool),engine=detectionEngine(detectionRepository(pool));
 const eventIds=[],alertIds=[],ruleNames=INITIAL_RULES.map(rule=>rule.name);
 t.after(async()=>{
  try{
   if(alertIds.length)await pool.query('DELETE FROM alert_events WHERE alert_id=ANY($1::uuid[])',[alertIds]);
   if(alertIds.length)await pool.query('DELETE FROM alerts WHERE id=ANY($1::uuid[])',[alertIds]);
   if(eventIds.length)await pool.query('DELETE FROM security_events WHERE id=ANY($1::uuid[])',[eventIds]);
   await pool.query('UPDATE detection_rules SET enabled=false WHERE name=ANY($1::text[])',[ruleNames]);
  }finally{await pool.end();}
 });
 const existing=(await pool.query(
  'SELECT category_code,enabled,definition,threat_level FROM detection_rules WHERE name=ANY($1::text[])',
  [ruleNames])).rows;
 assert.equal(existing.length,15,'all 15 source contract rules must be installed');
 assert.ok(existing.every(row=>row.enabled===false),'default deployment remains safely disabled');
 assert.deepEqual(new Set(existing.map(row=>row.category_code)),new Set(CATEGORY_CODES));
 for(const expected of INITIAL_RULES){
  const stored=existing.find(row=>row.category_code===expected.categoryCode);
  assert.deepEqual(stored.definition,expected.definition,expected.categoryCode+' deployed rule definition');
  assert.equal(stored.threat_level,expected.severity);
 }
 const enabled=await pool.query('UPDATE detection_rules SET enabled=true WHERE name=ANY($1::text[]) RETURNING category_code',[ruleNames]);
 assert.equal(enabled.rowCount,15,'only disposable seeded rules enabled');
 const anchor=Date.now()-60000;
 let seq=0,totalAlerts=0;
 async function write(input){
  let generated=[];
  const saved=await events.create(input,null,async(row,client)=>{generated=await engine.evaluate(row,client);});
  eventIds.push(saved.id);
  for(const alert of generated)alertIds.push(alert.id);
  return{saved,generated};
 }
 for(let i=0;i<CATEGORY_CODES.length;i++){
  const category=CATEGORY_CODES[i];
  const signal=Object.keys(EVIDENCE_SIGNALS).find(s=>EVIDENCE_SIGNALS[s].categoryCode===category);
  assert.ok(signal,category+' must have issuer-authenticated signal contract');
  const spec=EVIDENCE_SIGNALS[signal],rule=INITIAL_RULES.find(r=>r.categoryCode===category);
  assert.equal(spec.categoryCode,category);
  const feed={issuer:spec.issuer,source:'evidence.ci-task41-'+i,
   host:'source-'+i+'.example.invalid',tenantId:'11111111-1111-4111-8111-111111111111'};
  const base={signal,sourceIp:'192.0.2.'+(10+i),destinationIp:'198.51.100.'+(10+i),
   subject:i.toString(16).padStart(64,'a')};
  const datum=()=>{
   seq++;
   return normalizeEvidence({...base,eventId:randomUUID(),
    timestamp:new Date(anchor+seq*25).toISOString(),
    evidenceRef:'ci-verdict-'+randomUUID().replace(/-/g,'')},feed,anchor+seq*25);
  };
  // An ordinary non-security event must not generate a security alert.
  const positive=datum();
  const harmless=await write({...positive,type:'generic',action:'none',status:'normal',
   rawData:{synthetic:true},metadata:{dataset:'task41-benign-negative'}});
  assert.equal(harmless.generated.length,0,category+' benign negative');
  for(let n=1;n<=rule.definition.threshold;n++){
   const observed=await write(datum());
   if(n<rule.definition.threshold){
    assert.equal(observed.generated.length,0,category+' below threshold '+n);
    continue;
   }
   assert.equal(observed.generated.length,1,category+' threshold must generate ONE alert');
   const generated=observed.generated[0];
   assert.equal(generated.threat,category,category+' generated category');
   assert.equal(generated.severity,rule.severity,category+' generated alert severity');
   const persisted=(await pool.query(
    'SELECT category_code,threat_level,trigger_event_id,match_evidence FROM alerts WHERE id=$1',
    [generated.id])).rows[0];
   assert.ok(persisted,category+' must be persisted');
   assert.equal(persisted.category_code,category);
   assert.equal(persisted.threat_level,rule.severity);
   assert.equal(persisted.trigger_event_id,observed.saved.id);
   assert.equal(persisted.match_evidence.threshold,rule.definition.threshold);
   const linked=await pool.query('SELECT count(*)::int AS total FROM alert_events WHERE alert_id=$1',[generated.id]);
   assert.equal(linked.rows[0].total,rule.definition.threshold,category+' alert evidence chain');
   totalAlerts++;
   assert.equal((await engine.evaluate(observed.saved)).length,0,category+' duplicate trigger denied');
  }
 }
 assert.equal(totalAlerts,15);
 assert.equal(alertIds.length,15);
 const records=await pool.query('SELECT category_code,count(*)::int AS total FROM alerts WHERE id=ANY($1::uuid[]) GROUP BY category_code',[alertIds]);
 assert.deepEqual(new Set(records.rows.map(row=>row.category_code)),new Set(CATEGORY_CODES));
 assert.ok(records.rows.every(row=>row.total===1),'one qualifying alert for each category');
});
