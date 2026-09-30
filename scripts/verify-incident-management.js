const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createPool } = require('../src/data/pool');
const { eventRepository } = require('../src/data/event-repository');
const { authRepository } = require('../src/data/auth-repository');
const { accessRepository } = require('../src/data/access-repository');
const { authService } = require('../src/auth/service');
const { accessService } = require('../src/access/service');
const { incidentRepository } = require('../src/data/incident-repository');
const { incidentService } = require('../src/incidents/service');
const { investigationRepository } = require('../src/data/investigation-repository');
const { investigationService } = require('../src/investigations/service');
const { configFromEnv } = require('../src/auth/config');
const { hashPassword } = require('../src/auth/passwords');
const { createServer } = require('../src/api/server');

async function incidentManagementFixture(pool) {
  const users=[],eventIds=[],alertIds=[],incidentIds=[];let ruleId,server;
  async function cleanup(){
    if(server)await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});
    if(incidentIds.length){await pool.query('DELETE FROM audit_logs WHERE target_id=ANY($1::uuid[])',[incidentIds]);await pool.query('DELETE FROM investigation_notes WHERE incident_id=ANY($1::uuid[])',[incidentIds]);await pool.query('DELETE FROM incident_alerts WHERE incident_id=ANY($1::uuid[])',[incidentIds]);await pool.query('DELETE FROM incidents WHERE id=ANY($1::uuid[])',[incidentIds]);}
    if(alertIds.length){await pool.query('DELETE FROM alert_correlations WHERE alert_id=ANY($1::uuid[]) OR related_alert_id=ANY($1::uuid[])',[alertIds]);await pool.query('DELETE FROM alert_events WHERE alert_id=ANY($1::uuid[])',[alertIds]);await pool.query('DELETE FROM alerts WHERE id=ANY($1::uuid[])',[alertIds]);}
    if(eventIds.length)await pool.query('DELETE FROM security_events WHERE id=ANY($1::uuid[])',[eventIds]);
    if(ruleId)await pool.query('DELETE FROM detection_rules WHERE id=$1',[ruleId]);
    const ids=users.map(u=>u.id);if(ids.length){await pool.query('DELETE FROM audit_logs WHERE actor_id=ANY($1::uuid[])',[ids]);await pool.query('DELETE FROM auth_sessions WHERE user_id=ANY($1::uuid[])',[ids]);await pool.query('DELETE FROM user_roles WHERE user_id=ANY($1::uuid[])',[ids]);await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[ids]);}
  }
  try{
    const authRepo=authRepository(pool),password='Synthetic incident management passphrase',hash=await hashPassword(password);
    for(const role of ['Administrator','Security Analyst','Viewer/Management']){const email=`${randomUUID()}@example.invalid`,id=await authRepo.createUser(email,'Synthetic incident tester',hash,'local Task 18 verifier');users.push({id,email,role});await pool.query('INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE name=$2',[id,role]);}
    const category=(await pool.query('SELECT code FROM threat_categories WHERE enabled ORDER BY code LIMIT 1')).rows[0];assert.ok(category,'At least one selectable threat category is required.');
    ruleId=(await pool.query(`INSERT INTO detection_rules(name,description,enabled,definition,threat_level,category_code) VALUES($1,'Task 18 verifier',false,'{}','HIGH',$2) RETURNING id`,[`Task 18 ${randomUUID()}`,category.code])).rows[0].id;
    const eventRepo=eventRepository(pool);const source=`task18-${randomUUID()}`;
    for(let i=0;i<2;i++){const event=await eventRepo.create({timestamp:`2026-09-30T00:00:0${i}Z`,source,type:'authentication',sourceIp:`192.0.2.${18+i}`,destinationIp:null,user:'task18-user',host:'task18-host',action:'login',status:'failed',severity:i?'CRITICAL':'HIGH',rawData:{synthetic:true},metadata:{task:18}});eventIds.push(event.id);const alert=(await pool.query(`INSERT INTO alerts(rule_id,trigger_event_id,category_code,threat_level,source,affected_entities,status,confidence,match_reason,match_evidence) VALUES($1,$2,$3,$4,$5,$6::jsonb,'NEW',null,'Task 18 synthetic alert',$7::jsonb) RETURNING id`,[ruleId,event.id,category.code,i?'CRITICAL':'HIGH',source,JSON.stringify({user:'task18-user',host:'task18-host',sourceIp:`192.0.2.${18+i}`}),JSON.stringify({triggerEventId:event.id,eventIds:[event.id]})])).rows[0];alertIds.push(alert.id);await pool.query('INSERT INTO alert_events(alert_id,event_id) VALUES($1,$2)',[alert.id,event.id]);}
    const pair=[...alertIds].sort();await pool.query('INSERT INTO alert_correlations(alert_id,related_alert_id,relationship) VALUES($1,$2,$3::jsonb)',[pair[0],pair[1],JSON.stringify({matchedFields:['user','host'],timeDeltaSeconds:1,windowSeconds:900})]);
    const config=configFromEnv({}),authentication=authService(authRepo,config),access=accessService(accessRepository(pool),authentication),repository=incidentRepository(pool),service=incidentService(repository,access);
    server=createServer(authentication,config,access,null,null,null,null,null,service,investigationService(investigationRepository(pool),access));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;config.origin=base;
    return{users,password,eventIds,alertIds,incidentIds,category:category.code,source,repository,base,cleanup};
  }catch(error){await cleanup();throw error;}
}
async function verifyIncidentManagement(pool){const f=await incidentManagementFixture(pool);try{
  async function login(user){const r=await fetch(f.base+'/api/auth/login',{method:'POST',headers:{Origin:f.base,'Content-Type':'application/json'},body:JSON.stringify({email:user.email,password:f.password})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
  const cookies=[];for(const u of f.users)cookies.push(await login(u));
  const req=(path,cookie,{method='GET',body=null,origin=f.base}={})=>fetch(f.base+path,{method,headers:{Cookie:cookie||'',Origin:origin,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  assert.equal((await req('/api/incidents','')).status,401);
  const createBody={title:'Synthetic correlated incident',description:'Two related detection alerts',alertIds:f.alertIds,assignedTo:f.users[1].id,reason:'Correlated alerts require incident handling'};
  assert.equal((await req('/api/incidents',cookies[2],{method:'POST',body:createBody})).status,403);
  const createdRes=await req('/api/incidents',cookies[1],{method:'POST',body:createBody});assert.equal(createdRes.status,201);const created=(await createdRes.json()).incident;f.incidentIds.push(created.id);assert.equal(created.status,'NEW');assert.equal(created.severity,'CRITICAL');assert.equal(created.categoryCode,f.category);assert.equal(created.assignedTo.id,f.users[1].id);
  for(const cookie of cookies){const list=await (await req(`/api/incidents?status=NEW&severity=CRITICAL&categoryCode=${f.category}`,cookie)).json();assert.ok(list.incidents.some(i=>i.id===created.id));const detail=await (await req(`/api/incidents/${created.id}`,cookie)).json();assert.equal(detail.incident.alerts.length,2);assert.deepEqual([...detail.incident.alerts.map(a=>a.id)].sort(),[...f.alertIds].sort());}
  assert.equal((await req(`/api/incidents/${created.id}/assignment`,cookies[2],{method:'PATCH',body:{assignedTo:f.users[2].id,reason:'viewer attempt'}})).status,403);
  assert.equal((await req(`/api/incidents/${created.id}/assignment`,cookies[1],{method:'PATCH',body:{assignedTo:f.users[2].id,reason:'invalid assignee'}})).status,400);
  const assignment=await req(`/api/incidents/${created.id}/assignment`,cookies[1],{method:'PATCH',body:{assignedTo:f.users[0].id,reason:'Escalate ownership to administrator'}});assert.equal(assignment.status,200);assert.equal((await assignment.json()).incident.assignedTo.id,f.users[0].id);
  for(const invalid of ['OPEN','CLOSED','CONTAINED'])assert.equal((await req(`/api/incidents/${created.id}/status`,cookies[1],{method:'PATCH',body:{status:invalid,reason:'invalid',resolutionNote:null}})).status,400);
  let status=await req(`/api/incidents/${created.id}/status`,cookies[1],{method:'PATCH',body:{status:'INVESTIGATING',reason:'Begin incident investigation',resolutionNote:null}});assert.equal(status.status,200);assert.equal((await status.json()).incident.status,'INVESTIGATING');
  assert.equal((await req(`/api/incidents/${created.id}/status`,cookies[1],{method:'PATCH',body:{status:'RESOLVED',reason:'handled',resolutionNote:''}})).status,400);
  status=await req(`/api/incidents/${created.id}/status`,cookies[0],{method:'PATCH',body:{status:'RESOLVED',reason:'Underlying issue handled',resolutionNote:'Credential exposure handled and affected access reviewed.'}});assert.equal(status.status,200);const resolved=(await status.json()).incident;assert.equal(resolved.status,'RESOLVED');assert.equal(resolved.severity,'CRITICAL');assert.equal(resolved.resolutionNote,'Credential exposure handled and affected access reviewed.');
  assert.equal((await req(`/api/incidents/${created.id}/assignment`,cookies[0],{method:'PATCH',body:{assignedTo:null,reason:'terminal reassignment'}})).status,409);
  const audits=await pool.query("SELECT action,context FROM audit_logs WHERE target_id=$1 ORDER BY occurred_at,id",[created.id]);assert.deepEqual(audits.rows.map(r=>r.action),['INCIDENT_CREATED','INCIDENT_ASSIGNMENT_CHANGED','INCIDENT_STATUS_CHANGED','INCIDENT_STATUS_CHANGED']);
  const secondRes=await req('/api/incidents',cookies[1],{method:'POST',body:{...createBody,title:'Synthetic rollback incident',assignedTo:null,reason:'Atomic rollback test'}});assert.equal(secondRes.status,201);const second=(await secondRes.json()).incident;f.incidentIds.push(second.id);
  const failPool={connect:async()=>{const c=await pool.connect();return{query:(sql,values)=>{if(sql.startsWith('INSERT INTO audit_logs'))throw new Error('synthetic audit failure');return c.query(sql,values);},release:e=>c.release(e)};}};
  await assert.rejects(incidentRepository(failPool).updateStatus(f.users[1].id,second.id,{status:'INVESTIGATING',reason:'rollback',resolutionNote:null}),{name:'IncidentPersistenceError'});assert.equal((await f.repository.get(second.id)).status,'NEW');
  const dismissed=await req(`/api/incidents/${second.id}/status`,cookies[1],{method:'PATCH',body:{status:'DISMISSED',reason:'Verified false positive',resolutionNote:'Evidence reviewed; no further incident handling required.'}});assert.equal(dismissed.status,200);assert.equal((await dismissed.json()).incident.status,'DISMISSED');
  return true;
}finally{await f.cleanup();}}
async function main(){let pool;try{pool=createPool();await verifyIncidentManagement(pool);console.log('Incident creation, alert linking, severity inheritance, assignment, lifecycle, terminal notes, RBAC, auditing and rollback verified. Synthetic changes cleaned up.');}catch{console.error('Task 18 incident-management verification failed. Check migrations and PostgreSQL configuration locally. No credentials were printed.');process.exitCode=1;}finally{if(pool)await pool.end();}}
if(require.main===module)main();module.exports={incidentManagementFixture,verifyIncidentManagement};
