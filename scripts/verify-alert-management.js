const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createPool } = require('../src/data/pool');
const { alertRepository } = require('../src/data/alert-repository');
const { eventRepository } = require('../src/data/event-repository');
const { authRepository } = require('../src/data/auth-repository');
const { accessRepository } = require('../src/data/access-repository');
const { authService } = require('../src/auth/service');
const { accessService } = require('../src/access/service');
const { alertService } = require('../src/alerts/service');
const { eventViewService } = require('../src/events/view-service');
const { configFromEnv } = require('../src/auth/config');
const { hashPassword } = require('../src/auth/passwords');
const { createServer } = require('../src/api/server');

async function alertManagementFixture(pool) {
  const users=[], eventIds=[], alertIds=[];
  let ruleId,server;
  async function cleanup(){
    if(server)await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});
    const ids=users.map(user=>user.id);
    if(alertIds.length){await pool.query('DELETE FROM audit_logs WHERE target_id=ANY($1::uuid[])',[alertIds]);await pool.query('DELETE FROM alert_events WHERE alert_id=ANY($1::uuid[])',[alertIds]);await pool.query('DELETE FROM alerts WHERE id=ANY($1::uuid[])',[alertIds]);}
    if(eventIds.length)await pool.query('DELETE FROM security_events WHERE id=ANY($1::uuid[])',[eventIds]);
    if(ruleId)await pool.query('DELETE FROM detection_rules WHERE id=$1',[ruleId]);
    if(ids.length){await pool.query('DELETE FROM audit_logs WHERE actor_id=ANY($1::uuid[])',[ids]);await pool.query('DELETE FROM auth_sessions WHERE user_id=ANY($1::uuid[])',[ids]);await pool.query('DELETE FROM user_roles WHERE user_id=ANY($1::uuid[])',[ids]);await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[ids]);}
  }
  try{
    const password='Synthetic alert management passphrase',hash=await hashPassword(password),authRepo=authRepository(pool);
    for(const role of ['Administrator','Security Analyst','Viewer/Management']){
      const email=`${randomUUID()}@example.invalid`,id=await authRepo.createUser(email,'Synthetic alert tester',hash,'local synthetic verifier');users.push({id,email,role});
      await pool.query('INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE name=$2',[id,role]);
    }
    // Reuse any catalog category without changing user configuration.
    const category=(await pool.query('SELECT code FROM threat_categories WHERE enabled ORDER BY code LIMIT 1')).rows[0];
    assert.ok(category,'At least one selectable category is required.');
    const source=`task16-${randomUUID()}`,malicious='<img src=x onerror=alert(1)> 100%_';
    ruleId=(await pool.query(`INSERT INTO detection_rules(name,description,enabled,definition,threat_level,category_code) VALUES($1,'synthetic',false,'{}','HIGH',$2) RETURNING id`,[`Task 16 ${malicious} ${randomUUID()}`,category.code])).rows[0].id;
    const input={timestamp:'2026-09-30T00:00:00Z',source,type:'authentication',sourceIp:'192.0.2.16',destinationIp:null,user:malicious,host:'task16-host',action:'login',status:'failed',severity:'MEDIUM',rawData:{synthetic:true,html:malicious},metadata:{}};
    const event=await eventRepository(pool).create(input);eventIds.push(event.id);
    const earlier=await eventRepository(pool).create({...input,timestamp:'2026-09-29T23:59:50Z'});eventIds.push(earlier.id);
    for(let i=0;i<51;i++){
      const id=(await pool.query(`INSERT INTO alerts(rule_id,trigger_event_id,category_code,threat_level,source,affected_entities,status,confidence,match_reason,match_evidence) VALUES($1,$2,$3,'HIGH',$4,$5::jsonb,'NEW',null,$6,$7::jsonb) RETURNING id`,[ruleId,event.id,category.code,source,JSON.stringify({user:malicious,host:'task16-host'}),malicious,JSON.stringify({triggerEventId:event.id,eventIds:[earlier.id,event.id]})])).rows[0].id;
      alertIds.push(id);await pool.query('INSERT INTO alert_events(alert_id,event_id) VALUES($1,$2),($1,$3)',[id,earlier.id,event.id]);
    }
    const config=configFromEnv({}),authentication=authService(authRepo,config),access=accessService(accessRepository(pool),authentication);
    const repository=alertRepository(pool),service=alertService(repository,access);
    server=createServer(authentication,config,access,null,eventViewService(eventRepository(pool),access),null,null,service);
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;config.origin=base;
    return {users,password,source,malicious,event,alertIds,ruleId,category:category.code,base,repository,cleanup};
  }catch(error){await cleanup();throw error;}
}
async function verifyAlertManagement(pool){
  const f=await alertManagementFixture(pool);
  try{
    const id=f.alertIds[0];
    async function login(user){const res=await fetch(f.base+'/api/auth/login',{method:'POST',headers:{Origin:f.base,'Content-Type':'application/json'},body:JSON.stringify({email:user.email,password:f.password})});assert.equal(res.status,200);return res.headers.get('set-cookie').split(';')[0];}
    const cookies=[];for(const user of f.users)cookies.push(await login(user));
    const request=(path,cookie,body,origin=f.base)=>fetch(f.base+path,{method:body?'PATCH':'GET',headers:{Cookie:cookie||'',Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    assert.equal((await request('/api/alerts')).status,401);
    for(const cookie of cookies){
      const page=await (await request(`/api/alerts?source=${f.source}`,cookie)).json();assert.equal(page.alerts.length,50);assert.equal(page.hasMore,true);assert.equal('matchEvidence' in page.alerts[0],false);
      const second=await (await request(`/api/alerts?source=${f.source}&page=2`,cookie)).json();assert.equal(second.alerts.length,1);
      const detail=await (await request(`/api/alerts/${id}`,cookie)).json();assert.equal(detail.alert.events.length,2);assert.equal(detail.alert.events.filter(event=>event.trigger).length,1);assert.equal(detail.alert.events.find(event=>event.trigger).id,f.event.id);assert.equal(detail.alert.confidence,null);
      const raw=await (await request(`/api/events/${f.event.id}`,cookie)).json();assert.equal(raw.event.rawData.html,f.malicious);
    }
    assert.equal((await request(`/api/alerts/${id}/status`,cookies[2],{status:'ACKNOWLEDGED',reason:'viewer attempt'})).status,403);
    assert.equal((await request(`/api/alerts/${id}/status`,cookies[1],{status:'ACKNOWLEDGED',reason:'wrong origin'},'http://wrong.invalid')).status,403);
    assert.equal((await request(`/api/alerts/${id}/status`,cookies[1],{status:'RESOLVED',reason:'invalid'})).status,400);
    const change=await request(`/api/alerts/${id}/status`,cookies[1],{status:'ACKNOWLEDGED',reason:'Synthetic evidence reviewed'});assert.equal(change.status,200);assert.equal((await change.json()).alert.changed,true);
    const repeat=await request(`/api/alerts/${id}/status`,cookies[1],{status:'ACKNOWLEDGED',reason:'same state'});assert.equal((await repeat.json()).alert.changed,false);
    const audit=await pool.query("SELECT context FROM audit_logs WHERE target_id=$1 AND action='ALERT_STATUS_CHANGED'",[id]);assert.equal(audit.rows.length,1);assert.equal(audit.rows[0].context.previousStatus,'NEW');
    const filtered=await f.repository.list({page:1,source:f.source,status:'ACKNOWLEDGED',severity:'HIGH',categoryCode:f.category,ruleId:f.ruleId,q:'100%_'});assert.equal(filtered.alerts.length,1);
    assert.equal((await f.repository.list({page:1,source:f.source,q:"' OR 1=1 --"})).alerts.length,0);
    assert.equal((await f.repository.list({page:1,source:f.source,from:'2100-01-01T00:00:00Z'})).alerts.length,0);
    // Force audit persistence failure; the real transaction must roll back status and actor.
    const failPool={connect:async()=>{const client=await pool.connect();return {query:(sql,values)=>{if(sql.startsWith('INSERT INTO audit_logs'))throw new Error('synthetic audit failure');return client.query(sql,values);},release:()=>client.release()};}};
    await assert.rejects(alertRepository(failPool).updateStatus(f.users[1].id,id,{status:'NEW',reason:'rollback verification'}),{name:'AlertPersistenceError'});
    assert.equal((await f.repository.get(id)).status,'ACKNOWLEDGED');
    const reopened=await request(`/api/alerts/${id}/status`,cookies[0],{status:'NEW',reason:'Synthetic review reopened'});assert.equal(reopened.status,200);const reopenedBody=await reopened.json();assert.equal(reopenedBody.alert.status,'NEW');assert.equal(reopenedBody.alert.statusUpdatedBy,f.users[0].id);
    assert.equal(Number((await pool.query("SELECT count(*) FROM audit_logs WHERE target_id=$1 AND action='ALERT_STATUS_CHANGED'",[id])).rows[0].count),2);
    await pool.query('DELETE FROM user_roles WHERE user_id=$1',[f.users[1].id]);
    await assert.rejects(f.repository.updateStatus(f.users[1].id,id,{status:'NEW',reason:'revoked role'}),{status:403});
    assert.equal((await request('/api/alerts',cookies[1])).status,403);
    return true;
  }finally{await f.cleanup();}
}
async function main(){let pool;try{pool=createPool();await verifyAlertManagement(pool);console.log('Alert listing, filtering, source-event inspection, audited status changes, Viewer rejection and atomic rollback verified. Synthetic changes cleaned up.');}catch{console.error('Task 16 alert-management verification failed. Check migrations and PostgreSQL configuration locally. No credentials were printed.');process.exitCode=1;}finally{if(pool)await pool.end();}}
if(require.main===module)main();
module.exports={alertManagementFixture,verifyAlertManagement};
