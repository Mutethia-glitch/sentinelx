'use strict';
// Iphyn's existing first-party collector must cause a persisted rule-005 alert,
// not merely an Event. The connector key and all data here are DISPOSABLE CI-only.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {randomUUID,randomBytes}=require('node:crypto');
const {createPool}=require('../../src/data/pool');
const {executeSql}=require('../../src/data/postgres');
const {migrationSql}=require('../../scripts/migrate');
const {collectorConfig,collectorHandler}=require('../../src/integrations/collector');
const {eventRepository}=require('../../src/data/event-repository');
const {detectionRepository}=require('../../src/data/detection-repository');
const {detectionEngine}=require('../../src/detection/engine');
const {createServer}=require('../../src/api/server');
const {configFromEnv}=require('../../src/auth/config');

test('real Iphyn application access denials create exactly one HIGH unauthorized-access alert after 3 attributable decisions',async t=>{
 assert.equal(process.env.SENTINELX_TEST_DATABASE,'1','Disposable PostgreSQL opt-in required');
 executeSql(migrationSql());
 const pool=createPool();
 const source='ci-iphyn-'+randomUUID().slice(0,8);
 const token=randomBytes(32).toString('hex');
 const tenantId=randomUUID();
 const ruleName='SX-CORE-005 Repeated unauthorized access attempts';
 const connector=collectorConfig({
  CONNECTOR_TOKEN:token,CONNECTOR_SOURCE:source,CONNECTOR_HOST:'iphyn.vercel.app'
 },{id:tenantId});
 const seeded=(await pool.query('SELECT id,enabled,version,definition,threat_level FROM detection_rules WHERE name=$1',[ruleName])).rows[0];
 assert.ok(seeded&&!seeded.enabled,'Core-005 must start disabled');
 assert.equal(seeded.version,2);
 assert.equal(seeded.threat_level,'HIGH');
 assert.equal(seeded.definition.threshold,3);
 assert.equal(seeded.definition.windowSeconds,300);
 assert.deepEqual(seeded.definition.groupBy,['sourceIp']);
 let server=null,activated=false;
 t.after(async()=>{
  try{
   if(server)await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});
   const ids=(await pool.query('SELECT id FROM security_events WHERE source=$1',[source])).rows.map(x=>x.id);
   if(ids.length){
    await pool.query('DELETE FROM alert_events WHERE event_id=ANY($1::uuid[])',[ids]);
    await pool.query('DELETE FROM alerts WHERE trigger_event_id=ANY($1::uuid[])',[ids]);
    await pool.query('DELETE FROM connector_receipts WHERE source=$1',[source]);
    await pool.query('DELETE FROM audit_logs WHERE target_id=ANY($1::uuid[])',[ids]);
    await pool.query('DELETE FROM security_events WHERE id=ANY($1::uuid[])',[ids]);
   }
   if(activated)await pool.query('UPDATE detection_rules SET enabled=false WHERE id=$1',[seeded.id]);
  }finally{await pool.end();}
 });
 await pool.query('UPDATE detection_rules SET enabled=true WHERE id=$1',[seeded.id]);activated=true;
 const args=Array(20).fill(null);
 args[0]={};args[1]=configFromEnv({});
 args[16]=collectorHandler(connector,eventRepository(pool),detectionEngine(detectionRepository(pool)));
 server=createServer(...args);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const endpoint='http://127.0.0.1:'+server.address().port+'/api/connectors/events';
 const send=(input,key=token,headers={})=>fetch(endpoint,{
  method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key,...headers},
  body:JSON.stringify(input)
 });
 const initial=Date.now()-2000;
 let seq=0;
 const evidence=(kind='access_denied',sourceIp='192.0.2.45')=>({
  eventId:randomUUID(),timestamp:new Date(initial+(seq++*250)).toISOString(),
  kind,sourceIp,subject:'b'.repeat(64)
 });
 const invalid=evidence();
 assert.equal((await send(invalid,'0'.repeat(64))).status,401,'wrong connector key denied');
 assert.equal((await send(invalid,token,{Origin:'https://iphyn.vercel.app'})).status,401,'browser Origin cannot impersonate backend');
 assert.equal((await send({...invalid,password:'do-not-store'})).status,400,'unsolicited secret field rejected');
 assert.equal((await send({...invalid,sourceIp:'unknown'})).status,400,'unverified source identity rejected');
 const noIp=evidence('access_denied',null);
 assert.equal((await send(noIp)).status,200,'honest missing IP remains a recorded MEDIUM event');
 const unrelated=evidence('access_denied','192.0.2.46');
 const first=evidence(),second=evidence(),third=evidence();
 const expectedIds=[];
 for(const input of [unrelated,first,second]){
  const result=await send(input);
  assert.equal(result.status,200);
  const body=await result.json();assert.equal(body.accepted,true);
  expectedIds.push(body.eventId);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM alerts WHERE rule_id=$1',[seeded.id])).rows[0].n,0,
    'null / other-IP / below-threshold observations never satisfy the same group');
 }
 for(const kind of ['login_failed','rate_limit_blocked','privileged_access_denied']){
  const result=await send(evidence(kind));assert.equal(result.status,200);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM alerts WHERE rule_id=$1',[seeded.id])).rows[0].n,0,
   kind+' must not contribute to unauthorized-access threshold');
 }
 const result=await send(third);
 assert.equal(result.status,200);
 const last=await result.json();assert.equal(last.accepted,true);
 const alerts=(await pool.query('SELECT id,rule_id,trigger_event_id,category_code,threat_level,match_evidence FROM alerts WHERE rule_id=$1',[seeded.id])).rows;
 assert.equal(alerts.length,1,'third same-IP application denial creates exactly one persisted alert');
 const alert=alerts[0];
 assert.equal(alert.trigger_event_id,last.eventId);
 assert.equal(alert.category_code,'UNAUTHORIZED_ACCESS');
 assert.equal(alert.threat_level,'HIGH');
 assert.equal(alert.match_evidence.threshold,3);
 assert.equal(alert.match_evidence.windowSeconds,300);
 assert.deepEqual(alert.match_evidence.groupBy,['sourceIp']);
 assert.deepEqual(alert.match_evidence.groupValues,['192.0.2.45']);
 const linked=(await pool.query('SELECT event_id FROM alert_events WHERE alert_id=$1',[alert.id])).rows.map(x=>x.event_id);
 assert.deepEqual(new Set(linked),new Set([expectedIds[1],expectedIds[2],last.eventId]),'three exact true-positive source events linked');
 const events=(await pool.query('SELECT event_type,normalized_data,raw_data FROM security_events WHERE source=$1',[source])).rows;
 assert.equal(events.length,8,'only valid authenticated signals persisted');
 assert.ok(events.every(x=>!JSON.stringify(x.raw_data).includes('do-not-store')&&!Object.hasOwn(x.raw_data,'email')&&!Object.hasOwn(x.raw_data,'password')));
 const replay=await send(third);
 assert.equal(replay.status,200);assert.equal((await replay.json()).eventId,last.eventId);
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM alerts WHERE rule_id=$1',[seeded.id])).rows[0].n,1);
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM security_events WHERE source=$1',[source])).rows[0].n,8,'replay does not duplicate event');
});
