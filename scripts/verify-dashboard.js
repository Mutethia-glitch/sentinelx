const assert=require('node:assert/strict');
const {createPool}=require('../src/data/pool');
const {dashboardRepository}=require('../src/data/dashboard-repository');
const {incidentManagementFixture}=require('./verify-incident-management');

async function verifyDashboard(pool){
 const fixture=await incidentManagementFixture(pool);
 try{
  async function login(user){
   const response=await fetch(fixture.base+'/api/auth/login',{method:'POST',
    headers:{Origin:fixture.base,'Content-Type':'application/json'},
    body:JSON.stringify({email:user.email,password:fixture.password})});
   assert.equal(response.status,200);
   return response.headers.get('set-cookie').split(';')[0];
  }
  const cookies=[];for(const user of fixture.users)cookies.push(await login(user));
  const request=(path,cookie,{method='GET',body=null}={})=>fetch(fixture.base+path,{
   method,headers:{Cookie:cookie||'',Origin:fixture.base,...(body?{'Content-Type':'application/json'}:{})},
   ...(body?{body:JSON.stringify(body)}:{})
  });
  async function snapshot(cookie=cookies[1]){
   const response=await request('/api/dashboard',cookie);assert.equal(response.status,200);
   const data=(await response.json()).dashboard;
   assert.ok(Date.parse(data.asOf));assert.deepEqual(data.period,{recentHours:24,trendDays:7,trendTimezone:'UTC'});
   assert.equal(data.trend.length,7);assert.deepEqual(data.trend.map(row=>row.day),[...data.trend.map(row=>row.day)].sort());
   for(const row of data.trend)for(const key of ['events','alerts','incidents','responses'])assert.ok(Number.isSafeInteger(row[key])&&row[key]>=0);
   return data;
  }
  assert.equal((await request('/api/dashboard','')).status,401);
  assert.equal((await request('/api/dashboard?days=30',cookies[1])).status,400);
  assert.equal((await request('/api/dashboard',cookies[1],{method:'POST',body:{}})).status,405);
  const initial=await snapshot();
  assert.ok(initial.totals.eventsTotal>=2);
  assert.ok(initial.totals.alertsTotal>=2);
  assert.ok(initial.severity.alerts.CRITICAL>=1);
  assert.ok(initial.severity.alerts.HIGH>=1);
  const viewer=await snapshot(cookies[2]);assert.deepEqual(viewer.totals,initial.totals);
  const admin=await snapshot(cookies[0]);assert.deepEqual(admin.totals,initial.totals);
  const created=await request('/api/incidents',cookies[1],{method:'POST',body:{
   title:'Task 24 dashboard incident',description:'Synthetic dashboard regression record',
   alertIds:fixture.alertIds,assignedTo:fixture.users[1].id,reason:'Verify live operational dashboard metrics'
  }});
  assert.equal(created.status,201);
  const incident=(await created.json()).incident;fixture.incidentIds.push(incident.id);
  assert.equal(incident.severity,'CRITICAL');assert.equal(incident.status,'NEW');
  const afterCreate=await snapshot();
  assert.equal(afterCreate.totals.incidentsTotal,initial.totals.incidentsTotal+1);
  assert.equal(afterCreate.totals.activeIncidents,initial.totals.activeIncidents+1);
  assert.equal(afterCreate.status.incidents.NEW,initial.status.incidents.NEW+1);
  assert.equal(afterCreate.severity.incidents.CRITICAL,initial.severity.incidents.CRITICAL+1);
  assert.equal(afterCreate.totals.eventsTotal,initial.totals.eventsTotal);
  assert.equal(afterCreate.totals.alertsTotal,initial.totals.alertsTotal);
  if(initial.trend.at(-1).day===afterCreate.trend.at(-1).day)
   assert.equal(afterCreate.trend.at(-1).incidents,initial.trend.at(-1).incidents+1);
  const endpoint='/api/responses/'+incident.id+'/actions';
  const failed=await request(endpoint,cookies[1],{method:'POST',body:{
   action:'ESCALATION',reason:'Record an unsuccessful manual escalation',
   details:'Synthetic unsuccessful escalation for dashboard regression.',
   succeeded:false,containmentPerformed:false
  }});
  assert.equal(failed.status,201);
  const afterFailure=await snapshot();
  assert.equal(afterFailure.totals.responseActions,afterCreate.totals.responseActions+1);
  assert.equal(afterFailure.totals.reportedFailedActions,afterCreate.totals.reportedFailedActions+1);
  assert.equal(afterFailure.totals.reportedSuccessfulActions,afterCreate.totals.reportedSuccessfulActions);
  assert.equal(afterFailure.totals.activeIncidents,afterCreate.totals.activeIncidents);
  const containment=await request(endpoint,cookies[0],{method:'POST',body:{
   action:'CONTAINMENT',reason:'Approved and successful manual containment',
   details:'Synthetic successful, expressly attested containment outside SentinelX.',
   succeeded:true,containmentPerformed:true
  }});
  assert.equal(containment.status,201);assert.equal((await containment.json()).action.incidentStatus,'CONTAINED');
  const afterContainment=await snapshot(cookies[2]);
  assert.equal(afterContainment.totals.responseActions,afterFailure.totals.responseActions+1);
  assert.equal(afterContainment.totals.reportedSuccessfulActions,afterFailure.totals.reportedSuccessfulActions+1);
  assert.equal(afterContainment.totals.successfulContainments,afterFailure.totals.successfulContainments+1);
  assert.equal(afterContainment.status.incidents.NEW,afterFailure.status.incidents.NEW-1);
  assert.equal(afterContainment.status.incidents.CONTAINED,afterFailure.status.incidents.CONTAINED+1);
  assert.equal(afterContainment.totals.activeIncidents,afterFailure.totals.activeIncidents);
  assert.equal(afterContainment.totals.averageIncidentRisk,afterFailure.totals.averageIncidentRisk);
  const response=(await request('/api/incidents/'+incident.id+'/assessment',cookies[1],{method:'PATCH',body:{
   categoryCode:incident.categoryCode,severity:'MEDIUM',reason:'Verify updated incident severity distribution'
  }}));
  assert.equal(response.status,200);
  const afterAssessment=await snapshot();
  assert.equal(afterAssessment.severity.incidents.CRITICAL,afterContainment.severity.incidents.CRITICAL-1);
  assert.equal(afterAssessment.severity.incidents.MEDIUM,afterContainment.severity.incidents.MEDIUM+1);
  assert.equal(afterAssessment.status.incidents.CONTAINED,afterContainment.status.incidents.CONTAINED);
  assert.equal(afterAssessment.totals.incidentsTotal,afterContainment.totals.incidentsTotal);
  assert.equal(afterAssessment.totals.responseActions,afterContainment.totals.responseActions);
  const raw=await pool.query(`SELECT
    (SELECT count(*)::integer FROM security_events) AS events,
    (SELECT count(*)::integer FROM alerts) AS alerts,
    (SELECT count(*)::integer FROM incidents) AS incidents,
    (SELECT count(*)::integer FROM response_actions) AS responses,
    (SELECT round(avg(risk_score)::numeric,1) FROM incidents) AS average_risk`);
  assert.equal(afterAssessment.totals.eventsTotal,raw.rows[0].events);
  assert.equal(afterAssessment.totals.alertsTotal,raw.rows[0].alerts);
  assert.equal(afterAssessment.totals.incidentsTotal,raw.rows[0].incidents);
  assert.equal(afterAssessment.totals.responseActions,raw.rows[0].responses);
  assert.equal(afterAssessment.totals.averageIncidentRisk,Number(raw.rows[0].average_risk));
  const beforeCount=(await pool.query('SELECT count(*)::integer AS n FROM incidents')).rows[0].n;
  const failPool={connect:async()=>{
   const client=await pool.connect();
   return{query:(sql,values)=>{
    if(sql.includes("FROM alerts GROUP BY threat_level"))throw new Error('Synthetic dashboard read failure: private details');
    return client.query(sql,values);
   },release:error=>client.release(error)};
  }};
  await assert.rejects(dashboardRepository(failPool).snapshot(),{name:'DashboardPersistenceError',message:'Dashboard temporarily unavailable.'});
  assert.equal((await pool.query('SELECT count(*)::integer AS n FROM incidents')).rows[0].n,beforeCount);
  return true;
 }finally{await fixture.cleanup();}
}
async function main(){
 let pool;
 try{
  pool=createPool();
  await verifyDashboard(pool);
  console.log('Live dashboard totals, severity/status distributions, threat and UTC trends, recorded response outcomes, Viewer access, refresh accuracy and read-only rollback verified. Synthetic changes cleaned up.');
 }catch(error){
  console.error('Task 24 dashboard verification failed. Check PostgreSQL, quality and current migrations locally. No credentials were printed.');
  process.exitCode=1;
 }finally{if(pool)await pool.end();}
}
if(require.main===module)main();
module.exports={verifyDashboard};
