const {test} = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {collectorConfig,connectorEvent,collectorHandler} = require('../../src/integrations/collector');
const {eventRepository} = require('../../src/data/event-repository');
const token = 'a'.repeat(64);
const config = collectorConfig({CONNECTOR_TOKEN:token,CONNECTOR_SOURCE:'iphyn-app',CONNECTOR_HOST:'iphyn.vercel.app'}, {id:'tenant-a'});
const input = () => ({eventId:'12345678-1234-1234-1234-123456789abc',timestamp:new Date().toISOString(),kind:'login_failed',sourceIp:null});
test('connector disabled by default and incomplete configuration fails closed',()=>{
  assert.equal(collectorConfig({},null),null);
  assert.throws(()=>collectorConfig({CONNECTOR_TOKEN:token},null));
});
test('connector controls tenant/source/host and rejects secrets, forged identity and stale timestamps',()=>{
  const event = connectorEvent(input(),config);
  assert.equal(event.source,'iphyn-app'); assert.equal(event.host,'iphyn.vercel.app');
  assert.equal(event.metadata.tenantId,'tenant-a'); assert.equal(event.status,'failed');
  for (const key of ['password','cookie','rawData','tenantId','host','source']) assert.throws(()=>connectorEvent({...input(),[key]:'secret'},config));
  assert.throws(()=>connectorEvent({...input(),timestamp:'2020-01-01T00:00:00Z'},config));
  assert.throws(()=>connectorEvent({...input(),sourceIp:'forged'},config));
  assert.throws(()=>connectorEvent({...input(),sourceIp:42},config));
  assert.throws(()=>connectorEvent({...input(),subject:['a'.repeat(64)]},config));
});
test('HTTP connector rejects browser/invalid credentials before persistence and passes bounded events to detector',async t=>{
  let writes=0;
  const handler=collectorHandler(config,{async create(event,actor,after,receipt){writes++;assert.equal(actor,null);assert.equal(receipt.source,'iphyn-app');await after({id:'saved'},{});return {id:'saved'};}},{async evaluate(){}});
  const server=http.createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(()=>new Promise(r=>server.close(r)));
  const url=`http://127.0.0.1:${server.address().port}/api/connectors/events`;
  async function post(headers={},body=input()){return fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});}
  assert.equal((await post()).status,401);
  assert.equal((await post({Authorization:'Bearer wrong'})).status,401);
  assert.equal((await post({Authorization:'Bearer '+token,Origin:'https://iphyn.vercel.app'})).status,401);
  assert.equal(writes,0);
  assert.equal((await post({Authorization:'Bearer '+token},{...input(),password:'secret'})).status,400);
  const response=await post({Authorization:'Bearer '+token});assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{eventId:'saved',accepted:true});assert.equal(writes,1);
});
test('repository retries reuse the event and detector failures roll back receipts and audit writes',async()=>{
  let committed={row:null,receipt:false,audits:0},pending=null,detected=0;
  const client={release(){},async query(sql,args){
    if(sql==='BEGIN'){pending={...committed};return {};}
    if(sql==='COMMIT'){committed=pending;return {};}
    if(sql==='ROLLBACK'){pending=null;return {};}
    if(sql.includes('pg_advisory_xact_lock'))return {};
    if(sql.startsWith('SELECT e.*'))return {rows:pending.receipt?[pending.row]:[]};
    if(sql.startsWith('INSERT INTO security_events')){
      pending.row={id:'saved',source:args[0],event_type:args[1],occurred_at:new Date(args[2]),received_at:new Date(),normalized_at:new Date(),raw_data:JSON.parse(args[3]),normalized_data:JSON.parse(args[4])};
      return {rows:[pending.row]};
    }
    if(sql.startsWith('INSERT INTO connector_receipts')){pending.receipt=true;return {};}
    if(sql.startsWith('INSERT INTO audit_logs')){pending.audits++;return {};}
    throw Error('Unexpected query');
  }};
  const repo=eventRepository({async connect(){return client;}});
  const event=connectorEvent(input(),config),receipt={source:config.source,externalId:input().eventId};
  await assert.rejects(repo.create(event,null,async()=>{throw Error('detector failure');},receipt));
  assert.deepEqual(committed,{row:null,receipt:false,audits:0});
  const after=async()=>{detected++;};
  const first=await repo.create(event,null,after,receipt);
  const second=await repo.create(event,null,after,receipt);
  assert.equal(first.id,second.id);assert.equal(detected,1);assert.equal(committed.audits,1);
});

test('connector severity is evidence-based and cannot be supplied by callers',()=>{
  for(const [kind,severity] of Object.entries({login_failed:'LOW',access_denied:'MEDIUM',rate_limit_blocked:'MEDIUM',login_containment_blocked:'HIGH',privileged_access_denied:'HIGH'})){
    const body={...input(),kind,...(kind==='login_containment_blocked'?{sourceIp:'192.0.2.1',subject:'b'.repeat(64),containmentId:input().eventId}:{})};
    const event=connectorEvent(body,config);
    assert.equal(event.severity,severity);assert.equal(event.metadata.severityPolicy,'connector-v1');
    assert.ok(event.metadata.severityReason.length>20);
    assert.throws(()=>connectorEvent({...body,severity:'CRITICAL'},config));
  }
  assert.throws(()=>connectorEvent({...input(),kind:'ransomware'},config));
});

test('Iphyn denied access has accurate unauthorized-access normalization without promoting unrelated signals',()=>{
  const {eventMatches}=require('../../src/detection/engine');
  const {INITIAL_RULES}=require('../../src/rules/initial-rules');
  const rule=INITIAL_RULES.find(item=>item.categoryCode==='UNAUTHORIZED_ACCESS');
  assert.ok(rule);
  assert.equal(rule.enabled,false,'the tenant administrator must explicitly enable a vetted rule');
  assert.equal(rule.definition.threshold,3);
  assert.equal(rule.definition.windowSeconds,300);
  const body={...input(),kind:'access_denied',sourceIp:'192.0.2.88',subject:'b'.repeat(64)};
  const denied=connectorEvent(body,config);
  assert.equal(denied.source,'iphyn-app');
  assert.equal(denied.host,'iphyn.vercel.app');
  assert.equal(denied.type,'access');
  assert.equal(denied.action,'access_denied');
  assert.equal(denied.status,'denied');
  assert.equal(denied.severity,'MEDIUM');
  assert.equal(denied.user,body.subject);
  assert.equal(eventMatches(denied,rule.definition),true);
  for (const kind of ['login_failed','rate_limit_blocked','privileged_access_denied']){
    assert.equal(eventMatches(connectorEvent({...body,kind},config),rule.definition),false,
      kind+' must not masquerade as repeated unauthorized access');
  }
  assert.throws(()=>connectorEvent({...body,kind:'web_attack'},config),
    'unsupported attack labels are not accepted as evidence');
});
