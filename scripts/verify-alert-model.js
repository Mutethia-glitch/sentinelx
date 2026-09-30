const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createPool } = require('../src/data/pool');
const { detectionRepository } = require('../src/data/detection-repository');
const { detectionEngine } = require('../src/detection/engine');

async function verifyAlertModel(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("UPDATE threat_categories SET enabled=true WHERE code='BRUTE_FORCE'");

    const definition = {
      schemaVersion: 1,
      conditions: [{ field: 'source', operator: 'equals', value: 'sentinelx-task15-verifier' }],
      threshold: 1,
      windowSeconds: 60,
      groupBy: ['user'],
    };
    const ruleId = (await client.query(`INSERT INTO detection_rules
      (name,description,enabled,definition,threat_level,category_code)
      VALUES($1,'Task 15 alert model verifier',true,$2::jsonb,'HIGH','BRUTE_FORCE') RETURNING id`,
    [`Task 15 alert model ${randomUUID()}`, JSON.stringify(definition)])).rows[0].id;

    const event = {
      timestamp: new Date(Date.now() - 1000).toISOString(),
      source: 'sentinelx-task15-verifier',
      type: 'authentication',
      sourceIp: '192.0.2.150',
      destinationIp: '198.51.100.15',
      user: 'task15-user',
      host: 'task15-host',
      action: 'login',
      status: 'failed',
      severity: 'MEDIUM',
      rawData: { synthetic: true },
      metadata: { verification: 'task15' },
    };
    const { rawData, ...normalized } = event;
    const eventId = (await client.query(`INSERT INTO security_events
      (source,event_type,occurred_at,raw_data,normalized_data,normalized_at)
      VALUES($1,$2,$3,$4::jsonb,$5::jsonb,now()) RETURNING id`,
    [event.source, event.type, event.timestamp, JSON.stringify(rawData), JSON.stringify(normalized)])).rows[0].id;

    const storage = detectionRepository(pool);
    const isolated = {
      enabledRules: async db => (await storage.enabledRules(db)).filter(rule => rule.id === ruleId),
      matchingEvents: (...args) => storage.matchingEvents(...args),
      createAlert: (...args) => storage.createAlert(...args),
    };
    const generated = await detectionEngine(isolated).evaluate({ id: eventId, event }, client);
    assert.equal(generated.length, 1);
    const alert = generated[0];

    assert.equal(alert.ruleId, ruleId);
    assert.equal(alert.triggerEventId, eventId);
    assert.equal(alert.threat, 'BRUTE_FORCE');
    assert.equal(alert.severity, 'HIGH');
    assert.equal(alert.source, event.source);
    assert.equal(alert.status, 'NEW');
    assert.equal(alert.confidence, null);
    assert.deepEqual(alert.affectedEntities, {
      sourceIp: event.sourceIp,
      destinationIp: event.destinationIp,
      user: event.user,
      host: event.host,
    });

    const row = (await client.query(`SELECT rule_id,trigger_event_id,category_code,threat_level,source,created_at,
      affected_entities,status,confidence,match_evidence FROM alerts WHERE id=$1`, [alert.id])).rows[0];
    assert.equal(row.rule_id, ruleId);
    assert.equal(row.trigger_event_id, eventId);
    assert.equal(row.category_code, 'BRUTE_FORCE');
    assert.equal(row.threat_level, 'HIGH');
    assert.equal(row.source, event.source);
    assert.equal(row.status, 'NEW');
    assert.equal(row.confidence, null);
    assert.deepEqual(row.affected_entities, alert.affectedEntities);
    assert.equal(row.created_at.toISOString(), alert.timestamp);
    assert.equal(row.match_evidence.triggerEventId, eventId);
    assert.equal(Number((await client.query('SELECT count(*) FROM alert_events WHERE alert_id=$1', [alert.id])).rows[0].count), 1);

    await client.query('SAVEPOINT invalid_confidence');
    try {
      await client.query('UPDATE alerts SET confidence=1.1 WHERE id=$1', [alert.id]);
      assert.fail('Invalid confidence accepted.');
    } catch (error) {
      assert.equal(error.code, '23514');
      await client.query('ROLLBACK TO SAVEPOINT invalid_confidence');
    }

    await client.query('SAVEPOINT invalid_status');
    try {
      await client.query("UPDATE alerts SET status='RESOLVED' WHERE id=$1", [alert.id]);
      assert.fail('Incident-only status accepted as alert status.');
    } catch (error) {
      assert.equal(error.code, '23514');
      await client.query('ROLLBACK TO SAVEPOINT invalid_status');
    }

    await client.query('ROLLBACK');
    return { alertId: alert.id };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  let pool;
  try {
    pool = createPool();
    await verifyAlertModel(pool);
    console.log('Alert rule/event/threat/severity/source/timestamp/entities/status and nullable confidence verified. Synthetic changes rolled back.');
  } catch {
    console.error('Task 15 alert-model verification failed. Check migrations and PostgreSQL configuration locally. No credentials were printed.');
    process.exitCode = 1;
  } finally {
    if (pool) await pool.end();
  }
}

if (require.main === module) main();
module.exports = { verifyAlertModel };
