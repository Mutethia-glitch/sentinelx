const test=require('node:test');const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');
const {createPool}=require('../../src/data/pool');const {executeSql}=require('../../src/data/postgres');const {migrationSql}=require('../../scripts/migrate');
const {eventRepository}=require('../../src/data/event-repository');const {detectionRepository}=require('../../src/data/detection-repository');const {detectionEngine}=require('../../src/detection/engine');

test('PostgreSQL detection respects match, grouping, threshold, event-time window and atomicity',async t=>{
  assert.equal(process.env.SENTINELX_TEST_DATABASE,'1','Use a disposable database.');executeSql(migrationSql());
  const pool=createPool(), events=eventRepository(pool), detection=detectionRepository(pool), engine=detectionEngine(detection);
  const eventIds=[], alertIds=[];let ruleId;
  t.after(async()=>{
    if(alertIds.length)await pool.query('DELETE FROM alert_events WHERE alert_id=ANY($1::uuid[])',[alertIds]);
    if(alertIds.length)await pool.query('DELETE FROM alerts WHERE id=ANY($1::uuid[])',[alertIds]);
    if(eventIds.length)await pool.query('DELETE FROM security_events WHERE id=ANY($1::uuid[])',[eventIds]);
    if(ruleId)await pool.query('DELETE FROM detection_rules WHERE id=$1',[ruleId]);
    await pool.end();
  });
  const definition={schemaVersion:1,conditions:[{field:'source',operator:'equals',value:'sentinelx-simulated'},{field:'type',operator:'equals',value:'authentication'},{field:'status',operator:'equals',value:'failed'}],threshold:3,windowSeconds:60,groupBy:['sourceIp','user']};
  ruleId=(await pool.query(`INSERT INTO detection_rules(name,description,enabled,definition,threat_level,category_code) VALUES($1,'synthetic',true,$2::jsonb,'HIGH','BRUTE_FORCE') RETURNING id`,[`Detection integration ${randomUUID()}`,JSON.stringify(definition)])).rows[0].id;
  const make=(timestamp,status='failed',sourceIp='192.0.2.10')=>({timestamp,source:'sentinelx-simulated',type:'authentication',sourceIp,destinationIp:null,user:'synthetic-user',host:'host',action:'login',status,severity:'MEDIUM',rawData:{synthetic:true},metadata:{}});
  const save=async input=>{
    let generated=[];
    const saved=await events.create(input,null,async(persisted,client)=>{generated=await engine.evaluate(persisted,client);});
    eventIds.push(saved.id);for(const alert of generated)alertIds.push(alert.id);return {saved,generated};
  };
  assert.equal((await save(make('2026-09-30T00:00:00.000Z'))).generated.length,0);
  assert.equal((await save(make('2026-09-30T00:00:20.000Z','success'))).generated.length,0);
  assert.equal((await save(make('2026-09-30T00:00:30.000Z'))).generated.length,0);
  const third=await save(make('2026-09-30T00:00:50.000Z'));assert.equal(third.generated.length,1);assert.equal(third.generated[0].eventIds.length,3);
  const persisted=(await pool.query('SELECT rule_id,threat_level,match_evidence FROM alerts WHERE id=$1',[third.generated[0].id])).rows[0];
  assert.equal(persisted.rule_id,ruleId);assert.equal(persisted.threat_level,'HIGH');assert.equal(persisted.match_evidence.threshold,3);assert.deepEqual(persisted.match_evidence.groupValues,['192.0.2.10','synthetic-user']);
  assert.equal(Number((await pool.query('SELECT count(*) FROM alert_events WHERE alert_id=$1',[third.generated[0].id])).rows[0].count),3);
  assert.equal((await engine.evaluate(third.saved)).length,0,'same trigger cannot create duplicate alert');
  assert.equal((await save(make('2026-09-30T00:02:00.000Z'))).generated.length,0,'older matches fall outside event-time window');
  assert.equal((await save(make('2026-09-30T00:02:10.000Z','failed','192.0.2.11'))).generated.length,0,'grouping isolates source IP');

  const before=Number((await pool.query('SELECT count(*) FROM security_events')).rows[0].count);
  await assert.rejects(events.create(make('2026-09-30T00:03:00.000Z'),null,async()=>{throw new Error('synthetic detection failure');}),{message:'Security event persistence unavailable.'});
  assert.equal(Number((await pool.query('SELECT count(*) FROM security_events')).rows[0].count),before,'detection failure rolls event back');
});
