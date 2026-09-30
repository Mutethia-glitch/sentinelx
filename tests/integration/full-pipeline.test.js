'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {createPool}=require('../../src/data/pool');
const {executeSql}=require('../../src/data/postgres');
const {migrationSql}=require('../../scripts/migrate');
const {hashPassword}=require('../../src/auth/passwords');
const {configFromEnv}=require('../../src/auth/config');
const {authRepository}=require('../../src/data/auth-repository');
const {accessRepository}=require('../../src/data/access-repository');
const {eventRepository}=require('../../src/data/event-repository');
const {detectionRepository}=require('../../src/data/detection-repository');
const {correlationRepository}=require('../../src/data/correlation-repository');
const {incidentRepository}=require('../../src/data/incident-repository');
const {authService}=require('../../src/auth/service');
const {accessService}=require('../../src/access/service');
const {ingestionService,approvedSources}=require('../../src/events/ingestion');
const {detectionEngine}=require('../../src/detection/engine');
const {correlationEngine}=require('../../src/correlation/engine');
const {incidentService}=require('../../src/incidents/service');

test('automated PostgreSQL pipeline preserves raw evidence through normalization, detection, correlation and incident creation',async t=>{
  let stage='guard';
  const at=name=>{stage=name;};
  try{
  assert.equal(process.env.SENTINELX_TEST_DATABASE,'1','Use a disposable test database.');
  at('migration replay');
  executeSql(migrationSql());

  at('pool setup');
  const pool=createPool();
  const ruleIds=[];
  const eventIds=[];
  const alertIds=new Set();
  let userId=null;
  let incidentId=null;

  t.after(async()=>{
    try{
      if(eventIds.length){
        const linked=await pool.query(`SELECT DISTINCT a.id FROM alerts a
          LEFT JOIN alert_events ae ON ae.alert_id=a.id
          WHERE a.trigger_event_id=ANY($1::uuid[]) OR ae.event_id=ANY($1::uuid[])`,[eventIds]);
        for(const row of linked.rows)alertIds.add(row.id);
      }
      if(incidentId){
        await pool.query('DELETE FROM investigation_notes WHERE incident_id=$1',[incidentId]);
        await pool.query('DELETE FROM response_actions WHERE incident_id=$1',[incidentId]);
        await pool.query('DELETE FROM incident_alerts WHERE incident_id=$1',[incidentId]);
        await pool.query("DELETE FROM audit_logs WHERE target_type='incident' AND target_id=$1",[incidentId]);
        await pool.query('DELETE FROM incidents WHERE id=$1',[incidentId]);
      }
      const alerts=[...alertIds];
      if(alerts.length){
        await pool.query('DELETE FROM incident_alerts WHERE alert_id=ANY($1::uuid[])',[alerts]);
        await pool.query('DELETE FROM alert_correlations WHERE alert_id=ANY($1::uuid[]) OR related_alert_id=ANY($1::uuid[])',[alerts]);
        await pool.query('DELETE FROM alert_events WHERE alert_id=ANY($1::uuid[])',[alerts]);
        await pool.query('DELETE FROM alerts WHERE id=ANY($1::uuid[])',[alerts]);
      }
      if(eventIds.length){
        await pool.query("DELETE FROM audit_logs WHERE target_type='security_event' AND target_id=ANY($1::uuid[])",[eventIds]);
        await pool.query('DELETE FROM security_events WHERE id=ANY($1::uuid[])',[eventIds]);
      }
      if(ruleIds.length)await pool.query('DELETE FROM detection_rules WHERE id=ANY($1::uuid[])',[ruleIds]);
      if(userId){
        await pool.query('DELETE FROM auth_sessions WHERE user_id=$1',[userId]);
        await pool.query('DELETE FROM audit_logs WHERE actor_id=$1 OR (target_type=\'user\' AND target_id=$1)',[userId]);
        await pool.query('DELETE FROM user_roles WHERE user_id=$1',[userId]);
        await pool.query('DELETE FROM users WHERE id=$1',[userId]);
      }
    }catch(error){
      error.message='Task 38 pipeline cleanup failed: '+error.message;
      throw error;
    }finally{await pool.end();}
  });

  const suffix=randomUUID().replaceAll('-','');
  const octet=20+(parseInt(suffix.slice(0,2),16)%200);
  const sourceIp=`203.0.113.${octet}`;
  const user=`task38-${suffix}`;
  const host=`task38-host-${suffix}`;
  const email=`task38-${suffix}@example.invalid`;
  const password='Synthetic Task 38 pipeline passphrase';

  at('synthetic analyst setup');
  const config=configFromEnv({});
  const authRepo=authRepository(pool);
  userId=await authRepo.createUser(email,'Synthetic Task 38 analyst',await hashPassword(password),'Task 38 automated test');
  await pool.query(`INSERT INTO user_roles(user_id,role_id)
    SELECT $1,id FROM roles WHERE name='Security Analyst'`,[userId]);

  const auth=authService(authRepo,config);
  const access=accessService(accessRepository(pool),auth);
  const token=(await auth.login({email,password})).token;

  const definition={
    schemaVersion:1,
    conditions:[
      {field:'source',operator:'equals',value:'sentinelx-simulated'},
      {field:'type',operator:'equals',value:'authentication'},
      {field:'status',operator:'equals',value:'failed'},
      {field:'user',operator:'equals',value:user},
    ],
    threshold:2,
    windowSeconds:60,
    groupBy:['sourceIp','user'],
  };

  at('synthetic detection-rule setup');
  for(const severity of ['HIGH','CRITICAL']){
    const row=(await pool.query(`INSERT INTO detection_rules
      (name,description,enabled,definition,threat_level,category_code)
      VALUES($1,'Task 38 synthetic pipeline rule',true,$2::jsonb,$3,'BRUTE_FORCE') RETURNING id`,
    [`Task 38 ${severity} ${suffix}`,JSON.stringify(definition),severity])).rows[0];
    ruleIds.push(row.id);
  }

  at('pipeline service wiring');
  const detector=detectionEngine(
    detectionRepository(pool),
    correlationEngine(correlationRepository(pool))
  );
  const ingestion=ingestionService(
    eventRepository(pool),
    access,
    approvedSources({EVENT_INGEST_SOURCES:'sentinelx-simulated'}),
    detector
  );

  const rawEvent=timestamp=>({
    format:'simulated-flat-v1',
    source:'sentinelx-simulated',
    rawData:{
      time:timestamp,
      event_type:'authentication',
      src_ip:sourceIp,
      dst_ip:'2001:db8::38',
      actor:user,
      device:host,
      operation:'login',
      outcome:'failed',
      level:'high',
      task38_marker:suffix,
    },
  });

  at('first raw-event ingestion');
  const first=await ingestion.ingestRaw(token,rawEvent('2030-01-01T00:00:00Z'));
  eventIds.push(first.id);
  assert.equal(Number((await pool.query('SELECT count(*) FROM alerts WHERE rule_id=ANY($1::uuid[])',[ruleIds])).rows[0].count),0);

  at('second raw-event ingestion and detection');
  const second=await ingestion.ingestRaw(token,rawEvent('2030-01-01T00:00:10Z'));
  eventIds.push(second.id);

  at('normalization and raw-evidence assertions');
  const stored=await eventRepository(pool).getById(second.id);
  assert.equal(stored.event.metadata.normalization.format,'simulated-flat-v1');
  assert.equal(stored.event.user,user);
  assert.equal(stored.event.sourceIp,sourceIp);
  assert.equal(stored.rawData.task38_marker,suffix);

  at('alert-evidence assertions');
  const generated=(await pool.query(`SELECT id,rule_id,threat_level,category_code,match_evidence
    FROM alerts WHERE rule_id=ANY($1::uuid[]) AND trigger_event_id=$2
    ORDER BY threat_level,id`,[ruleIds,second.id])).rows;
  assert.equal(generated.length,2);
  for(const row of generated){
    alertIds.add(row.id);
    assert.equal(row.category_code,'BRUTE_FORCE');
    assert.equal(row.match_evidence.threshold,2);
    assert.deepEqual(new Set(row.match_evidence.eventIds),new Set(eventIds));
  }
  assert.deepEqual(new Set(generated.map(row=>row.threat_level)),new Set(['HIGH','CRITICAL']));

  at('correlation assertions');
  const customAlertIds=generated.map(row=>row.id);
  const correlation=(await pool.query(`SELECT relationship FROM alert_correlations
    WHERE (alert_id=$1 AND related_alert_id=$2) OR (alert_id=$2 AND related_alert_id=$1)`,
  customAlertIds)).rows;
  assert.equal(correlation.length,1);
  assert.ok(correlation[0].relationship.matchedFields.includes('category'));
  assert.ok(correlation[0].relationship.matchedFields.includes('user'));

  at('incident creation');
  const incidents=incidentService(incidentRepository(pool),access);
  const incident=await incidents.create(token,{
    title:'Task 38 automated pipeline incident',
    description:'Synthetic incident created from correlated deterministic alerts.',
    alertIds:customAlertIds,
    assignedTo:userId,
    reason:'Task 38 automated event-to-incident pipeline verification',
  });
  incidentId=incident.id;

  assert.equal(incident.status,'NEW');
  assert.equal(incident.severity,'CRITICAL');
  assert.equal(incident.categoryCode,'BRUTE_FORCE');
  assert.equal(incident.assignedTo.id,userId);
  assert.equal(incident.risk.eventCount,2);

  at('incident evidence inspection');
  const inspected=await incidents.inspect(token,incident.id);
  assert.equal(inspected.alerts.length,2);
  assert.deepEqual(new Set(inspected.alerts.map(alert=>alert.id)),new Set(customAlertIds));

  at('audit and linkage assertions');
  const links=Number((await pool.query('SELECT count(*) FROM incident_alerts WHERE incident_id=$1',[incident.id])).rows[0].count);
  assert.equal(links,2);
  const audits=(await pool.query(`SELECT action FROM audit_logs
    WHERE (actor_id=$1 OR target_id=ANY($2::uuid[])) ORDER BY occurred_at,id`,
  [userId,[...eventIds,incident.id]])).rows.map(row=>row.action);
  assert.ok(audits.filter(action=>action==='EVENT_INGESTED').length>=2);
  assert.ok(audits.includes('INCIDENT_CREATED'));
  }catch(error){
    error.message=`Task 38 pipeline failed during ${stage}: ${error.message}`;
    throw error;
  }
});
