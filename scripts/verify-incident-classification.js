const assert=require('node:assert/strict');
const {createPool}=require('../src/data/pool');
const {incidentRepository}=require('../src/data/incident-repository');
const {incidentManagementFixture}=require('./verify-incident-management');

async function verifyIncidentClassification(pool){
  const f=await incidentManagementFixture(pool);
  try{
    async function login(user){const r=await fetch(f.base+'/api/auth/login',{method:'POST',headers:{Origin:f.base,'Content-Type':'application/json'},body:JSON.stringify({email:user.email,password:f.password})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
    const cookies=[];for(const user of f.users)cookies.push(await login(user));
    const request=(path,cookie,{method='GET',body=null,origin=f.base}={})=>fetch(f.base+path,{method,headers:{Cookie:cookie||'',Origin:origin,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const createdRes=await request('/api/incidents',cookies[1],{method:'POST',body:{title:'Task 19 incident assessment',description:'Synthetic classification verification',alertIds:f.alertIds,assignedTo:null,reason:'Create incident for Task 19 verification'}});
    assert.equal(createdRes.status,201);const incident=(await createdRes.json()).incident;f.incidentIds.push(incident.id);
    assert.equal(incident.severity,'CRITICAL');assert.equal(incident.categoryCode,f.category);assert.equal(incident.status,'NEW');

    assert.equal((await request(`/api/incidents/${incident.id}/assessment`,cookies[2],{method:'PATCH',body:{categoryCode:null,severity:'MEDIUM',reason:'viewer attempt'}})).status,403);
    assert.equal((await request(`/api/incidents/${incident.id}/assessment`,cookies[1],{method:'PATCH',body:{categoryCode:null,severity:'EXTREME',reason:'invalid'}})).status,400);
    assert.equal((await request(`/api/incidents/${incident.id}/assessment`,cookies[1],{method:'PATCH',body:{categoryCode:'UNKNOWN_ATTACK',severity:'HIGH',reason:'invalid'}})).status,400);
    assert.equal((await request(`/api/incidents/${incident.id}/assessment`,cookies[1],{method:'PATCH',body:{categoryCode:null,severity:'MEDIUM',reason:'invalid extra field',priority:'P1'}})).status,400);

    let changed=await request(`/api/incidents/${incident.id}/assessment`,cookies[1],{method:'PATCH',body:{categoryCode:null,severity:'MEDIUM',reason:'Evidence is mixed; classification requires further review'}});
    assert.equal(changed.status,200);let assessed=(await changed.json()).incident;
    assert.equal(assessed.changed,true);assert.equal(assessed.categoryCode,null);assert.equal(assessed.severity,'MEDIUM');assert.equal(assessed.status,'NEW');
    let row=(await pool.query('SELECT status,threat_level,category_code,assessment_updated_at,assessment_updated_by FROM incidents WHERE id=$1',[incident.id])).rows[0];
    assert.equal(row.status,'NEW');assert.equal(row.threat_level,'MEDIUM');assert.equal(row.category_code,null);assert.ok(row.assessment_updated_at);assert.equal(row.assessment_updated_by,f.users[1].id);

    let audit=await pool.query("SELECT context FROM audit_logs WHERE target_id=$1 AND action='INCIDENT_ASSESSMENT_CHANGED' ORDER BY occurred_at,id",[incident.id]);
    assert.equal(audit.rows.length,1);assert.deepEqual(audit.rows[0].context,{previousCategoryCode:f.category,categoryCode:null,previousSeverity:'CRITICAL',severity:'MEDIUM',reason:'Evidence is mixed; classification requires further review'});

    const failPool={connect:async()=>{const client=await pool.connect();return{query:(sql,values)=>{if(sql.startsWith('INSERT INTO audit_logs'))throw new Error('synthetic audit failure');return client.query(sql,values);},release:error=>client.release(error)};}};
    await assert.rejects(incidentRepository(failPool).updateAssessment(f.users[1].id,incident.id,{categoryCode:null,severity:'HIGH',reason:'rollback verification'}),{name:'IncidentPersistenceError'});
    row=(await pool.query('SELECT threat_level,category_code FROM incidents WHERE id=$1',[incident.id])).rows[0];assert.equal(row.threat_level,'MEDIUM');assert.equal(row.category_code,null);

    const resolved=await request(`/api/incidents/${incident.id}/status`,cookies[1],{method:'PATCH',body:{status:'RESOLVED',reason:'Underlying issue handled',resolutionNote:'Synthetic incident handled for Task 19 verification.'}});
    assert.equal(resolved.status,200);
    changed=await request(`/api/incidents/${incident.id}/assessment`,cookies[0],{method:'PATCH',body:{categoryCode:f.category,severity:'HIGH',reason:'Post-resolution evidence confirms classification'}});
    assert.equal(changed.status,200);assessed=(await changed.json()).incident;
    assert.equal(assessed.status,'RESOLVED');assert.equal(assessed.severity,'HIGH');assert.equal(assessed.categoryCode,f.category);assert.equal(assessed.resolutionNote,'Synthetic incident handled for Task 19 verification.');

    const repeat=await request(`/api/incidents/${incident.id}/assessment`,cookies[0],{method:'PATCH',body:{categoryCode:f.category,severity:'HIGH',reason:'No material change'}});
    assert.equal(repeat.status,200);assert.equal((await repeat.json()).incident.changed,false);
    audit=await pool.query("SELECT context FROM audit_logs WHERE target_id=$1 AND action='INCIDENT_ASSESSMENT_CHANGED' ORDER BY occurred_at,id",[incident.id]);
    assert.equal(audit.rows.length,2);
    return true;
  }finally{await f.cleanup();}
}
async function main(){let pool;try{pool=createPool();await verifyIncidentClassification(pool);console.log('Incident taxonomy classification, severity adjustment, lifecycle independence, RBAC, auditing and rollback verified. Synthetic changes cleaned up.');}catch{console.error('Task 19 incident-classification verification failed. Check migrations and PostgreSQL configuration locally. No credentials were printed.');process.exitCode=1;}finally{if(pool)await pool.end();}}
if(require.main===module)main();
module.exports={verifyIncidentClassification};
