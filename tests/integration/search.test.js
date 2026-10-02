const test=require('node:test');
const assert=require('node:assert/strict');
const {createPool}=require('../../src/data/pool');
const {executeSql}=require('../../src/data/postgres');
const {migrationSql}=require('../../scripts/migrate');
const {verifySearch}=require('../../scripts/verify-search');
const {eventRepository}=require('../../src/data/event-repository');
test('shared evidence-aware search filters work across event, alert and incident listings',async t=>{
  assert.equal(process.env.SENTINELX_TEST_DATABASE,'1','Use a disposable database.');
  executeSql(migrationSql());const pool=createPool();t.after(()=>pool.end());
  assert.equal(await verifySearch(pool),true);
  // A source-attested native taxonomy verdict exists before any alert/rule.
  const events=eventRepository(pool);
  const saved=await events.create({
    timestamp:new Date().toISOString(),
    source:'site.task41-disposable-fixture',type:'reconnaissance',sourceIp:'192.0.2.25',
    destinationIp:null,user:null,host:'example.test',action:'probe',
    status:'detected',severity:'LOW',rawData:{signal:'app_route_probe'},
    metadata:{categoryCode:'RECONNAISSANCE',issuer:'application'},
  });
  try {
    const found=await events.list({page:1,source:'site.task41-disposable-fixture',categoryCode:'RECONNAISSANCE'});
    assert.deepEqual(found.events.map(event=>event.id),[saved.id]);
    const other=await events.list({page:1,source:'site.task41-disposable-fixture',categoryCode:'BRUTE_FORCE'});
    assert.deepEqual(other.events,[]);
    const withRule=await events.list({page:1,source:'site.task41-disposable-fixture',
      categoryCode:'RECONNAISSANCE',ruleId:'11111111-1111-4111-8111-111111111111'});
    assert.deepEqual(withRule.events,[],'native taxonomy is not proof of a linked rule');
  } finally {
    await pool.query('DELETE FROM security_events WHERE id=$1',[saved.id]);
  }
});
