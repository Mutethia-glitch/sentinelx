'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {EVIDENCE_SIGNALS,ISSUERS,normalizeEvidence}=require('../../src/integrations/evidence-catalog');
const {evidenceFeedsConfig,selectFeed,evidenceHandler}=require('../../src/integrations/evidence-feeds');
const {CATEGORY_CODES}=require('../../src/threats/taxonomy');
const {INITIAL_RULES}=require('../../src/rules/initial-rules');
const {eventMatches}=require('../../src/detection/engine');
const SECRET='a'.repeat(64);
const tenant={id:'11111111-1111-4111-8111-111111111111'};
const configs=ISSUERS.map((issuer,i)=>({name:'synthetic-'+issuer,host:'trusted-'+issuer+'.example.invalid',issuer,token:String(i+1).padStart(64,'a')}));
const feeds=evidenceFeedsConfig({SECURITY_EVIDENCE_FEEDS_JSON:JSON.stringify(configs)},tenant);
let number=0;
function sample(signal,patch={}){
 number++;
 return{eventId:'aaaaaaaa-aaaa-4aaa-aaaa-'+String(number).padStart(12,'0'),
 timestamp:new Date().toISOString(),signal,evidenceRef:'provider-record-'+String(number).padStart(8,'0'),
 sourceIp:'192.0.2.11',destinationIp:'198.51.100.33',subject:'b'.repeat(64),...patch};
}
function feedFor(signal){return feeds.find(f=>f.issuer===EVIDENCE_SIGNALS[signal].issuer);}
test('explicit trusted evidence signals cover exactly all fifteen taxonomy categories and rule contracts',()=>{
 assert.equal(Object.keys(EVIDENCE_SIGNALS).length,19);
 assert.deepEqual(new Set(Object.values(EVIDENCE_SIGNALS).map(x=>x.categoryCode)),new Set(CATEGORY_CODES));
 for(const [signal,spec] of Object.entries(EVIDENCE_SIGNALS)){
  const feed=feedFor(signal);
  const event=normalizeEvidence(sample(signal),feed);
  assert.equal(event.source,feed.source);
  assert.equal(event.host,feed.host);
  assert.equal(event.type,spec.type);
  assert.equal(event.action,spec.action);
  assert.equal(event.status,spec.status);
  assert.equal(event.metadata.categoryCode,spec.categoryCode);
  assert.equal(event.metadata.evidenceStatus,'source-attested-not-independently-verified');
  assert.equal(event.metadata.tenantId,tenant.id);
  const rule=INITIAL_RULES.find(x=>x.categoryCode===spec.categoryCode);
  assert.ok(rule,spec.categoryCode);
  assert.equal(rule.enabled,false,'core rules must remain disabled by default');
  assert.equal(eventMatches(event,rule.definition),true,signal+' matches correct core shape');
 }
});
test('website/application tokens cannot fabricate endpoint, identity, mail, analyst, network, storage or CI verdicts',()=>{
 const app=feeds.find(x=>x.issuer==='application');
 for(const signal of Object.keys(EVIDENCE_SIGNALS).filter(x=>EVIDENCE_SIGNALS[x].issuer!=='application'))
  assert.throws(()=>normalizeEvidence(sample(signal),app),{status:400},signal);
 for(const feed of feeds.filter(x=>x.issuer!=='application'))
  assert.throws(()=>normalizeEvidence(sample('app_route_probe'),feed),{status:400});
});
test('fixed evidence fields enforce attribution, timestamp, verdict reference and private data exclusion',()=>{
 const feed=feedFor('app_route_probe'),entry=sample('app_route_probe');
 const event=normalizeEvidence(entry,feed);
 assert.equal(event.severity,'LOW');
 assert.equal(event.rawData.evidenceRef,entry.evidenceRef);
 assert.equal(event.rawData.signal,'app_route_probe');
 for(const extra of ['requestBody','url','password','severity','tenantId','rawData','host','categoryCode']){
  assert.throws(()=>normalizeEvidence({...entry,[extra]:'sensitive'},feed),{status:400});
 }
 for(const patch of [{sourceIp:null},{sourceIp:'not an IP'},{evidenceRef:'free-form text!'},
  {timestamp:'2020-01-01T00:00:00Z'},{subject:'private@example.com'},
  {eventId:'invalid'}])assert.throws(()=>normalizeEvidence({...entry,...patch},feed),{status:400});
 const network=sample('network_dos_verdict',{destinationIp:null});
 assert.throws(()=>normalizeEvidence(network,feedFor('network_dos_verdict')),{status:400});
 const identity=sample('identity_unapproved_elevation',{subject:null});
 assert.throws(()=>normalizeEvidence(identity,feedFor('identity_unapproved_elevation')),{status:400});
});
test('feed config must explicitly identify tenant, issuer, fixed host and unique confidential credentials',()=>{
 assert.equal(evidenceFeedsConfig({},tenant),null);
 assert.equal(evidenceFeedsConfig({SECURITY_EVIDENCE_FEEDS_JSON:'[]'},tenant),null);
 assert.throws(()=>evidenceFeedsConfig({SECURITY_EVIDENCE_FEEDS_JSON:JSON.stringify(configs)},null));
 const original=configs[0];
 for(const patch of [{issuer:'owner'},{host:'http://wrong.example.invalid'},{token:'short'},
  {name:'Wrong_Name'},{password:'extra'}]){
   assert.throws(()=>evidenceFeedsConfig({SECURITY_EVIDENCE_FEEDS_JSON:JSON.stringify([{...original,...patch}])},tenant));
 }
 assert.throws(()=>evidenceFeedsConfig({SECURITY_EVIDENCE_FEEDS_JSON:JSON.stringify([original,original])},tenant));
 assert.deepEqual(selectFeed('Bearer '+configs[0].token,feeds)?.source,feeds[0].source);
 assert.equal(selectFeed('Bearer '+configs[1].token,feeds)?.source,feeds[1].source);
 for(const bad of ['Bearer '+'f'.repeat(64),'Bearer nonsense',undefined,'Bearer '+configs[0].token.slice(1)])
  assert.equal(selectFeed(bad,feeds),null);
});
test('server-to-server evidence endpoint authenticates before reading and deduplicates source UUID',async t=>{
 let writes=0,alertCount=0;const receipts=new Set();
 const repo={async create(event,actor,after,receipt){
  assert.equal(actor,null);assert.match(receipt.source,/^evidence\./);
  assert.equal(event.metadata.tenantId,tenant.id);
  const key=receipt.source+':'+receipt.externalId;
  if(!receipts.has(key)){
   receipts.add(key);writes++;
   await after({id:'record-'+writes,event},{});
  }
  return{id:'record-'+writes};
 }};
 const detector={async evaluate(saved){alertCount++;assert.equal(saved.event.type,'reconnaissance');}};
 const server=http.createServer(evidenceHandler(feeds,repo,detector));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 const url='http://127.0.0.1:'+server.address().port+'/api/connectors/evidence';
 const evidence=sample('app_route_probe'),token=configs.find(x=>x.issuer==='application').token;
 const post=(body=evidence,headers={})=>fetch(url,{method:'POST',
  headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,...headers},body:JSON.stringify(body)});
 assert.equal((await fetch(url)).status,405);
 assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(evidence)})).status,401);
 assert.equal((await post(evidence,{Origin:'https://website.example.invalid'})).status,401);
 assert.equal((await post({...evidence,signal:'endpoint_malware_verdict'})).status,400);
 assert.equal(writes,0);
 const result=await post();assert.equal(result.status,200);
 assert.equal((await result.json()).accepted,true);
 assert.equal((await post()).status,200);
 assert.equal(writes,1);assert.equal(alertCount,1);
});
test('endpoint is absent unless operator explicitly configures issuer feed for tenant',async t=>{
 const {createServer}=require('../../src/api/server');
 const no=createServer({},{origin:'http://localhost:3000',secureCookie:false});
 await new Promise(resolve=>no.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>{no.close(resolve);no.closeAllConnections();}));
 assert.equal((await fetch('http://127.0.0.1:'+no.address().port+'/api/connectors/evidence')).status,404);
});
