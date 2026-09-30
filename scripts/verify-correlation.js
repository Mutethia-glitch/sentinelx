const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createPool } = require('../src/data/pool');
const { correlationRepository } = require('../src/data/correlation-repository');
const { correlationEngine } = require('../src/correlation/engine');

async function verifyCorrelation(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("UPDATE threat_categories SET enabled=true WHERE code IN ('BRUTE_FORCE','MALWARE')");
    const bruteRule = (await client.query(`INSERT INTO detection_rules(name,description,enabled,definition,threat_level,category_code)
      VALUES($1,'Task 17 verifier',false,'{}','HIGH','BRUTE_FORCE') RETURNING id`, [`Task 17 BF ${randomUUID()}`])).rows[0].id;
    const malwareRule = (await client.query(`INSERT INTO detection_rules(name,description,enabled,definition,threat_level,category_code)
      VALUES($1,'Task 17 verifier',false,'{}','HIGH','MALWARE') RETURNING id`, [`Task 17 malware ${randomUUID()}`])).rows[0].id;

    async function createAlert(ruleId, threat, timestamp, entities, label) {
      const eventId = (await client.query(`INSERT INTO security_events(source,event_type,occurred_at,raw_data,normalized_data,normalized_at)
        VALUES('task17-verifier','correlation',$1,'{}',$2::jsonb,now()) RETURNING id`,
      [timestamp, JSON.stringify({ sourceIp: entities.sourceIp ?? null, destinationIp: null, user: entities.user ?? null, host: entities.host ?? null, action: 'correlate', status: 'detected', severity: 'HIGH', metadata: { task: 17 } })])).rows[0].id;
      const alertId = (await client.query(`INSERT INTO alerts(rule_id,trigger_event_id,category_code,threat_level,source,affected_entities,status,confidence,match_reason,match_evidence,created_at)
        VALUES($1,$2,$3,'HIGH','task17-verifier',$4::jsonb,'NEW',null,$5,$6::jsonb,$7) RETURNING id`,
      [ruleId, eventId, threat, JSON.stringify(entities), `Task 17 ${label}`, JSON.stringify({ triggerEventId: eventId, eventIds: [eventId] }), timestamp])).rows[0].id;
      await client.query('INSERT INTO alert_events(alert_id,event_id) VALUES($1,$2)', [alertId, eventId]);
      return { id: alertId, threat, timestamp: new Date(timestamp).toISOString(), affectedEntities: entities };
    }

    const a = await createAlert(bruteRule, 'BRUTE_FORCE', '2026-09-30T00:00:00Z', { user: 'alice', sourceIp: '192.0.2.1', host: 'host-a' }, 'A');
    const repository = correlationRepository(pool);
    const engine = correlationEngine(repository);
    assert.deepEqual((await engine.evaluate(a, client)).groupAlertIds, [a.id]);
    const b = await createAlert(bruteRule, 'BRUTE_FORCE', '2026-09-30T00:05:00Z', { user: 'alice', sourceIp: '192.0.2.2', host: 'host-b' }, 'B');
    const bResult = await engine.evaluate(b, client);
    assert.equal(bResult.correlations.length, 1);
    assert.deepEqual(bResult.correlations[0].matchedFields, ['user', 'category']);
    const c = await createAlert(malwareRule, 'MALWARE', '2026-09-30T00:10:00Z', { user: 'alice', sourceIp: '192.0.2.3', host: 'host-a' }, 'C');
    const cResult = await engine.evaluate(c, client);
    assert.equal(cResult.correlations.length, 1);
    assert.deepEqual(cResult.correlations[0].matchedFields, ['user', 'host']);
    assert.deepEqual([...cResult.groupAlertIds].sort(), [a.id, b.id, c.id].sort());
    const d = await createAlert(bruteRule, 'BRUTE_FORCE', '2026-09-30T00:11:00Z', { user: 'bob', sourceIp: '192.0.2.9', host: 'host-z' }, 'D');
    assert.deepEqual((await engine.evaluate(d, client)).groupAlertIds, [d.id]);
    const e = await createAlert(bruteRule, 'BRUTE_FORCE', '2026-09-30T00:20:01Z', { user: 'alice', sourceIp: '192.0.2.1', host: 'host-x' }, 'E');
    assert.deepEqual((await engine.evaluate(e, client)).groupAlertIds, [e.id]);

    const rows = (await client.query(`SELECT alert_id,related_alert_id,relationship FROM alert_correlations
      WHERE alert_id=ANY($1::uuid[]) OR related_alert_id=ANY($1::uuid[]) ORDER BY created_at,id`, [[a.id,b.id,c.id,d.id,e.id]])).rows;
    assert.equal(rows.length, 2);
    assert.ok(rows.every(row => row.alert_id < row.related_alert_id));
    const repeat = await engine.evaluate(b, client);
    assert.equal(repeat.correlations.length, 0);
    assert.deepEqual([...repeat.groupAlertIds].sort(), [a.id,b.id,c.id].sort());

    await client.query('SAVEPOINT duplicate_pair');
    try {
      await client.query('INSERT INTO alert_correlations(alert_id,related_alert_id,relationship) VALUES($1,$2,$3::jsonb)',
        [rows[0].alert_id, rows[0].related_alert_id, JSON.stringify(rows[0].relationship)]);
      assert.fail('Duplicate correlation pair accepted.');
    } catch (error) {
      assert.equal(error.code, '23505');
      await client.query('ROLLBACK TO SAVEPOINT duplicate_pair');
    }
    await client.query('SAVEPOINT reverse_pair');
    try {
      await client.query('INSERT INTO alert_correlations(alert_id,related_alert_id,relationship) VALUES($1,$2,$3::jsonb)',
        [rows[0].related_alert_id, rows[0].alert_id, JSON.stringify(rows[0].relationship)]);
      assert.fail('Reverse correlation pair accepted.');
    } catch (error) {
      assert.equal(error.code, '23514');
      await client.query('ROLLBACK TO SAVEPOINT reverse_pair');
    }

    await client.query('ROLLBACK');
    return true;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally { client.release(); }
}

async function main() {
  let pool;
  try {
    pool = createPool();
    await verifyCorrelation(pool);
    console.log('Explainable alert correlation, connected grouping, time-window rejection and pair deduplication verified. Synthetic changes rolled back.');
  } catch {
    console.error('Task 17 correlation verification failed. Check migrations and PostgreSQL configuration locally. No credentials were printed.');
    process.exitCode = 1;
  } finally { if (pool) await pool.end(); }
}
if (require.main === module) main();
module.exports = { verifyCorrelation };
