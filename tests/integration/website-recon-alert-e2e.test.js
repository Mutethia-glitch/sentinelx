'use strict';
// Task 41: real HTTP website receiver -> transactionally stored source evidence ->
// PostgreSQL correlation -> persisted alert; all writes confined to disposable CI DB.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID,randomBytes}=require('node:crypto');
const {createPool}=require('../../src/data/pool');
const {executeSql}=require('../../src/data/postgres');
const {migrationSql}=require('../../scripts/migrate');
const {authRepository}=require('../../src/data/auth-repository');
const {websiteRepository}=require('../../src/data/website-repository');
const {eventRepository}=require('../../src/data/event-repository');
const {detectionRepository}=require('../../src/data/detection-repository');
const {detectionEngine}=require('../../src/detection/engine');
const {siteCollectorHandler}=require('../../src/integrations/site-collector');
const {createServer}=require('../../src/api/server');
const {configFromEnv}=require('../../src/auth/config');

test('Iphyn-shape website route probes generate ONE MEDIUM reconnaissance alert only after three source-attested decisions',async t=>{
 assert.equal(process.env.SENTINELX_TEST_DATABASE,'1','Use disposable PostgreSQL only.');
 executeSql(migrationSql());
 const pool=createPool();
 const tenantId=randomUUID(),actorId=randomUUID(),siteId=randomUUID();
 const hostname='ci-recon-'+siteId.slice(0,8)+'.example.com';
 const origin='https://'+hostname,token=randomBytes(32).toString('hex');
 const source='site.'+siteId,ruleName='SX-CORE-006 Reconnaissance activity';
 const website=websiteRepository(pool),events=eventRepository(pool),detector=detectionEngine(detectionRepository(pool));
 const config=configFromEnv({});
 let server=null,siteRegistered=false,userCreated=false,profileCreated=false,ruleActivated=false;
 t.after(async()=>{
  try{
   if(server)await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});
   if(siteRegistered){
    const ids=(await pool.query('SELECT id FROM security_events WHERE source=$1',[source])).rows.map(row=>row.id);
    if(ids.length){
     await pool.query('DELETE FROM alert_events WHERE event_id=ANY($1::uuid[])',[ids]);
     await pool.query('DELETE FROM alerts WHERE trigger_event_id=ANY($1::uuid[])',[ids]);
     await pool.query('DELETE FROM connector_receipts WHERE source=$1',[source]);
     await pool.query('DELETE FROM audit_logs WHERE target_id=ANY($1::uuid[])',[ids]);
     await pool.query('DELETE FROM security_events WHERE id=ANY($1::uuid[])',[ids]);
    }
    await pool.query('DELETE FROM audit_logs WHERE target_id=$1 OR actor_id=$2',[siteId,actorId]);
    await pool.query('DELETE FROM website_connectors WHERE id=$1',[siteId]);
   }
   if(ruleActivated)await pool.query('UPDATE detection_rules SET enabled=false WHERE name=$1',[ruleName]);
   if(userCreated){
    await pool.query('DELETE FROM user_roles WHERE user_id=$1',[actorId]);
    await pool.query('DELETE FROM users WHERE id=$1',[actorId]);
   }
   if(profileCreated)await pool.query('DELETE FROM tenant_profile WHERE tenant_id=$1',[tenantId]);
  }finally{await pool.end();}
 });
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM tenant_profile')).rows[0].n,0);
 await pool.query('INSERT INTO tenant_profile(singleton,tenant_id,company_name,slug,requested_website_origin) VALUES(true,$1,$2,$3,$4)',[tenantId,'CI Iphyn-shaped site','ci-iphyn-recon',origin]);
 profileCreated=true;
 await pool.query('INSERT INTO users(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)',[actorId,'ci-'+actorId+'@example.invalid','Disposable CI Administrator','not a usable password hash']);
 userCreated=true;
 await pool.query("INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE name='Administrator'",[actorId]);
 const issued=await website.register(actorId,siteId,origin,token);siteRegistered=true;
 assert.equal(issued.status,'ISSUED');
 const before=(await pool.query('SELECT id,enabled,version,definition,threat_level FROM detection_rules WHERE name=$1',[ruleName])).rows[0];
 assert.ok(before&&!before.enabled,'Core rule must start disabled on CI database');
 assert.equal(before.version,2);assert.equal(before.definition.threshold,3);
 assert.equal(before.definition.windowSeconds,120);
 assert.deepEqual(before.definition.groupBy,['sourceIp','host']);
 assert.equal(before.threat_level,'MEDIUM');
 await pool.query('UPDATE detection_rules SET enabled=true WHERE id=$1',[before.id]);ruleActivated=true;
 const args=Array(20).fill(null);
 args[0]={};args[1]=config;
 args[19]=siteCollectorHandler(website,events,detector,tenantId);
 server=createServer(...args);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const endpoint='http://127.0.0.1:'+server.address().port+'/api/connectors/site-events';
 const deliver=(evidence,key=token,headers={})=>fetch(endpoint,{method:'POST',
  headers:{'Content-Type':'application/json',Authorization:'Bearer '+key,...headers},
  body:JSON.stringify(evidence)});
 const baseTime=Date.now()-1500;
 let sequence=0;
 const evidence=(ip='192.0.2.214')=>{
  const uuid=randomUUID();
  return{eventId:uuid,timestamp:new Date(baseTime+(sequence++*250)).toISOString(),
   signal:'app_route_probe',evidenceRef:'ci.iphyn.route:'+uuid,sourceIp:ip};
 };
 const negative=evidence();
 assert.equal((await deliver(negative,'f'.repeat(64))).status,401,'unknown key rejected');
 assert.equal((await deliver(negative,token,{Origin:'https://invalid.example'})).status,401,'browser evidence rejected');
 assert.equal((await deliver({...negative,signal:'endpoint_malware_verdict'})).status,400,'website cannot assert EDR verdict');
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM security_events WHERE source=$1',[source])).rows[0].n,0);
 const input1=evidence(),input2=evidence(),differentIp=evidence('192.0.2.215'),input3=evidence();
 const accepted=[];
 for(const input of [input1,input2,differentIp]){
  const response=await deliver(input);
  assert.equal(response.status,200);
  const body=await response.json();assert.equal(body.accepted,true);accepted.push(body.eventId);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM alerts WHERE rule_id=$1',[before.id])).rows[0].n,0,
   'below-threshold or unrelated source-IP evidence must not create an alert');
 }
 let result=await deliver(input3);
 assert.equal(result.status,200);
 const third=await result.json();accepted.push(third.eventId);
 let rows=(await pool.query('SELECT id,source,event_type,raw_data,normalized_data FROM security_events WHERE source=$1 ORDER BY occurred_at,id',[source])).rows;
 assert.equal(rows.length,4,'every accepted unique website decision persisted');
 assert.ok(rows.every(x=>x.source===source&&x.event_type==='reconnaissance'));
 assert.ok(rows.every(x=>x.normalized_data.host===hostname&&x.normalized_data.metadata.categoryCode==='RECONNAISSANCE'));
 assert.ok(rows.every(x=>x.raw_data.signal==='app_route_probe'&&!Object.hasOwn(x.raw_data,'password')&&!Object.hasOwn(x.raw_data,'email')));
 const alerts=(await pool.query('SELECT * FROM alerts WHERE rule_id=$1',[before.id])).rows;
 assert.equal(alerts.length,1,'third same-group event persisted exactly one alert');
 const alert=alerts[0];
 assert.equal(alert.trigger_event_id,third.eventId);
 assert.equal(alert.category_code,'RECONNAISSANCE');
 assert.equal(alert.threat_level,'MEDIUM');
 assert.equal(alert.match_evidence.threshold,3);
 assert.equal(alert.match_evidence.windowSeconds,120);
 assert.deepEqual(alert.match_evidence.groupBy,['sourceIp','host']);
 assert.deepEqual(alert.match_evidence.groupValues,['192.0.2.214',hostname]);
 const linked=(await pool.query('SELECT event_id FROM alert_events WHERE alert_id=$1',[alert.id])).rows.map(x=>x.event_id);
 assert.equal(linked.length,3);
 assert.deepEqual(new Set(linked),new Set([accepted[0],accepted[1],accepted[3]]));
 result=await deliver(input3);
 assert.equal(result.status,200,'same external event ID is idempotent');
 assert.equal((await result.json()).eventId,third.eventId);
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM alerts WHERE rule_id=$1',[before.id])).rows[0].n,1);
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM security_events WHERE source=$1',[source])).rows[0].n,4);
 const reporting=(await pool.query('SELECT status,last_event_at FROM website_connectors WHERE id=$1',[siteId])).rows[0];
 assert.equal(reporting.status,'REPORTING');assert.ok(reporting.last_event_at);
 await website.revoke(actorId,siteId,'Disposable acceptance complete');
 assert.equal((await deliver(evidence())).status,401,'revoked key must not create events');
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM alerts WHERE rule_id=$1',[before.id])).rows[0].n,1);
});
