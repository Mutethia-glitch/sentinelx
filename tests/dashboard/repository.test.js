const test=require('node:test');
const assert=require('node:assert/strict');
const {dashboardRepository,QUERIES}=require('../../src/data/dashboard-repository');
const overview={eventsTotal:'2',alertsTotal:'2',incidentsTotal:'0',activeIncidents:'0',newAlerts:'2',
 responseActions:'0',reportedSuccessfulActions:'0',reportedFailedActions:'0',successfulContainments:'0',averageIncidentRisk:null};
const recent={eventsReceived:'2',alertsCreated:'2',incidentsCreated:'0',responsesRecorded:'0'};
const trend=Array.from({length:7},(_,i)=>({day:'2026-09-'+String(24+i).padStart(2,'0'),events:'0',alerts:'0',incidents:'0',responses:'0'}));
function fakePool(failAt){
 const queries=[];let released=false;
 const rows={asOf:[{as_of:new Date('2026-09-30T10:00:00Z')}],totals:[overview],recent:[recent],
 severity:[{kind:'ALERT',severity:'CRITICAL',n:'1'},{kind:'ALERT',severity:'HIGH',n:'1'}],
 status:[{kind:'ALERT',status:'NEW',n:'2'}],threats:[{kind:'ALERT',code:'BRUTE_FORCE',n:'2'}],responses:[],trend};
 const client={
  async query(sql){
   queries.push(sql);
   if(sql==='BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY')return{rows:[]};
   if(sql==='COMMIT'||sql==='ROLLBACK')return{rows:[]};
   const key=Object.keys(QUERIES).find(name=>QUERIES[name]===sql);
   if(!key)throw Error('Unexpected query');
   if(key===failAt)throw Error('private database password detail');
   return{rows:rows[key]};
  },
  release(){released=true;},
 };
 return{queries,get released(){return released;},connect:async()=>client};
}
test('snapshot uses a consistent read-only transaction with no mutation',async()=>{
 const pool=fakePool(),dashboard=await dashboardRepository(pool).snapshot();
 assert.equal(dashboard.totals.eventsTotal,2);
 assert.equal(dashboard.totals.alertsTotal,2);
 assert.equal(dashboard.totals.averageIncidentRisk,null);
 assert.equal(dashboard.severity.incidents.CRITICAL,0);
 assert.equal(pool.queries[0],'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
 assert.equal(pool.queries.at(-1),'COMMIT');
 assert.equal(pool.queries.filter(sql=>sql.startsWith('SELECT')||sql.startsWith('WITH')).length,Object.keys(QUERIES).length);
 assert.equal(pool.released,true);
});
test('storage failure rolls back and returns sanitized error',async()=>{
 const pool=fakePool('recent');
 await assert.rejects(dashboardRepository(pool).snapshot(),error=>{
  assert.equal(error.name,'DashboardPersistenceError');
  assert.ok(!error.message.includes('password'));return true;
 });
 assert.equal(pool.queries.at(-1),'ROLLBACK');
 assert.equal(pool.released,true);
});
