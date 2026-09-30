const assert=require('node:assert/strict');
const {createPool}=require('../src/data/pool');
const {incidentManagementFixture}=require('./verify-incident-management');

async function verifyReporting(pool){
 const f=await incidentManagementFixture(pool);
 try{
  async function login(user){
   const r=await fetch(f.base+'/api/auth/login',{method:'POST',headers:{Origin:f.base,'Content-Type':'application/json'},body:JSON.stringify({email:user.email,password:f.password})});
   assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];
  }
  const cookies=[];for(const user of f.users)cookies.push(await login(user));
  const get=(path,cookie)=>fetch(f.base+path,{headers:cookie?{Cookie:cookie}:{}});
  assert.equal((await get('/api/reports/security','')).status,401);
  for(const cookie of cookies)assert.equal((await get('/api/reports/security',cookie)).status,200);
  const baseline=(await (await get('/api/reports/security',cookies[2])).json()).report;
  const created=await fetch(f.base+'/api/incidents',{method:'POST',headers:{Cookie:cookies[1],Origin:f.base,'Content-Type':'application/json'},
   body:JSON.stringify({title:'=1+1',description:'Synthetic report verification',alertIds:f.alertIds,assignedTo:f.users[1].id,reason:'Reporting verifier'})});
  assert.equal(created.status,201);const incident=(await created.json()).incident;f.incidentIds.push(incident.id);
  const note=await fetch(f.base+'/api/investigations/'+incident.id+'/notes',{method:'POST',headers:{Cookie:cookies[1],Origin:f.base,'Content-Type':'application/json'},
   body:JSON.stringify({content:'Synthetic report finding.',alertIds:[f.alertIds[0]],eventIds:[f.eventIds[0]]})});
  assert.equal(note.status,201);
  const response=await fetch(f.base+'/api/responses/'+incident.id+'/actions',{method:'POST',headers:{Cookie:cookies[1],Origin:f.base,'Content-Type':'application/json'},
   body:JSON.stringify({action:'ESCALATION',reason:'Synthetic report escalation',details:'Recorded for report verification.',succeeded:true,containmentPerformed:false})});
  assert.equal(response.status,201);
  const summary=(await (await get('/api/reports/security',cookies[2])).json()).report;
  assert.equal(summary.type,'SECURITY_SUMMARY');assert.ok(Date.parse(summary.asOf));
  assert.ok(summary.incidents.total>=baseline.incidents.total+1);
  assert.ok(summary.responses.total>=baseline.responses.total+1);
  assert.ok(summary.events.total>=2);assert.ok(summary.alerts.total>=2);
  const now=Date.now(),from=new Date(now-3600000).toISOString(),to=new Date(now+3600000).toISOString();
  const ranged=(await (await get('/api/reports/security?from='+encodeURIComponent(from)+'&to='+encodeURIComponent(to),cookies[1])).json()).report;
  assert.ok(ranged.incidents.total>=1);assert.ok(ranged.responses.total>=1);
  assert.equal(ranged.range.from,from);assert.equal(ranged.range.to,to);
  assert.equal((await get('/api/reports/security?from=2026-10-02T00%3A00%3A00Z&to=2026-10-01T00%3A00%3A00Z',cookies[1])).status,400);
  assert.equal((await get('/api/reports/security?format=pdf',cookies[1])).status,400);
  const detailRes=await get('/api/reports/incidents/'+incident.id,cookies[2]);assert.equal(detailRes.status,200);
  const detail=(await detailRes.json()).report;
  assert.equal(detail.type,'INCIDENT_REPORT');assert.equal(detail.incident.id,incident.id);
  assert.equal(detail.incident.title,'=1+1');assert.equal(detail.alerts.length,2);
  assert.equal(detail.investigationNotes.length,1);assert.equal(detail.responses.length,1);
  assert.equal(detail.investigationNotes[0].content,'Synthetic report finding.');
  assert.equal(detail.responses[0].action,'ESCALATION');
  const csv=await get('/api/reports/incidents/'+incident.id+'?format=csv',cookies[0]);
  assert.equal(csv.status,200);assert.match(csv.headers.get('content-type'),/^text\/csv/);
  const text=await csv.text();assert.ok(text.startsWith('section,key,value\r\n'));assert.ok(text.includes("incident,title,'=1+1\r\n"));assert.ok(!text.includes('incident,title,=1+1\r\n'));assert.ok(text.includes('Synthetic report finding.'));
  assert.equal((await get('/api/reports/incidents/11111111-1111-4111-8111-111111111111',cookies[1])).status,404);
  const before=(await pool.query('SELECT count(*)::integer n FROM incidents')).rows[0].n;
  await get('/api/reports/security',cookies[1]);await get('/api/reports/incidents/'+incident.id,cookies[1]);
  const after=(await pool.query('SELECT count(*)::integer n FROM incidents')).rows[0].n;assert.equal(after,before);
  return true;
 }finally{await f.cleanup();}
}
async function main(){let pool;try{pool=createPool();await verifyReporting(pool);console.log('Stored-data security summaries, incident reports, date ranges, JSON/CSV export, RBAC and read-only reporting verified. Synthetic changes cleaned up.');}catch{console.error('Task 26 reporting verification failed. Check PostgreSQL and quality locally. No credentials were printed.');process.exitCode=1;}finally{if(pool)await pool.end();}}
if(require.main===module)main();
module.exports={verifyReporting};