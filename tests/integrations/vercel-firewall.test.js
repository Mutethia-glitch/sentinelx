'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {createHmac}=require('node:crypto');
const {vercelFirewallConfig,validSignature,selectFirewallEvent,vercelFirewallHandler,
  MAX_BODY_BYTES,MAX_RECORDS}=require('../../src/integrations/vercel-firewall');
const {ruleInput}=require('../../src/rules/model');
const {eventMatches}=require('../../src/detection/engine');
const {createServer}=require('../../src/api/server');
const preset=require('../../fixtures/rules/iphyn-vercel-waf-web-attacks.json');

const SECRET='disposable-signed-drain-test-secret-2026';
const PROJECT='prj_iphynSynthetic';
const HOST='iphyn.vercel.app';
const RULE_SQL='rule_synthetic_sql_test';
const RULE_XSS='rule_synthetic_xss_test';
const configuration={
 VERCEL_FIREWALL_DRAIN_SECRET:SECRET,
 VERCEL_FIREWALL_PROJECT_ID:PROJECT,
 VERCEL_FIREWALL_HOST:HOST,
 VERCEL_FIREWALL_RULE_MAP:JSON.stringify({[RULE_SQL]:'sql_injection',[RULE_XSS]:'xss'})
};
const config=vercelFirewallConfig(configuration,{id:'11111111-1111-4111-8111-111111111111'});
const input=(change={})=>({
 id:'1573817187330377061717300000',deploymentId:'dpl_abc123def456',
 source:'firewall',host:HOST,timestamp:Date.now(),projectId:PROJECT,
 level:'warning',environment:'production',message:'Do not copy potentially sensitive request body',
 proxy:{host:HOST,path:'/api/private?token=should-never-persist',
   clientIp:'192.0.2.33',wafAction:'deny',wafRuleId:RULE_SQL,statusCode:403,
   userAgent:['private-user-agent']},...change
});
function signed(body){
 const raw=typeof body==='string'?body:JSON.stringify(body);
 return{raw,signature:createHmac('sha1',SECRET).update(raw).digest('hex')};
}
async function serve(t,handler){
 const server=http.createServer(handler);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 return 'http://127.0.0.1:'+server.address().port+'/api/connectors/vercel-firewall';
}
async function post(url,body,headers={}){
 const {raw,signature}=signed(body);
 return fetch(url,{method:'POST',headers:{'Content-Type':'application/json','x-vercel-signature':signature,...headers},body:raw});
}
test('Vercel source stays off by default and requires complete bounded mappings',()=>{
 assert.equal(vercelFirewallConfig({},null),null);
 for(const patch of [{VERCEL_FIREWALL_HOST:''},{VERCEL_FIREWALL_DRAIN_SECRET:'short'},
 {VERCEL_FIREWALL_PROJECT_ID:'wrong/project'},{VERCEL_FIREWALL_RULE_MAP:'{}'},
 {VERCEL_FIREWALL_RULE_MAP:'{"fake":"ransomware"}'},
 {VERCEL_FIREWALL_RULE_MAP:'{"__proto__":"sql_injection"}'}]){
  assert.throws(()=>vercelFirewallConfig({...configuration,...patch},{id:'tenant-a'}));
 }
 assert.throws(()=>vercelFirewallConfig(configuration,null));
 assert.equal(config.source,'vercel-firewall');
 assert.equal(Object.keys(config.rules).length,2);
 assert.equal(config.secret,SECRET);
});
test('signature binds original raw bytes and refuses altered or malformed signatures',()=>{
 const {raw,signature}=signed([input()]);
 assert.equal(validSignature(Buffer.from(raw),signature,SECRET),true);
 assert.equal(validSignature(Buffer.from(raw+' '),signature,SECRET),false);
 for(const bad of ['',undefined,'0'.repeat(40),'g'.repeat(40),'a'.repeat(41)])
  assert.equal(validSignature(Buffer.from(raw),bad,SECRET),false);
});
test('only mapped signed provider firewall denials normalize without raw request data or IP',()=>{
 const selected=selectFirewallEvent(input(),config);
 assert.ok(selected);
 assert.equal(selected.event.source,'vercel-firewall');
 assert.equal(selected.event.host,HOST);
 assert.equal(selected.event.type,'web_application');
 assert.equal(selected.event.action,'sql_injection');
 assert.equal(selected.event.status,'blocked');
 assert.equal(selected.event.severity,'MEDIUM');
 assert.equal(selected.event.sourceIp,null);
 assert.equal(selected.externalId,PROJECT+':'+input().id);
 assert.equal(eventMatches(selected.event,ruleInput(preset).definition),true);
 const text=JSON.stringify(selected.event);
 for(const forbidden of ['private-user-agent','should-never-persist','192.0.2.33','Do not copy'])
  assert.equal(text.includes(forbidden),false,'Untrusted request fields must not be saved.');
 assert.equal(selectFirewallEvent(input({proxy:{...input().proxy,wafRuleId:RULE_XSS}}),config).event.action,'xss');
 assert.equal(preset.enabled,false);
 assert.equal(ruleInput(preset).categoryCode,'WEB_APPLICATION_ATTACK');
});
test('unmapped actions and unrelated/benign logs are not promoted to web attacks',()=>{
 const base=input(),proxy=base.proxy;
 const benign=[
 {source:'lambda'},{source:'build'},{source:'firewall',projectId:'prj_other'},
 {host:'other.vercel.app'},{environment:'preview'},
 {proxy:{...proxy,host:'other.vercel.app'}},
 {proxy:{...proxy,wafRuleId:'rule_generic_limit'}},
 {proxy:{...proxy,wafAction:'log'}},
 {proxy:{...proxy,wafAction:'challenge'}},
 {proxy:{...proxy,wafAction:'rate_limit'}},
 {proxy:{...proxy,statusCode:200}}
 ];
 for(const patch of benign)assert.equal(selectFirewallEvent(input(patch),config),null,JSON.stringify(patch));
 for(const patch of [{id:'<bad>'},{deploymentId:''},{timestamp:Date.now()-16*60*1000},{timestamp:NaN}]){
  assert.throws(()=>selectFirewallEvent(input(patch),config),{status:400});
 }
});
test('HTTP drain rejects unauthenticated input and validates complete batch before any write',async t=>{
 let writes=0,alerts=0;
 const savedIds=new Set();
 const repository={async create(event,actor,after,receipt){
  assert.equal(actor,null);assert.equal(receipt.source,'vercel-firewall');
  assert.equal(event.sourceIp,null);
  if(!savedIds.has(receipt.externalId)){
   savedIds.add(receipt.externalId);writes++;
   await after({id:'saved-'+writes,event},{});
  }
  return{id:'saved-'+writes};
 }};
 const detector={async evaluate(saved){alerts++;assert.equal(saved.event.type,'web_application');}};
 const handler=vercelFirewallHandler(config,repository,detector);
 const url=await serve(t,handler);
 const data=input();
 assert.equal((await fetch(url)).status,405);
 assert.equal((await post(url,[data],{'Content-Type':'text/plain'})).status,415);
 assert.equal((await post(url,[data],{'Origin':'https://iphyn.vercel.app'})).status,415);
 assert.equal((await post(url,[data],{'x-vercel-signature':'00'.repeat(20)})).status,403);
 assert.equal((await post(url,'not json')).status,400);
 assert.equal((await post(url,{})).status,400);
 assert.equal((await post(url,Array.from({length:MAX_RECORDS+1},()=>data))).status,400);
 const malformed=[data,input({id:'<invalid>'})];
 assert.equal((await post(url,malformed)).status,400);
 assert.equal(writes,0,'Batch validation must precede persistence.');
 const huge=JSON.stringify([{...data,message:'x'.repeat(MAX_BODY_BYTES)}]);
 assert.equal((await post(url,huge)).status,413);
 assert.equal(writes,0);
 const unrelated=input({id:'1573817187330377061717300001',proxy:{...data.proxy,wafRuleId:'rule_unknown'}});
 const result=await post(url,[unrelated,data]);
 assert.equal(result.status,200);
 assert.deepEqual(await result.json(),{accepted:true,processed:1,ignored:1});
 assert.equal(writes,1);assert.equal(alerts,1);
 assert.equal((await post(url,[data])).status,200);
 assert.equal(writes,1,'Repository dedup must prevent replayed drain log persistence.');
 assert.equal(alerts,1,'Repository dedup must suppress duplicate detection.');
});
test('optional route remains unreachable without explicit handler and does not alter standard connector',async t=>{
 const opts=Array(18).fill(null);
 opts[0]={};opts[1]={origin:'http://localhost:3000',secureCookie:false};
 const none=createServer(...opts);await new Promise(resolve=>none.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>{none.close(resolve);none.closeAllConnections();}));
 const base='http://127.0.0.1:'+none.address().port;
 assert.equal((await fetch(base+'/api/connectors/vercel-firewall')).status,404);
 opts[17]=vercelFirewallHandler(config,{async create(){return{id:'id'}}},{async evaluate(){}});
 const enabled=createServer(...opts);await new Promise(resolve=>enabled.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>{enabled.close(resolve);enabled.closeAllConnections();}));
 const url='http://127.0.0.1:'+enabled.address().port+'/api/connectors/vercel-firewall';
 assert.equal((await post(url,[input()])).status,200);
});
