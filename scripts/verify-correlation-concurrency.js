const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {createPool}=require('../src/data/pool');
const {eventRepository}=require('../src/data/event-repository');
const {correlationRepository}=require('../src/data/correlation-repository');
const {correlationEngine}=require('../src/correlation/engine');

async function verifyCorrelationConcurrency(pool){
  let first,second,pending,ruleId;
  const eventIds=[],alertIds=[];
  try{
    const category=(await pool.query('SELECT code FROM threat_categories WHERE enabled ORDER BY code LIMIT 1')).rows[0];
    assert.ok(category,'An enabled category is required.');
    const source=`correlation-race-${randomUUID()}`,entities={user:`synthetic-${randomUUID()}`,host:'synthetic-race-host'};
    ruleId=(await pool.query(`INSERT INTO detection_rules(name,description,enabled,definition,threat_level,category_code)
      VALUES($1,'Synthetic concurrent correlation regression',false,'{}','HIGH',$2) RETURNING id`,[source,category.code])).rows[0].id;
    for(let i=0;i<2;i++)eventIds.push((await eventRepository(pool).create({timestamp:'2026-09-30T00:00:00Z',source,type:'authentication',user:entities.user,host:entities.host,status:'failed',rawData:{synthetic:true}})).id);
    first=await pool.connect();second=await pool.connect();
    await second.query('BEGIN');await first.query('BEGIN');
    async function insert(client,index,timestamp){
      const row=(await client.query(`INSERT INTO alerts(rule_id,trigger_event_id,category_code,threat_level,source,affected_entities,status,confidence,match_reason,match_evidence,created_at)
        VALUES($1,$2,$3,'HIGH',$4,$5::jsonb,'NEW',null,'Synthetic race regression',$6::jsonb,$7) RETURNING id`,
      [ruleId,eventIds[index],category.code,source,JSON.stringify(entities),JSON.stringify({triggerEventId:eventIds[index],eventIds:[eventIds[index]]}),timestamp])).rows[0];
      alertIds.push(row.id);await client.query('INSERT INTO alert_events(alert_id,event_id) VALUES($1,$2)',[row.id,eventIds[index]]);
      return{id:row.id,threat:category.code,timestamp,affectedEntities:entities};
    }
    // The waiting transaction's alert is older, so a one-way lookback would miss it.
    const b=await insert(second,1,'2026-09-30T00:00:00.000Z');
    const a=await insert(first,0,'2026-09-30T00:00:01.000Z');
    const repository=correlationRepository(pool),engine=correlationEngine(repository);
    assert.deepEqual((await engine.evaluate(a,first)).groupAlertIds,[a.id]);
    const pid=(await second.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    pending=engine.evaluate(b,second);pending.catch(()=>{});
    let blocked=false;
    for(let attempt=0;attempt<100;attempt++){
      blocked=(await pool.query("SELECT EXISTS(SELECT 1 FROM pg_locks WHERE pid=$1 AND locktype='advisory' AND NOT granted) AS waiting",[pid])).rows[0].waiting;
      if(blocked)break;
      await new Promise(resolve=>setTimeout(resolve,20));
    }
    assert.equal(blocked,true,'Second evaluator must wait until the first transaction commits.');
    await first.query('COMMIT');
    const result=await pending;pending=null;
    assert.equal(result.correlations.length,1);
    assert.deepEqual([...result.groupAlertIds].sort(),[a.id,b.id].sort());
    await second.query('COMMIT');
    assert.equal((await engine.evaluate(a)).correlations.length,0,'Repeated evaluation cannot duplicate the pair.');
    const rows=(await pool.query('SELECT alert_id,related_alert_id FROM alert_correlations WHERE alert_id=ANY($1::uuid[]) OR related_alert_id=ANY($1::uuid[])',[alertIds])).rows;
    assert.equal(rows.length,1);assert.ok(rows[0].alert_id<rows[0].related_alert_id);
    return true;
  }finally{
    if(first){try{await first.query('ROLLBACK');}catch{}first.release();}
    // Releasing the first lock allows any blocked evaluation to finish before rollback.
    if(pending)try{await pending;}catch{}
    if(second){try{await second.query('ROLLBACK');}catch{}second.release();}
    if(alertIds.length){await pool.query('DELETE FROM alert_correlations WHERE alert_id=ANY($1::uuid[]) OR related_alert_id=ANY($1::uuid[])',[alertIds]);await pool.query('DELETE FROM alert_events WHERE alert_id=ANY($1::uuid[])',[alertIds]);await pool.query('DELETE FROM alerts WHERE id=ANY($1::uuid[])',[alertIds]);}
    if(eventIds.length)await pool.query('DELETE FROM security_events WHERE id=ANY($1::uuid[])',[eventIds]);
    if(ruleId)await pool.query('DELETE FROM detection_rules WHERE id=$1',[ruleId]);
  }
}
async function main(){let pool;try{pool=createPool();await verifyCorrelationConcurrency(pool);console.log('Concurrent correlation blocking, reversed timestamp order, connected grouping and pair deduplication verified. Synthetic changes cleaned up.');}catch{console.error('Concurrent correlation verification failed. Check PostgreSQL access and migrations locally. No credentials were printed.');process.exitCode=1;}finally{if(pool)await pool.end();}}
if(require.main===module)main();
module.exports={verifyCorrelationConcurrency};
