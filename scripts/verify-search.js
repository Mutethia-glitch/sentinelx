const assert=require('node:assert/strict');
const {randomInt}=require('node:crypto');
const {createPool}=require('../src/data/pool');
const {incidentManagementFixture}=require('./verify-incident-management');
async function verifySearch(pool){
  const f=await incidentManagementFixture(pool);
  let mappingId=null,ruleId=null;
  try{
    async function login(user){
      const res=await fetch(f.base+'/api/auth/login',{method:'POST',
        headers:{Origin:f.base,'Content-Type':'application/json'},
        body:JSON.stringify({email:user.email,password:f.password})});
      assert.equal(res.status,200);return res.headers.get('set-cookie').split(';')[0];
    }
    const cookies=[];for(const user of f.users)cookies.push(await login(user));
    const request=(resource,cookie,filters={})=>{
      const path='/api/'+resource+(Object.keys(filters).length?'?'+new URLSearchParams(filters):'');
      return fetch(f.base+path,{headers:cookie?{Cookie:cookie}:{}});
    };
    async function list(resource,filters={},cookie=cookies[2]){
      const res=await request(resource,cookie,filters);
      assert.equal(res.status,200,resource+' '+JSON.stringify(filters));
      const data=await res.json();assert.equal(data.page,Number(filters.page||1));
      assert.equal(data.pageSize,50);return data[resource];
    }
    for(const resource of ['events','alerts','incidents']){
      assert.equal((await request(resource,'')).status,401);
      for(const cookie of cookies)assert.equal((await request(resource,cookie)).status,200);
    }
    ruleId=(await pool.query('SELECT rule_id FROM alerts WHERE id=$1',[f.alertIds[0]])).rows[0].rule_id;
    let technique;
    for(let attempt=0;attempt<20;attempt++){
      technique='T'+String(randomInt(8000,9999))+'.'+String(randomInt(0,1000)).padStart(3,'0');
      const inserted=await pool.query(
        "INSERT INTO mitre_mappings(technique_id,technique_name) VALUES($1,'Task 25 synthetic technique') ON CONFLICT DO NOTHING RETURNING id",
        [technique]);
      if(inserted.rows[0]){mappingId=inserted.rows[0].id;break;}
    }
    assert.ok(mappingId);
    await pool.query('INSERT INTO rule_mitre_mappings(rule_id,mapping_id) VALUES($1,$2)',[ruleId,mappingId]);
    const created=await fetch(f.base+'/api/incidents',{method:'POST',
      headers:{Origin:f.base,Cookie:cookies[1],'Content-Type':'application/json'},
      body:JSON.stringify({title:'Task 25 evidence-chain incident',description:'Search verifier only',
        alertIds:f.alertIds,assignedTo:f.users[1].id,reason:'Test consistent evidence filters'})});
    assert.equal(created.status,201);
    const incident=(await created.json()).incident;f.incidentIds.push(incident.id);
    const eventIds=[...f.eventIds].sort(),alertIds=[...f.alertIds].sort();
    for(const resource of ['events','alerts','incidents']){
      const wanted=resource==='events'?eventIds:resource==='alerts'?alertIds:[incident.id];
      const expectedFirst=resource==='events'?f.eventIds[0]:resource==='alerts'?f.alertIds[0]:incident.id;
      assert.deepEqual((await list(resource,{source:f.source})).map(item=>item.id).sort(),wanted);
      assert.deepEqual((await list(resource,{source:f.source,sourceIp:'192.0.2.18',user:'task18-user',
        host:'task18-host',ruleId,mitreTechniqueId:technique,categoryCode:f.category})).map(item=>item.id),[expectedFirst]);
      assert.deepEqual(await list(resource,{sourceIp:'192.0.2.18',user:'unrelated-user',ruleId}),[]);
      assert.deepEqual(await list(resource,{destinationIp:'198.51.100.123',ruleId}),[]);
      assert.deepEqual((await list(resource,{mitreTechniqueId:technique,ruleId})).map(item=>item.id).sort(),wanted);
      assert.deepEqual(await list(resource,{mitreTechniqueId:'T0000.000',ruleId}),[]);
      assert.deepEqual(await list(resource,{source:f.source,ruleId,page:'2'}),[]);
      assert.deepEqual(await list(resource,{source:f.source,q:"%' OR 1=1 --"}),[]);
      for(const invalid of ['sourceIp=bad','destinationIp=192.0.2.999','ruleId=bad',
        'mitreTechniqueId=T000','categoryCode=INVALID','q=a&q=b','page=0','severity=SEVERE',
        'from=2026-10-01T00%3A00%3A00Z&to=2026-09-30T00%3A00%3A00Z']){
        const res=await fetch(f.base+'/api/'+resource+'?'+invalid,{headers:{Cookie:cookies[2]}});
        assert.equal(res.status,400,resource+' '+invalid);
      }
    }
    assert.deepEqual((await list('events',{source:f.source,status:'failed',type:'authentication',
      action:'login',severity:'HIGH'})).map(item=>item.id),[f.eventIds[0]]);
    assert.deepEqual((await list('alerts',{source:f.source,status:'NEW',severity:'HIGH'})).map(item=>item.id),[f.alertIds[0]]);
    assert.deepEqual((await list('incidents',{source:f.source,status:'NEW',severity:'CRITICAL'})).map(item=>item.id),[incident.id]);
    assert.deepEqual((await list('events',{source:f.source,from:'2026-09-30T00:00:01Z',
      to:'2026-09-30T00:00:01Z'})).map(item=>item.id),[f.eventIds[1]]);
    assert.deepEqual((await list('events',{source:f.source,to:'2026-09-30T00:00:00Z'})).map(item=>item.id),[f.eventIds[0]]);
    const moment=new Date(incident.createdAt).getTime();
    const from=new Date(moment-600000).toISOString(),to=new Date(moment+600000).toISOString();
    assert.deepEqual((await list('incidents',{source:f.source,from,to})).map(item=>item.id),[incident.id]);
    assert.deepEqual((await list('alerts',{source:f.source,from,to})).map(item=>item.id).sort(),alertIds);
    assert.equal((await request('events',cookies[2],{status:'CONTAINED'})).status,200);
    assert.equal((await request('alerts',cookies[2],{status:'CONTAINED'})).status,400);
    assert.equal((await request('incidents',cookies[2],{status:'ACKNOWLEDGED'})).status,400);
    assert.equal((await request('events',cookies[2],{categoryCode:'UNCLASSIFIED'})).status,400);
    const updated=await fetch(f.base+'/api/incidents/'+incident.id+'/assessment',{method:'PATCH',
      headers:{Cookie:cookies[1],Origin:f.base,'Content-Type':'application/json'},
      body:JSON.stringify({categoryCode:null,severity:'CRITICAL',reason:'Test unclassified filter'})});
    assert.equal(updated.status,200);
    assert.deepEqual((await list('incidents',{source:f.source,categoryCode:'UNCLASSIFIED'})).map(item=>item.id),[incident.id]);
    return true;
  }finally{
    if(mappingId){
      await pool.query('DELETE FROM rule_mitre_mappings WHERE rule_id=$1 AND mapping_id=$2',[ruleId,mappingId]);
      await pool.query('DELETE FROM mitre_mappings WHERE id=$1',[mappingId]);
    }
    await f.cleanup();
  }
}
async function main(){
  let pool;
  try{
    pool=createPool();await verifySearch(pool);
    console.log('Consistent event/alert/incident date, severity, status, category, IP, user, host, rule and MITRE filters, evidence-chain matching, RBAC and safe pagination verified. Synthetic changes cleaned up.');
  }catch{
    console.error('Task 25 search verification failed. Review PostgreSQL migrations and quality checks locally. No credentials were printed.');
    process.exitCode=1;
  }finally{if(pool)await pool.end();}
}
if(require.main===module)main();
module.exports={verifySearch};
