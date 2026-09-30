const assert=require('node:assert/strict');
const {createPool}=require('../src/data/pool');
const {riskScore}=require('../src/risk/engine');
const {incidentManagementFixture}=require('./verify-incident-management');

async function verifyRiskScoring(pool){
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
      title:'Task 20 deterministic risk',
      description:'Synthetic risk scoring verification',
      alertIds:f.alertIds,
      assignedTo:null,
      reason:'Create incident for deterministic risk verification',
    }});
    assert.equal(createdResponse.status,201);
    let incident=(await createdResponse.json()).incident;
    f.incidentIds.push(incident.id);

    const expectedInitial=riskScore('CRITICAL',2);
    assert.deepEqual(incident.risk,{
      score:expectedInitial.score,
      eventCount:2,
      formulaVersion:1,
      calculatedAt:incident.risk.calculatedAt,
    });
    assert.ok(Date.parse(incident.risk.calculatedAt));

    const viewerDetail=await (await request(`/api/incidents/${incident.id}`,cookies[2])).json();
    assert.equal(viewerDetail.incident.risk.score,expectedInitial.score);
    assert.equal(viewerDetail.incident.risk.eventCount,2);

    const assessment=await request(`/api/incidents/${incident.id}/assessment`,cookies[1],{method:'PATCH',body:{
      categoryCode:incident.categoryCode,
      severity:'MEDIUM',
      reason:'Verify risk follows controlled severity adjustment',
    }});
    assert.equal(assessment.status,200);
    incident=(await assessment.json()).incident;
    const expectedAdjusted=riskScore('MEDIUM',2);
    assert.equal(incident.risk.score,expectedAdjusted.score);
    assert.equal(incident.status,'NEW');

    for(const sample of [
      {severity:'LOW',eventCount:0},
      {severity:'LOW',eventCount:1},
      {severity:'LOW',eventCount:2},
      {severity:'HIGH',eventCount:10},
      {severity:'CRITICAL',eventCount:11},
      {severity:'CRITICAL',eventCount:100},
    ]){
      const row=(await pool.query(`UPDATE incidents SET threat_level=$2,risk_event_count=$3 WHERE id=$1
        RETURNING threat_level,risk_event_count,risk_score,risk_formula_version,risk_calculated_at`,
      [incident.id,sample.severity,sample.eventCount])).rows[0];
      const expected=riskScore(sample.severity,sample.eventCount);
      assert.equal(Number(row.risk_score),expected.score);
      assert.equal(row.risk_event_count,sample.eventCount);
      assert.equal(Number(row.risk_formula_version),1);
      assert.ok(row.risk_calculated_at);
    }

    const before=(await pool.query('SELECT risk_score FROM incidents WHERE id=$1',[incident.id])).rows[0].risk_score;
    await pool.query('SAVEPOINT generated_risk');
    await assert.rejects(pool.query('UPDATE incidents SET risk_score=99 WHERE id=$1',[incident.id]));
    await pool.query('ROLLBACK TO SAVEPOINT generated_risk');
    const after=(await pool.query('SELECT risk_score FROM incidents WHERE id=$1',[incident.id])).rows[0].risk_score;
    assert.equal(after,before);

    return true;
  }finally{await f.cleanup();}
}

async function main(){
  let pool;
  try{
    pool=createPool();
    await verifyRiskScoring(pool);
    console.log('Deterministic severity/event-frequency risk formula, database generation, boundaries, API display and severity recalculation verified. Synthetic changes cleaned up.');
  }catch{
    console.error('Task 20 risk-scoring verification failed. Check migrations and PostgreSQL configuration locally. No credentials were printed.');
    process.exitCode=1;
  }finally{if(pool)await pool.end();}
}
if(require.main===module)main();
module.exports={verifyRiskScoring};
