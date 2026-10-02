'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {firstPartyMonitor}=require('../../src/integrations/first-party-monitor');
const cfg={origin:'https://sentinelx-iphyn-network.onrender.com',
 tenant:{id:'89238480-9405-49b1-abeb-34bb851612ab'}};
function harness({now=()=>Date.now(),limit=10}={}){
 const events=[],resolutions=[];
 const repo={async create(event,actor,after){events.push(event);assert.equal(actor,null);
  await after({id:'safe-test-event',event},{});
  return{id:'safe-test-event'};
 }};
 const detector={async evaluate(saved){resolutions.push(saved.event);}};
 const monitor=firstPartyMonitor(repo,detector,cfg,{now,limit});
 async function send(path,status,method='GET',address='192.0.2.3'){
  const res=new EventEmitter();res.statusCode=status;
  const req={url:path,method,sentinelxClientAddress:address,headers:{
   authorization:'Bearer must-not-leak',cookie:'secret=must-not-leak',
   'user-agent':'must-not-leak'},
   socket:{remoteAddress:address==='unknown'?'10.0.0.7':address}};
  monitor.observe(req,res);res.emit('finish');
  await new Promise(resolve=>setImmediate(resolve));
 }
 return{events,resolutions,send};
}
test('records actual failed SentinelX password login as privacy-safe tenant-local LOW evidence',async()=>{
 const h=harness();
 await h.send('/api/auth/login',401,'POST');
 assert.equal(h.events.length,1);
 const event=h.events[0];
 assert.equal(event.source,'sentinelx-internal');
 assert.equal(event.host,'sentinelx-iphyn-network.onrender.com');
 assert.equal(event.metadata.tenantId,cfg.tenant.id);
 assert.equal(event.metadata.categoryCode,'BRUTE_FORCE');
 assert.equal(event.type,'authentication');
 assert.equal(event.status,'failed');
 assert.equal(event.severity,'LOW');
 assert.equal(event.sourceIp,'192.0.2.3');
 assert.equal(h.resolutions.length,1);
 assert.deepEqual(Object.keys(event.rawData).sort(),['evidenceRef','signal']);
 assert.equal(event.rawData.signal,'password_login_rejected');
 assert.doesNotMatch(JSON.stringify(event),/must-not-leak|\/api\/auth\/login|Bearer /);
});
test('normal auth, harmless 404, user input in query and ordinary 403 are not invented threats',async()=>{
 const h=harness();
 for(const [path,status,method] of [
  ['/api/auth/login',200,'POST'],['/api/auth/login',202,'POST'],
  ['/api/auth/login',400,'POST'],['/api/auth/me',401,'GET'],
  ['/api/events/11111111-1111-4111-8111-111111111111',404,'GET'],
  ['/api/natural-user-typo',404,'GET'],['/api/access/sites',403,'POST'],
  ['/api/auth/login?query=must-not-leak',500,'POST'],
  ['/dashboard',404,'GET']
 ])await h.send(path,status,method);
 assert.equal(h.events.length,0);
});
test('completed rejection of a narrow known API probe target is low-confidence reconnaissance, not injection proof',async()=>{
 const h=harness();
 await h.send('/api/.git/config?token=must-not-leak',404);
 assert.equal(h.events.length,1);
 const e=h.events[0];
 assert.equal(e.metadata.categoryCode,'RECONNAISSANCE');
 assert.equal(e.rawData.signal,'known_probe_route_rejected');
 assert.equal(e.action,'probe');
 assert.equal(e.status,'rejected');
 assert.doesNotMatch(JSON.stringify(e),/\.git|must-not-leak|token=/);
});
test('actual HTTP 429 is recorded as unclassified throttling, not declared DoS',async()=>{
 const h=harness();
 await h.send('/api/events',429);
 assert.equal(h.events[0].rawData.signal,'api_request_throttled');
 assert.equal(h.events[0].metadata.categoryCode,undefined);
 assert.equal(h.events[0].severity,'LOW');
});
test('bounded per-source sampling, null unverified IP and failed persistence do not affect HTTP outcome',async()=>{
 const h=harness({limit:2});
 await h.send('/api/auth/login',401,'POST','unknown');
 await h.send('/api/auth/login',401,'POST','unknown');
 await h.send('/api/auth/login',401,'POST','unknown');
 assert.equal(h.events.length,2);
 assert.equal(h.events[0].sourceIp,null);
 const bad=firstPartyMonitor({async create(){throw new Error('test-db-failure');}},null,cfg);
 const res=new EventEmitter();res.statusCode=401;
 bad.observe({url:'/api/auth/login',method:'POST',socket:{remoteAddress:'192.0.2.3'}},res);
 assert.doesNotThrow(()=>res.emit('finish'));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(res.statusCode,401);
});

test('actual tenant HTTP routing feeds self observations without changing response codes',async t=>{
 const {createServer}=require('../../src/api/server');
 const {AuthError}=require('../../src/auth/errors');
 const received=[];
 const repo={async create(event,actor,after){
  received.push(event);
  await after({id:'observed',event},{});
  return{id:'observed'};
 }};
 const config={...cfg,origin:'http://127.0.0.1:45678',
  cookieName:'sentinelx_session',challengeCookieName:'sentinelx_2fa',
  trustedProxyIps:[],sessionSeconds:3600,secureCookie:false};
 const monitor=firstPartyMonitor(repo,null,config);
 const args=Array(21).fill(null);
 args[0]={async login(){throw new AuthError(401,'Invalid email or password.');}};
 args[1]=config;args[20]=monitor;
 const server=createServer(...args);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 const base='http://127.0.0.1:'+server.address().port;
 const missed=await fetch(base+'/api/.git/config?secret=must-not-leak');
 assert.equal(missed.status,404);
 const rejected=await fetch(base+'/api/auth/login',{
  method:'POST',headers:{Origin:config.origin,'Content-Type':'application/json'},
  body:JSON.stringify({email:'private@example.test',password:'must-not-leak'})});
 assert.equal(rejected.status,401);
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(received.map(e=>e.rawData.signal),
  ['known_probe_route_rejected','password_login_rejected']);
 assert.ok(received.every(e=>!JSON.stringify(e).includes('must-not-leak')));
 assert.ok(received.every(e=>!JSON.stringify(e).includes('private@example.test')));
});
