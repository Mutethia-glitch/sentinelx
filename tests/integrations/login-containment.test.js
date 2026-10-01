const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loginScope,loginContainmentRepository}=require('../../src/integrations/login-containment');
const {collectorConfig,connectorEvent,collectorHandler}=require('../../src/integrations/collector');
const subject='b'.repeat(64),id='12345678-1234-1234-1234-123456789abc';
const config={source:'iphyn-app',host:'iphyn.vercel.app',containLogin:true};
const event=(kind='login_failed')=>({id,event:{rawData:{kind},sourceIp:'192.0.2.1',user:subject,timestamp:new Date().toISOString(),metadata:{containmentId:id}}});
test('containment scope cannot select another company/source or use missing/untrusted IPs',()=>{
  assert.equal(loginScope({sourceIp:'::ffff:192.0.2.1',subject}).sourceIp,'192.0.2.1');
  for(const body of [{sourceIp:null,subject},{sourceIp:'192.0.2.1',subject,source:'another-company'},{sourceIp:'fe80::1%eth0',subject}])assert.throws(()=>loginScope(body));
  assert.throws(()=>collectorConfig({CONNECTOR_LOGIN_CONTAINMENT:'yes'},null));
});
test('central check remains disabled by default and returns only a capped scope-specific restriction',async()=>{
  let reads=0;
  const repo=loginContainmentRepository({async query(sql,args){reads++;assert.deepEqual(args,['iphyn-app','192.0.2.1',subject]);return {rows:[{trigger_event_id:id,retry_after:299,blocked_until:new Date()}]};}});
  assert.deepEqual(await repo.check({...config,containLogin:false},{sourceIp:'192.0.2.1',subject}),{blocked:false,policyEnabled:false});assert.equal(reads,0);
  const decision=await repo.check(config,{sourceIp:'192.0.2.1',subject});assert.equal(decision.blocked,true);assert.equal(decision.retryAfter,299);assert.equal(decision.containmentId,id);
});
test('five failures prepare a restriction; fewer failures and an existing restriction do not create or extend it',async()=>{
  let count=4,active=false,inserts=0,audits=0;
  const client={async query(sql){
    if(sql.startsWith('SELECT pg_advisory'))return {};
    if(sql.startsWith('SELECT count'))return {rows:[{failures:count}]};
    if(sql.startsWith('INSERT INTO connector_login_blocks')){inserts++;assert.ok(sql.includes('WHERE connector_login_blocks.blocked_until<=clock_timestamp()'));return {rows:active?[]:[{blocked_until:new Date()}]};}
    if(sql.startsWith('INSERT INTO audit_logs')){audits++;return {};}
    throw Error('unexpected query');
  }};
  const repo=loginContainmentRepository({});
  await repo.afterEvent(config,event(),client);assert.equal(inserts,0);
  count=5;await repo.afterEvent(config,event(),client);assert.equal(inserts,1);assert.equal(audits,1);
  active=true;await repo.afterEvent(config,event(),client);assert.equal(audits,1);
});
test('application confirmation requires matching decision and deadline; rejected confirmations are not marked successful',async()=>{
  let accepted=false,audits=0;
  const client={async query(sql,args){
    if(sql.startsWith('SELECT pg_advisory'))return {};
    if(sql.startsWith('UPDATE connector_login_blocks')){assert.equal(args[4],id);assert.ok(sql.includes('BETWEEN created_at AND blocked_until'));return {rows:accepted?[{trigger_event_id:id}]:[]};}
    if(sql.startsWith('INSERT INTO audit_logs')){audits++;return {};}
    throw Error('unexpected query');
  }};
  const repo=loginContainmentRepository({});await assert.rejects(repo.afterEvent(config,event('login_containment_blocked'),client),{status:409});assert.equal(audits,0);
  accepted=true;await repo.afterEvent(config,event('login_containment_blocked'),client);assert.equal(audits,1);
});
test('block reports require a decision ID and never masquerade as failed login evidence',()=>{
  const input={eventId:id,timestamp:new Date().toISOString(),kind:'login_containment_blocked',sourceIp:'192.0.2.1',subject,containmentId:id};
  const normalized=connectorEvent(input,{...config,tenantId:'tenant-a'});
  assert.equal(normalized.action,'login_throttled');assert.equal(normalized.status,'blocked');
  assert.throws(()=>connectorEvent({...input,containmentId:undefined},config));
});
test('failed control preparation rolls back its savepoint and continues detection',async()=>{
  const actual=collectorConfig({CONNECTOR_TOKEN:'a'.repeat(64),CONNECTOR_SOURCE:'iphyn-app',CONNECTOR_HOST:'iphyn.vercel.app',CONNECTOR_LOGIN_CONTAINMENT:'1'},{id:'tenant-a'});
  let detected=false,rolledBack=false,audited=false;
  const client={async query(sql){if(sql.startsWith('ROLLBACK TO'))rolledBack=true;if(sql.includes('LOGIN_CONTAINMENT_FAILED'))audited=true;return {};}};
  const handler=collectorHandler(actual,{async create(e,actor,after){await after({id,event:e},client);return {id};}},{async evaluate(){detected=true;}},{async afterEvent(){throw Error('control unavailable');}});
  const {Readable}=require('node:stream');
  const req=Readable.from([Buffer.from(JSON.stringify({eventId:id,timestamp:new Date().toISOString(),kind:'login_failed',sourceIp:'192.0.2.1',subject}))]);
  req.url='/api/connectors/events';req.method='POST';req.headers={'content-type':'application/json',authorization:'Bearer '+'a'.repeat(64)};
  let status;const res={setHeader(){},end(){status=this.statusCode;}};
  await handler(req,res);assert.equal(status,200);assert.ok(rolledBack&&audited&&detected);
});
test('login decision endpoint authenticates before querying the tenant policy',async t=>{
  const http=require('node:http');let reads=0;
  const actual=collectorConfig({CONNECTOR_TOKEN:'a'.repeat(64),CONNECTOR_SOURCE:'iphyn-app',CONNECTOR_HOST:'iphyn.vercel.app'},{id:'tenant-a'});
  const handler=collectorHandler(actual,{}, {}, {async check(c,body){reads++;assert.equal(c.tenantId,'tenant-a');loginScope(body);return {blocked:false,policyEnabled:false};}});
  const server=http.createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(()=>new Promise(r=>server.close(r)));
  const url=`http://127.0.0.1:${server.address().port}/api/connectors/login-check`;
  const send=authorization=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json',authorization},body:JSON.stringify({sourceIp:'192.0.2.1',subject})});
  assert.equal((await send('Bearer wrong')).status,401);assert.equal(reads,0);
  const response=await send('Bearer '+'a'.repeat(64));assert.equal(response.status,200);assert.equal(reads,1);
  assert.deepEqual(await response.json(),{blocked:false,policyEnabled:false});
});
