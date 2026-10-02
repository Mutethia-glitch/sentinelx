'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {createPool}=require('../../src/data/pool');
const {executeSql}=require('../../src/data/postgres');
const {migrationSql}=require('../../scripts/migrate');
const {authRepository}=require('../../src/data/auth-repository');
const {authService}=require('../../src/auth/service');
const {hashPassword}=require('../../src/auth/passwords');
const {accessRepository}=require('../../src/data/access-repository');
const {accessService}=require('../../src/access/service');
const {managedEvidenceRepository}=require('../../src/data/managed-evidence-repository');
const {evidenceHandler}=require('../../src/integrations/evidence-feeds');
const {eventRepository}=require('../../src/data/event-repository');
const {createServer}=require('../../src/api/server');
const {configFromEnv}=require('../../src/auth/config');
test('managed issuer feed has tenant-local one-time issuance, backend RBAC, real ingest, dedup and atomic revocation',async t=>{
 assert.equal(process.env.SENTINELX_TEST_DATABASE,'1','Use disposable PostgreSQL only.');
 executeSql(migrationSql());
 const pool=createPool(),tenantId=randomUUID(),ids=[],name='approved-idp-'+randomUUID().slice(0,8);
 let server,source='evidence.'+name;
 t.after(async()=>{
  if(server)await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});
  await pool.query(`DELETE FROM audit_logs WHERE actor_id=ANY($1::uuid[]) OR
    (target_type='security_event' AND target_id IN (SELECT id FROM security_events WHERE source=$2)) OR
    (target_type='managed_evidence_feed' AND target_id IN (SELECT id FROM managed_evidence_feeds WHERE name=$3))`,[ids,source,name]);
  await pool.query('DELETE FROM connector_receipts WHERE source=$1',[source]);
  await pool.query('DELETE FROM security_events WHERE source=$1',[source]);
  await pool.query('DELETE FROM managed_evidence_feeds WHERE name=$1',[name]);
  await pool.query('DELETE FROM auth_sessions WHERE user_id=ANY($1::uuid[])',[ids]);
  await pool.query('DELETE FROM user_roles WHERE user_id=ANY($1::uuid[])',[ids]);
  await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[ids]);
  await pool.end();
 });
 const authRepo=authRepository(pool),secret='Disposable managed provider test passphrase 12345!';
 const hashed=await hashPassword(secret);
 for(const role of ['Administrator','Viewer/Management']){
  const id=await authRepo.createUser('managed-'+randomUUID()+'@example.invalid',role,hashed,'disposable fixture');
  ids.push(id);
  await pool.query('INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE name=$2',[id,role]);
 }
 const config=configFromEnv({});config.tenant={id:tenantId,name:'Disposable Company',slug:'disposable-company'};
 const registry=managedEvidenceRepository(pool,tenantId);
 const auth=authService(authRepo,config);
 const service=accessService(accessRepository(pool),auth,{managedEvidence:registry,configuredFeeds:[]});
 let detections=0;
 const detector={async evaluate(saved){detections++;assert.equal(saved.event.metadata.categoryCode,'CREDENTIAL_ATTACK');}};
 const args=Array(21).fill(null);
 args[0]=auth;args[1]=config;args[2]=service;
 args[18]=evidenceHandler(null,eventRepository(pool),detector,registry);
 server=createServer(...args);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 config.origin=base;
 const admin=(await auth.login({email:(await pool.query('SELECT email FROM users WHERE id=$1',[ids[0]])).rows[0].email,password:secret})).token;
 const viewer=(await auth.login({email:(await pool.query('SELECT email FROM users WHERE id=$1',[ids[1]])).rows[0].email,password:secret})).token;
 const api=(method,path,session,body)=>fetch(base+path,{method,headers:{
  ...(session?{Cookie:config.cookieName+'='+session}:{}),
  ...(method==='POST'?{Origin:base,'Content-Type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await api('GET','/api/access/evidence-feeds',null)).status,401);
 assert.equal((await api('GET','/api/access/evidence-feeds',viewer)).status,403);
 assert.equal((await api('POST','/api/access/evidence-feeds',viewer,{name,host:'idp.example.com',issuer:'identity'})).status,403);
 const bad=await api('POST','/api/access/evidence-feeds',admin,{name,issuer:'identity',host:'127.0.0.1'});
 assert.equal(bad.status,400);
 const issued=await api('POST','/api/access/evidence-feeds',admin,{name,issuer:'identity',host:'idp.example.com'});
 assert.equal(issued.status,201);
 const feed=(await issued.json()).feed;
 assert.match(feed.token,/^[0-9a-f]{64}$/);
 assert.equal(feed.providerIdentityVerified,false);
 assert.equal(feed.endpoint,'/api/connectors/evidence');
 assert.equal((await api('POST','/api/access/evidence-feeds',admin,{name,issuer:'identity',host:'idp.example.com'})).status,409);
 const listing=await api('GET','/api/access/evidence-feeds',admin);
 assert.equal(listing.status,200);
 const displayed=await listing.json();
 assert.equal(displayed.feeds[0].status,'ISSUED');
 assert.equal(JSON.stringify(displayed).includes(feed.token),false);
 const datum={eventId:randomUUID(),timestamp:new Date().toISOString(),signal:'identity_password_spray',
  evidenceRef:'issuer-test-record:12345678',sourceIp:'192.0.2.9'};
 const send=(data,token=feed.token)=>fetch(base+'/api/connectors/evidence',{method:'POST',
  headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(data)});
 assert.equal((await send({...datum,signal:'endpoint_malware_verdict'})).status,400);
 assert.equal((await send(datum,'f'.repeat(64))).status,401);
 assert.equal((await send(datum)).status,200);
 assert.equal((await send(datum)).status,200);
 assert.equal(detections,1,'Receipt retry cannot redetect');
 assert.equal((await registry.list())[0].status,'REPORTING');
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM security_events WHERE source=$1',[source])).rows[0].n,1);
 assert.equal((await api('POST','/api/access/evidence-feeds/'+feed.id+'/revoke',viewer,{reason:'No'})).status,403);
 assert.equal((await api('POST','/api/access/evidence-feeds/'+feed.id+'/revoke',admin,{reason:'End disposable test'})).status,200);
 assert.equal((await send({...datum,eventId:randomUUID()})).status,401);
 assert.equal((await api('POST','/api/access/evidence-feeds/'+feed.id+'/revoke',admin,{reason:'Repeat'})).status,404);
 assert.equal(detections,1);
});
