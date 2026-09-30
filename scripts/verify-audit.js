const assert=require('node:assert/strict');
const {createPool}=require('../src/data/pool');
const {incidentManagementFixture}=require('./verify-incident-management');

async function verifyAudit(pool){
 const f=await incidentManagementFixture(pool);
 try{
  async function login(user){
   const r=await fetch(f.base+'/api/auth/login',{method:'POST',headers:{Origin:f.base,'Content-Type':'application/json'},body:JSON.stringify({email:user.email,password:f.password})});
   assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];
  }
  const cookies=[];for(const u of f.users)cookies.push(await login(u));
  const get=(path,cookie)=>fetch(f.base+path,{headers:cookie?{Cookie:cookie}:{}});
  assert.equal((await get('/api/audit','')).status,401);
  assert.equal((await get('/api/audit',cookies[0])).status,200);
  assert.equal((await get('/api/audit',cookies[1])).status,200);
  assert.equal((await get('/api/audit',cookies[2])).status,403);
  const created=await fetch(f.base+'/api/incidents',{method:'POST',headers:{Cookie:cookies[1],Origin:f.base,'Content-Type':'application/json'},body:JSON.stringify({title:'Task 27 audit incident',description:'Synthetic audit verification',alertIds:f.alertIds,assignedTo:f.users[1].id,reason:'Audit trail verification'})});
  assert.equal(created.status,201);const incident=(await created.json()).incident;f.incidentIds.push(incident.id);
  const status=await fetch(f.base+'/api/incidents/'+incident.id+'/status',{method:'PATCH',headers:{Cookie:cookies[1],Origin:f.base,'Content-Type':'application/json'},body:JSON.stringify({status:'INVESTIGATING',reason:'Generate auditable state transition',resolutionNote:null})});
  assert.equal(status.status,200);
  const response=await fetch(f.base+'/api/responses/'+incident.id+'/actions',{method:'POST',headers:{Cookie:cookies[1],Origin:f.base,'Content-Type':'application/json'},body:JSON.stringify({action:'ESCALATION',reason:'Generate auditable response',details:'Synthetic audit response.',succeeded:true,containmentPerformed:false})});
  assert.equal(response.status,201);
  const before=(await pool.query('SELECT count(*)::integer n FROM audit_logs')).rows[0].n;
  const target=(await (await get('/api/audit?targetType=incident&targetId='+incident.id,cookies[1])).json()).entries;
  assert.ok(target.length>=3);
  const actions=target.map(x=>x.action);
  for(const expected of ['INCIDENT_CREATED','INCIDENT_STATUS_CHANGED','RESPONSE_ACTION_RECORDED'])assert.ok(actions.includes(expected),expected);
  for(const entry of target){
   assert.ok(entry.id);assert.ok(Date.parse(entry.occurredAt));assert.equal(entry.target.type,'incident');assert.equal(entry.target.id,incident.id);
   assert.ok(entry.actor?.id||entry.actorContext);assert.equal(typeof entry.context,'object');
  }
  const transition=target.find(x=>x.action==='INCIDENT_STATUS_CHANGED');
  assert.equal(transition.actor.id,f.users[1].id);assert.equal(transition.context.status,'INVESTIGATING');assert.equal(transition.context.previousStatus,'NEW');
  const byActor=(await (await get('/api/audit?actorId='+f.users[1].id+'&action=INCIDENT_STATUS_CHANGED',cookies[0])).json()).entries;
  assert.ok(byActor.some(x=>x.target.id===incident.id));
  const from=new Date(Date.now()-3600000).toISOString(),to=new Date(Date.now()+3600000).toISOString();
  const ranged=(await (await get('/api/audit?from='+encodeURIComponent(from)+'&to='+encodeURIComponent(to)+'&targetId='+incident.id,cookies[1])).json()).entries;
  assert.ok(ranged.length>=3);
  for(const invalid of ['page=0','actorId=bad','targetId=bad','from=bad','from=2026-10-02T00%3A00%3A00Z&to=2026-10-01T00%3A00%3A00Z','x=1']){
   assert.equal((await get('/api/audit?'+invalid,cookies[1])).status,400,invalid);
  }
  const post=await fetch(f.base+'/api/audit',{method:'POST',headers:{Cookie:cookies[1],Origin:f.base,'Content-Type':'application/json'},body:'{}'});
  assert.equal(post.status,405);
  const after=(await pool.query('SELECT count(*)::integer n FROM audit_logs')).rows[0].n;assert.equal(after,before);
  return true;
 }finally{await f.cleanup();}
}
async function main(){let pool;try{pool=createPool();await verifyAudit(pool);console.log('Protected actor/action/resource/time/context audit retrieval, filtering, RBAC and read-only API behavior verified. Synthetic changes cleaned up.');}catch{console.error('Task 27 audit verification failed. Check PostgreSQL and quality locally. No credentials were printed.');process.exitCode=1;}finally{if(pool)await pool.end();}}
if(require.main===module)main();
module.exports={verifyAudit};