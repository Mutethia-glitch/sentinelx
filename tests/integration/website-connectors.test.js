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
const {websiteRepository}=require('../../src/data/website-repository');
const {siteCollectorHandler}=require('../../src/integrations/site-collector');
const {createServer}=require('../../src/api/server');
const {configFromEnv}=require('../../src/auth/config');
const {websiteOrigin}=require('../../src/platform/website');

test('website request validates exact HTTPS origins and never attempts outbound site access',()=>{
 assert.equal(websiteOrigin('https://www.acme.com'),'https://www.acme.com');
 assert.equal(websiteOrigin('https://iphyn.vercel.app'),'https://iphyn.vercel.app');
 assert.equal(websiteOrigin(''),null);
 for(const url of ['http://acme.com','https://127.0.0.1','https://localhost','https://acme.internal',
 'https://user@acme.com','https://acme.com:8443','https://acme.com/.env',
 'https://acme.com?token=secret','https://evil.com#section','https://acme.com.evil/robots',
 'https://acme.com/other',' https://acme.com']){
  assert.throws(()=>websiteOrigin(url,false),{status:400},url);
 }
});
test('only tenant Administrators issue/revoke one-time site keys, and application-only evidence stops on revocation',async t=>{
 assert.equal(process.env.SENTINELX_TEST_DATABASE,'1','Use disposable PostgreSQL only.');
 executeSql(migrationSql());
 const pool=createPool();
 const ids=[],uuid=randomUUID(),secret='A disposable site test passphrase 12345!';
 const config=configFromEnv({});
 let server;
 t.after(async()=>{
  if(server)await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});
  await pool.query('DELETE FROM audit_logs WHERE actor_id=ANY($1::uuid[]) OR target_id=ANY($1::uuid[])',[ids]);
  await pool.query('DELETE FROM website_connectors WHERE created_by=ANY($1::uuid[])',[ids]);
  await pool.query('DELETE FROM tenant_profile WHERE tenant_id=$1',[uuid]);
  await pool.query('DELETE FROM auth_sessions WHERE user_id=ANY($1::uuid[])',[ids]);
  await pool.query('DELETE FROM user_roles WHERE user_id=ANY($1::uuid[])',[ids]);
  await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[ids]);
  await pool.end();
 });
 const authRepo=authRepository(pool),website=websiteRepository(pool);
 const hash=await hashPassword(secret);
 const adminEmail='task41-site-admin-'+randomUUID()+'@example.invalid',viewerEmail='task41-site-viewer-'+randomUUID()+'@example.invalid';
 const adminId=await authRepo.createUser(adminEmail,'Site Administrator',hash,'Disposable test');
 const viewerId=await authRepo.createUser(viewerEmail,'Site Viewer',hash,'Disposable test');
 ids.push(adminId,viewerId);
 await pool.query('INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE name=$2',
   [adminId,'Administrator']);
 await pool.query('INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE name=$2',
   [viewerId,'Viewer/Management']);
 await pool.query('INSERT INTO tenant_profile(singleton,tenant_id,company_name,slug,requested_website_origin) VALUES(true,$1,$2,$3,$4)',
   [uuid,'Synthetic Site Company','synthetic-site','https://www.acme.com']);
 const auth=authService(authRepo,config);
 const service=accessService(accessRepository(pool),auth,{websites:website,tenant:{id:uuid,name:'Synthetic Site Company',slug:'synthetic-site'}});
 let detections=0;
 const receiptRepo={async create(event,actor,after,receipt){
  assert.equal(actor,null);
  assert.match(receipt.source,/^site\.[a-f0-9-]{36}$/);
  assert.equal(event.source,receipt.source);
  assert.equal(event.host,'www.acme.com');
  await after({id:'12345678-1234-1234-1234-123456789abc',event},pool);
  return{id:'12345678-1234-1234-1234-123456789abc'};
 }};
 const siteHandler=siteCollectorHandler(website,receiptRepo,{async evaluate(saved){
  detections++;assert.equal(saved.event.type,'reconnaissance');
 }},uuid);
 const args=Array(20).fill(null);
 args[0]=auth;args[1]=config;args[2]=service;args[19]=siteHandler;
 server=createServer(...args);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const adminSession=await auth.login({email:adminEmail,password:secret});
 const viewerSession=await auth.login({email:viewerEmail,password:secret});
 const adminHeaders={Cookie:config.cookieName+'='+adminSession.token};
 const viewerHeaders={Cookie:config.cookieName+'='+viewerSession.token};
 const mutation={Origin:config.origin,'Content-Type':'application/json'};
 const post=(path,headers,body)=>fetch(base+path,{method:'POST',headers:{...mutation,...headers},body:JSON.stringify(body)});
 assert.equal((await fetch(base+'/api/access/sites')).status,401);
 assert.equal((await fetch(base+'/api/access/sites',{headers:viewerHeaders})).status,403);
 assert.equal((await post('/api/access/sites',viewerHeaders,{origin:'https://www.acme.com'})).status,403);
 assert.equal((await post('/api/access/sites',adminHeaders,{origin:'http://127.0.0.1'})).status,400);
 assert.equal((await post('/api/access/sites',adminHeaders,{origin:'https://www.acme.com',category:'MALWARE'})).status,400);
 const issued=await post('/api/access/sites',adminHeaders,{origin:'https://www.acme.com'});
 assert.equal(issued.status,201);
 const site=await issued.json();
 assert.match(site.token,/^[a-f0-9]{64}$/);
 assert.equal(site.shownOnce,true);assert.equal(site.domainOwnershipVerified,false);
 assert.equal(site.endpoint,'/api/connectors/site-events');
 const record=await fetch(base+'/api/access/sites',{headers:adminHeaders});
 assert.equal(record.status,200);
 const listed=await record.json();
 assert.equal(listed.requestedWebsite,'https://www.acme.com');
 assert.equal(listed.sites.length,1);
 assert.equal(listed.sites[0].status,'ISSUED');
 assert.equal(JSON.stringify(listed).includes(site.token),false);
 assert.equal((await post('/api/access/sites',adminHeaders,{origin:site.origin})).status,409);
 const evidence={eventId:randomUUID(),timestamp:new Date().toISOString(),signal:'app_route_probe',
  evidenceRef:'backend-verdict-ci-0001',sourceIp:'192.0.2.22'};
 const deliver=(data,headers={})=>fetch(base+site.endpoint,{method:'POST',
   headers:{'Content-Type':'application/json',Authorization:'Bearer '+site.token,...headers},
   body:JSON.stringify(data)});
 assert.equal((await deliver(evidence,{Origin:config.origin})).status,401);
 assert.equal((await deliver({...evidence,signal:'endpoint_malware_verdict'})).status,400);
 assert.equal((await deliver(evidence)).status,200);
 assert.equal(detections,1);
 const reporting=await fetch(base+'/api/access/sites',{headers:adminHeaders});
 assert.equal((await reporting.json()).sites[0].status,'REPORTING');
 const revoke=await post('/api/access/sites/'+site.id+'/revoke',adminHeaders,{reason:'End synthetic source'});
 assert.equal(revoke.status,200);
 assert.equal((await deliver({...evidence,eventId:randomUUID()})).status,401);
 assert.equal((await post('/api/access/sites/'+site.id+'/revoke',adminHeaders,{reason:'Repeated'})).status,404);
});
