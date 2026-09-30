const assert=require('node:assert/strict');
const {createPool}=require('../src/data/pool');
const {responseRepository}=require('../src/data/response-repository');
const {incidentManagementFixture}=require('./verify-incident-management');

async function verifyResponseWorkflow(pool){
 const f=await incidentManagementFixture(pool);
 try{
  async function login(user){
   const r=await fetch(f.base+'/api/auth/login',{method:'POST',headers:{Origin:f.base,'Content-Type':'application/json'},body:JSON.stringify({email:user.email,password:f.password})});
   assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];
  }
  const cookies=[];for(const user of f.users)cookies.push(await login(user));
  const request=(path,cookie,{method='GET',body=null,origin=f.base}={})=>fetch(f.base+path,{method,headers:{
   Cookie:cookie||'',Origin:origin,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  async function create(title){
   const response=await request('/api/incidents',cookies[1],{method:'POST',body:{title,
     description:'Synthetic controlled response verification',alertIds:f.alertIds,
     assignedTo:f.users[1].id,reason:'Task 22 verifier'}});
   assert.equal(response.status,201);const incident=(await response.json()).incident;f.incidentIds.push(incident.id);return incident;
  }
  const incident=await create('Task 22 controlled response');
  const endpoint='/api/responses/'+incident.id;
  const valid={action:'CONTAINMENT',succeeded:true,containmentPerformed:true,
    reason:'Containment was approved and completed manually',
    details:'Affected session revoked externally, outcome confirmed by authorized operator.'};
  assert.equal((await request(endpoint,'')).status,401);
  for(const cookie of cookies){const response=await request(endpoint,cookie);assert.equal(response.status,200);assert.equal((await response.json()).actions.length,0);}
  assert.equal((await request(endpoint+'?page=0',cookies[1])).status,400);
  assert.equal((await request(endpoint+'/actions',cookies[2],{method:'POST',body:valid})).status,403);
  assert.equal((await request(endpoint+'/actions',cookies[1],{method:'POST',body:valid,origin:'http://untrusted.example'})).status,403);
  assert.equal((await request(endpoint+'/actions',cookies[1],{method:'POST',body:{...valid,containmentPerformed:false}})).status,400);
  assert.equal((await request(endpoint+'/actions',cookies[1],{method:'POST',body:{...valid,action:'BLOCK_HOST'}})).status,400);

  const failed=await request(endpoint+'/actions',cookies[1],{method:'POST',body:{
   ...valid,succeeded:false,containmentPerformed:false,details:'Manual containment attempt failed; affected session remains active.'
  }});
  assert.equal(failed.status,201);assert.equal((await failed.json()).action.incidentStatus,'NEW');
  let state=(await pool.query('SELECT status,threat_level,risk_score FROM incidents WHERE id=$1',[incident.id])).rows[0];
  assert.equal(state.status,'NEW');const severity=state.threat_level,risk=state.risk_score;
  for(const action of ['ESCALATION','FOLLOW_UP_TASK','COMMUNICATION']){
   const r=await request(endpoint+'/actions',cookies[1],{method:'POST',body:{...valid,action,containmentPerformed:false,
    details:action+' documented by analyst; no external service called.'}});
   assert.equal(r.status,201);assert.equal((await r.json()).action.incidentStatus,'NEW');
  }
  assert.equal((await pool.query('SELECT count(*)::integer AS n FROM notifications WHERE incident_id=$1',[incident.id])).rows[0].n,0);
  const success=await request(endpoint+'/actions',cookies[0],{method:'POST',body:valid});
  assert.equal(success.status,201);const recorded=(await success.json()).action;
  assert.equal(recorded.incidentStatus,'CONTAINED');assert.equal(recorded.authorizedBy.id,f.users[0].id);
  state=(await pool.query('SELECT status,threat_level,risk_score,resolution_note,status_updated_by FROM incidents WHERE id=$1',[incident.id])).rows[0];
  assert.equal(state.status,'CONTAINED');assert.equal(state.threat_level,severity);assert.equal(state.risk_score,risk);
  assert.equal(state.resolution_note,null);assert.equal(state.status_updated_by,f.users[0].id);
  assert.equal((await request(endpoint+'/actions',cookies[1],{method:'POST',body:valid})).status,409);
  assert.equal((await request('/api/incidents/'+incident.id+'/status',cookies[1],{method:'PATCH',body:{
   status:'CONTAINED',reason:'direct bypass attempt',resolutionNote:null}})).status,400);
  const history=(await (await request(endpoint,cookies[2])).json()).actions;
  assert.equal(history.length,5);assert.equal(history.filter(a=>a.action==='CONTAINMENT').length,2);
  const audit=(await pool.query("SELECT action,context FROM audit_logs WHERE target_type='incident' AND target_id=$1 AND action IN ('RESPONSE_ACTION_RECORDED','INCIDENT_STATUS_CHANGED') ORDER BY occurred_at,id",[incident.id])).rows;
  assert.equal(audit.filter(a=>a.action==='RESPONSE_ACTION_RECORDED').length,5);
  assert.equal(audit.filter(a=>a.action==='INCIDENT_STATUS_CHANGED').length,1);
  assert.equal(audit.find(a=>a.action==='INCIDENT_STATUS_CHANGED').context.responseActionId,recorded.id);
  const investigation=(await (await request('/api/investigations/'+incident.id,cookies[2])).json()).investigation;
  assert.ok(investigation.timeline.some(t=>t.type==='INCIDENT_HISTORY'&&t.details.action==='RESPONSE_ACTION_RECORDED'));
  assert.ok(investigation.timeline.some(t=>t.type==='INCIDENT_HISTORY'&&t.details.action==='INCIDENT_STATUS_CHANGED'&&t.details.context.status==='CONTAINED'));
  const closed=await request('/api/incidents/'+incident.id+'/status',cookies[1],{method:'PATCH',body:{
   status:'RESOLVED',reason:'Underlying issue handled following containment',
   resolutionNote:'The underlying issue was remediated after manually recorded containment.'}});
  assert.equal(closed.status,200);assert.equal((await closed.json()).incident.status,'RESOLVED');
  assert.equal((await request(endpoint+'/actions',cookies[1],{method:'POST',body:{...valid,action:'ESCALATION',containmentPerformed:false}})).status,409);

  const rollback=await create('Task 22 audit rollback');
  const failPool={connect:async()=>{const client=await pool.connect();return{
   query:(sql,params)=>{if(sql.startsWith('INSERT INTO audit_logs'))throw new Error('synthetic audit outage');return client.query(sql,params);},
   release:error=>client.release(error),
  };}};
  await assert.rejects(responseRepository(failPool).record(f.users[1].id,rollback.id,valid),{name:'ResponsePersistenceError'});
  assert.equal((await pool.query('SELECT status FROM incidents WHERE id=$1',[rollback.id])).rows[0].status,'NEW');
  assert.equal((await pool.query('SELECT count(*)::integer AS n FROM response_actions WHERE incident_id=$1',[rollback.id])).rows[0].n,0);
  return true;
 }finally{await f.cleanup();}
}
async function main(){let pool;try{pool=createPool();await verifyResponseWorkflow(pool);
 console.log('Controlled manual response recording, failed/successful containment, incident history, RBAC, terminal protection and atomic audit rollback verified. Synthetic changes cleaned up.');
 }catch{console.error('Task 22 response verification failed. Check PostgreSQL and existing migrations locally. No credentials were printed.');process.exitCode=1;
 }finally{if(pool)await pool.end();}}
if(require.main===module)main();
module.exports={verifyResponseWorkflow};
