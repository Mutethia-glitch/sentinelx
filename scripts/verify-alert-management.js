const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createPool } = require('../src/data/pool');
const { alertRepository } = require('../src/data/alert-repository');
const { alertService } = require('../src/alerts/service');

async function verifyAlertManagement(pool) {
  const category = (await pool.query("SELECT enabled FROM threat_categories WHERE code='BRUTE_FORCE'")).rows[0];
  if (!category) throw new Error('Missing BRUTE_FORCE category.');
  const users = [];
  let ruleId = null, triggerEventId = null, evidenceEventId = null, alertId = null;
  try {
    if (!category.enabled) await pool.query("UPDATE threat_categories SET enabled=true WHERE code='BRUTE_FORCE'");

    for (const role of ['Security Analyst', 'Viewer/Management']) {
      const email = `${randomUUID()}@example.invalid`;
      const user = (await pool.query(`INSERT INTO users(email,password_hash,display_name)
        VALUES($1,'synthetic-task16-not-a-login-hash','Task 16 verifier') RETURNING id`, [email])).rows[0];
      users.push({ id: user.id, role });
      await pool.query('INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE name=$2', [user.id, role]);
    }
    const analyst = users.find(user => user.role === 'Security Analyst');
    const viewer = users.find(user => user.role === 'Viewer/Management');

    const definition = { schemaVersion:1, conditions:[{field:'status',operator:'equals',value:'failed'}], threshold:2, windowSeconds:60, groupBy:['user'] };
    ruleId = (await pool.query(`INSERT INTO detection_rules
      (name,description,enabled,definition,threat_level,category_code)
      VALUES($1,'Task 16 alert management verifier',false,$2::jsonb,'HIGH','BRUTE_FORCE') RETURNING id`,
    [`Task 16 alert rule ${randomUUID()}`, JSON.stringify(definition)])).rows[0].id;

    const normalized = {
      sourceIp:'192.0.2.160', destinationIp:'198.51.100.16', user:'task16-user',
      host:'task16-host', action:'login', status:'failed', severity:'MEDIUM', metadata:{verification:'task16'}
    };
    const makeEvent = async offset => (await pool.query(`INSERT INTO security_events
      (source,event_type,occurred_at,raw_data,normalized_data,normalized_at)
      VALUES('sentinelx-task16-verifier','authentication',clock_timestamp()+($1::text||' seconds')::interval,
        '{"synthetic":true}'::jsonb,$2::jsonb,clock_timestamp()) RETURNING id`,
    [offset, JSON.stringify(normalized)])).rows[0].id;
    evidenceEventId = await makeEvent(-10);
    triggerEventId = await makeEvent(0);

    alertId = randomUUID();
    const affected = { sourceIp:normalized.sourceIp, destinationIp:normalized.destinationIp, user:normalized.user, host:normalized.host };
    const evidence = { categoryCode:'BRUTE_FORCE', triggerEventId, threshold:2, windowSeconds:60, groupBy:['user'], groupValues:[normalized.user], eventIds:[evidenceEventId,triggerEventId] };
    await pool.query(`INSERT INTO alerts
      (id,rule_id,trigger_event_id,category_code,threat_level,source,affected_entities,match_reason,match_evidence)
      VALUES($1,$2,$3,'BRUTE_FORCE','HIGH','sentinelx-task16-verifier',$4::jsonb,'Task 16 synthetic match',$5::jsonb)`,
    [alertId, ruleId, triggerEventId, JSON.stringify(affected), JSON.stringify(evidence)]);
    await pool.query('INSERT INTO alert_events(alert_id,event_id) VALUES($1,$2),($1,$3)', [alertId, evidenceEventId, triggerEventId]);

    const repository = alertRepository(pool);
    const access = {
      async me(token) {
        if (token === 'analyst') return { user:{id:analyst.id}, roles:['Security Analyst'] };
        if (token === 'viewer') return { user:{id:viewer.id}, roles:['Viewer/Management'] };
        throw new Error('Unexpected verifier identity.');
      },
    };
    const service = alertService(repository, access);

    const listed = await service.list('viewer', new URLSearchParams('status=NEW&severity=HIGH&categoryCode=BRUTE_FORCE&source=sentinelx-task16-verifier&q=Task%2016'));
    assert.equal(listed.alerts.length, 1);
    assert.equal(listed.alerts[0].id, alertId);

    const detail = await service.inspect('viewer', alertId);
    assert.equal(detail.rule.id, ruleId);
    assert.equal(detail.triggerEventId, triggerEventId);
    assert.equal(detail.events.length, 2);
    assert.equal(detail.events.filter(event => event.trigger).length, 1);
    assert.equal(detail.events.find(event => event.trigger).id, triggerEventId);
    assert.deepEqual(detail.affectedEntities, affected);

    await assert.rejects(
      service.updateStatus('viewer', alertId, {status:'ACKNOWLEDGED',reason:'Viewer must not mutate alerts'}),
      {status:403},
    );

    const acknowledged = await service.updateStatus('analyst', alertId, {status:'ACKNOWLEDGED',reason:'Synthetic analyst triage'});
    assert.equal(acknowledged.status, 'ACKNOWLEDGED');
    assert.equal(acknowledged.changed, true);
    assert.equal(acknowledged.statusUpdatedBy, analyst.id);

    const unchanged = await service.updateStatus('analyst', alertId, {status:'ACKNOWLEDGED',reason:'No duplicate transition'});
    assert.equal(unchanged.changed, false);

    const reopened = await service.updateStatus('analyst', alertId, {status:'NEW',reason:'Synthetic evidence requires renewed attention'});
    assert.equal(reopened.status, 'NEW');
    assert.equal(reopened.changed, true);

    const audits = (await pool.query(`SELECT action,context FROM audit_logs
      WHERE target_type='alert' AND target_id=$1 ORDER BY occurred_at`, [alertId])).rows;
    assert.equal(audits.length, 2);
    assert.deepEqual(audits.map(row => row.action), ['ALERT_STATUS_CHANGED','ALERT_STATUS_CHANGED']);
    assert.deepEqual(audits.map(row => [row.context.previousStatus,row.context.status]), [['NEW','ACKNOWLEDGED'],['ACKNOWLEDGED','NEW']]);

    await pool.query('DELETE FROM user_roles WHERE user_id=$1', [analyst.id]);
    await assert.rejects(
      service.updateStatus('analyst', alertId, {status:'ACKNOWLEDGED',reason:'Live role revocation must apply'}),
      {status:403},
    );

    return { alertId };
  } finally {
    if (alertId) await pool.query("DELETE FROM audit_logs WHERE target_type='alert' AND target_id=$1", [alertId]);
    if (alertId) await pool.query('DELETE FROM alert_events WHERE alert_id=$1', [alertId]);
    if (alertId) await pool.query('DELETE FROM alerts WHERE id=$1', [alertId]);
    if (triggerEventId || evidenceEventId) {
      const ids=[triggerEventId,evidenceEventId].filter(Boolean);
      await pool.query('DELETE FROM security_events WHERE id=ANY($1::uuid[])', [ids]);
    }
    if (ruleId) await pool.query('DELETE FROM detection_rules WHERE id=$1', [ruleId]);
    if (users.length) {
      const ids=users.map(user=>user.id);
      await pool.query('DELETE FROM user_roles WHERE user_id=ANY($1::uuid[])', [ids]);
      await pool.query('DELETE FROM auth_sessions WHERE user_id=ANY($1::uuid[])', [ids]);
      await pool.query('DELETE FROM audit_logs WHERE actor_id=ANY($1::uuid[]) OR target_id=ANY($1::uuid[])', [ids]);
      await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [ids]);
    }
    if (category && !category.enabled) await pool.query("UPDATE threat_categories SET enabled=false WHERE code='BRUTE_FORCE'");
  }
}

async function main() {
  let pool;
  try {
    pool = createPool();
    await verifyAlertManagement(pool);
    console.log('Alert listing, filtering, detail inspection, source-event tracing, Analyst status workflow, Viewer denial and audit attribution verified.');
  } catch {
    console.error('Task 16 alert-management verification failed. Check migrations and PostgreSQL configuration locally. No credentials were printed.');
    process.exitCode = 1;
  } finally {
    if (pool) await pool.end();
  }
}
if (require.main === module) main();
module.exports = { verifyAlertManagement };
