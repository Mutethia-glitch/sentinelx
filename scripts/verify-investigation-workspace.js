const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {createPool}=require('../src/data/pool');
const {investigationRepository}=require('../src/data/investigation-repository');
const {incidentManagementFixture}=require('./verify-incident-management');

async function verifyInvestigationWorkspace(pool){
  const f=await incidentManagementFixture(pool);
  try{
    async function login(user){
      const response=await fetch(f.base+'/api/auth/login',{method:'POST',headers:{Origin:f.base,'Content-Type':'application/json'},body:JSON.stringify({email:user.email,password:f.password})});
      assert.equal(response.status,200);
      return response.headers.get('set-cookie').split(';')[0];
    }
    const cookies=[];for(const user of f.users)cookies.push(await login(user));
    const request=(path,cookie,{method='GET',body=null}={})=>fetch(f.base+path,{method,headers:{Cookie:cookie,Origin:f.base,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});

    const createdResponse=await request('/api/incidents',cookies[1],{method:'POST',body:{
      title:'Task 21 investigation workspace',
      description:'Synthetic evidence and timeline verification',
      alertIds:f.alertIds,
      assignedTo:f.users[1].id,
      reason:'Create incident for investigation verification',
    }});
    assert.equal(createdResponse.status,201);
    const incident=(await createdResponse.json()).incident;
    f.incidentIds.push(incident.id);

    for(const cookie of cookies){
      const response=await request(`/api/investigations/${incident.id}`,cookie);
      assert.equal(response.status,200);
      const workspace=(await response.json()).investigation;
      assert.equal(workspace.incident.id,incident.id);
      assert.equal(workspace.alerts.length,2);
      assert.equal(workspace.events.length,2);
      assert.deepEqual([...workspace.alerts.map(item=>item.id)].sort(),[...f.alertIds].sort());
      assert.deepEqual([...workspace.events.map(item=>item.id)].sort(),[...f.eventIds].sort());
      assert.deepEqual(workspace.affectedEntities.user,['task18-user']);
      assert.deepEqual(workspace.affectedEntities.host,['task18-host']);
      assert.deepEqual(workspace.affectedEntities.sourceIp.sort(),['192.0.2.18','192.0.2.19']);
      assert.equal(workspace.affectedEntities.destinationIp.length,0);
      assert.ok(workspace.timeline.some(item=>item.type==='SECURITY_EVENT'));
      assert.ok(workspace.timeline.some(item=>item.type==='ALERT'));
      assert.ok(workspace.timeline.some(item=>item.type==='INCIDENT_CREATED'));
      const times=workspace.timeline.map(item=>item.timestamp);
      assert.deepEqual(times,[...times].sort());
    }

    assert.equal((await request(`/api/investigations/${incident.id}/notes`,cookies[2],{method:'POST',body:{content:'Viewer attempt',alertIds:[],eventIds:[]}})).status,403);

    const noteResponse=await request(`/api/investigations/${incident.id}/notes`,cookies[1],{method:'POST',body:{
      content:'Authentication failures came from the same user and host across both linked events.',
      alertIds:[f.alertIds[0]],
      eventIds:[f.eventIds[0],f.eventIds[1]],
    }});
    assert.equal(noteResponse.status,201);
    const note=(await noteResponse.json()).note;
    assert.equal(note.incidentId,incident.id);
    assert.equal(note.author.id,f.users[1].id);
    assert.deepEqual(note.evidence,{alertIds:[f.alertIds[0]],eventIds:[f.eventIds[0],f.eventIds[1]]});

    assert.equal((await request(`/api/investigations/${incident.id}/notes`,cookies[1],{method:'POST',body:{
      content:'Unrelated alert evidence',
      alertIds:[randomUUID()],
      eventIds:[],
    }})).status,400);
    assert.equal((await request(`/api/investigations/${incident.id}/notes`,cookies[1],{method:'POST',body:{
      content:'Unrelated event evidence',
      alertIds:[],
      eventIds:[randomUUID()],
    }})).status,400);

    const statusResponse=await request(`/api/incidents/${incident.id}/status`,cookies[1],{method:'PATCH',body:{
      status:'INVESTIGATING',reason:'Begin structured investigation',resolutionNote:null,
    }});
    assert.equal(statusResponse.status,200);

    let workspace=(await (await request(`/api/investigations/${incident.id}`,cookies[2])).json()).investigation;
    assert.equal(workspace.notes.length,1);
    assert.ok(workspace.timeline.some(item=>item.type==='INVESTIGATION_NOTE'&&item.id===note.id));
    assert.ok(workspace.timeline.some(item=>item.type==='INCIDENT_HISTORY'&&item.details.action==='INCIDENT_STATUS_CHANGED'));
    assert.equal(workspace.incident.status,'INVESTIGATING');

    const before=(await pool.query('SELECT count(*)::integer AS count FROM investigation_notes WHERE incident_id=$1',[incident.id])).rows[0].count;
    const failPool={connect:async()=>{const client=await pool.connect();return{
      query:(sql,values)=>{if(sql.startsWith('INSERT INTO audit_logs'))throw new Error('synthetic audit failure');return client.query(sql,values);},
      release:error=>client.release(error),
    };}};
    await assert.rejects(investigationRepository(failPool).addNote(f.users[1].id,incident.id,{
      content:'This finding must roll back.',alertIds:[],eventIds:[],
    }),{name:'InvestigationPersistenceError'});
    const after=(await pool.query('SELECT count(*)::integer AS count FROM investigation_notes WHERE incident_id=$1',[incident.id])).rows[0].count;
    assert.equal(after,before);

    const audit=(await pool.query("SELECT context FROM audit_logs WHERE target_type='incident' AND target_id=$1 AND action='INVESTIGATION_NOTE_ADDED'",[incident.id])).rows;
    assert.equal(audit.length,1);
    assert.equal(audit[0].context.noteId,note.id);

    return true;
  }finally{await f.cleanup();}
}

async function main(){
  let pool;
  try{
    pool=createPool();
    await verifyInvestigationWorkspace(pool);
    console.log('Investigation evidence, affected entities, chronological timeline, analyst findings, RBAC, evidence validation, auditing and rollback verified. Synthetic changes cleaned up.');
  }catch{
    console.error('Task 21 investigation-workspace verification failed. Check PostgreSQL configuration and current migrations locally. No credentials were printed.');
    process.exitCode=1;
  }finally{if(pool)await pool.end();}
}
if(require.main===module)main();
module.exports={verifyInvestigationWorkspace};
