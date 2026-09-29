const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createPool } = require('../src/data/pool');
const { eventRepository } = require('../src/data/event-repository');
const { detectionRepository } = require('../src/data/detection-repository');
const { detectionEngine } = require('../src/detection/engine');

async function main() {
  let pool; let ruleId = null; let categoryEnabled = null; let stage = 'database connection';
  const eventIds = []; const alertIds = [];
  try {
    pool = createPool();

    stage = 'threat category lookup';
    const category = (await pool.query("SELECT enabled FROM threat_categories WHERE code='BRUTE_FORCE'")).rows[0];
    if (!category) throw new Error('missing category');
    categoryEnabled = category.enabled;
    if (!category.enabled) {
      stage = 'temporary threat category enable';
      await pool.query("UPDATE threat_categories SET enabled=true WHERE code='BRUTE_FORCE'");
    }

    const definition = {
      schemaVersion: 1,
      conditions: [
        { field: 'source', operator: 'equals', value: 'sentinelx-simulated' },
        { field: 'type', operator: 'equals', value: 'authentication' },
        { field: 'status', operator: 'equals', value: 'failed' },
      ],
      threshold: 3, windowSeconds: 60, groupBy: ['sourceIp', 'user'],
    };

    stage = 'synthetic rule creation';
    ruleId = (await pool.query(
      "INSERT INTO detection_rules(name,description,enabled,definition,threat_level,category_code) VALUES($1,'Task 13 local verification',true,$2::jsonb,'HIGH','BRUTE_FORCE') RETURNING id",
      [`Task 13 verification ${randomUUID()}`, JSON.stringify(definition)],
    )).rows[0].id;

    const events = eventRepository(pool);
    const repository = detectionRepository(pool);
    // Verification must never evaluate or clean up alerts from unrelated enabled rules.
    const isolatedRepository = {
      async enabledRules(db) {
        return (await repository.enabledRules(db)).filter(rule => rule.id === ruleId);
      },
      matchingEvents: (...args) => repository.matchingEvents(...args),
      createAlert: (...args) => repository.createAlert(...args),
    };
    const engine = detectionEngine(isolatedRepository);
    const base = Date.now() - 120000;
    const input = (offset, status = 'failed', sourceIp = '192.0.2.130') => ({
      timestamp: new Date(base + offset).toISOString(),
      source: 'sentinelx-simulated', type: 'authentication', sourceIp, destinationIp: null,
      user: 'task13-local', host: 'verification-host', action: 'login', status,
      severity: 'MEDIUM', rawData: { synthetic: true }, metadata: { verification: 'task13' },
    });
    const run = async event => {
      let generated = [];
      const saved = await events.create(event, null, async (persisted, client) => {
        generated = await engine.evaluate(persisted, client);
      });
      eventIds.push(saved.id);
      for (const alert of generated) alertIds.push(alert.id);
      return { saved, generated };
    };

    stage = 'first non-threshold event';
    assert.equal((await run(input(0))).generated.length, 0);
    stage = 'non-matching event';
    assert.equal((await run(input(10000, 'success'))).generated.length, 0);
    stage = 'second matching event below threshold';
    assert.equal((await run(input(20000))).generated.length, 0);

    stage = 'threshold alert creation';
    const third = await run(input(30000));
    assert.equal(third.generated.length, 1);
    assert.equal(third.generated[0].eventIds.length, 3);

    stage = 'duplicate trigger suppression';
    assert.equal((await engine.evaluate(third.saved)).length, 0);

    stage = 'event-time window enforcement';
    assert.equal((await run(input(100000))).generated.length, 0);
    stage = 'grouping enforcement';
    assert.equal((await run(input(105000, 'failed', '192.0.2.131'))).generated.length, 0);

    stage = 'persisted alert evidence';
    const alert = (await pool.query('SELECT rule_id, threat_level, match_evidence FROM alerts WHERE id=$1', [third.generated[0].id])).rows[0];
    assert.equal(alert.rule_id, ruleId);
    assert.equal(alert.threat_level, 'HIGH');
    assert.equal(alert.match_evidence.threshold, 3);
    assert.deepEqual(alert.match_evidence.groupValues, ['192.0.2.130', 'task13-local']);
    assert.equal(Number((await pool.query('SELECT count(*) FROM alert_events WHERE alert_id=$1', [third.generated[0].id])).rows[0].count), 3);

    stage = 'atomic rollback';
    const before = Number((await pool.query('SELECT count(*) FROM security_events')).rows[0].count);
    await assert.rejects(
      events.create(input(110000), null, async () => { throw new Error('synthetic detection failure'); }),
      { message: 'Security event persistence unavailable.' },
    );
    assert.equal(Number((await pool.query('SELECT count(*) FROM security_events')).rows[0].count), before);

    console.log('Deterministic matching, non-match rejection, thresholds, grouping, windows, duplicate suppression and atomic rollback verified.');
  } catch (error) {
    const code = typeof error?.code === 'string' && /^[A-Z0-9]{5}$/.test(error.code) ? ` PostgreSQL code: ${error.code}.` : '';
    console.error(`Task 13 detection verification failed during ${stage}.${code} No credentials were printed.`);
    process.exitCode = 1;
  } finally {
    if (pool) {
      try {
        if (alertIds.length) await pool.query('DELETE FROM alert_events WHERE alert_id=ANY($1::uuid[])', [alertIds]);
        if (alertIds.length) await pool.query('DELETE FROM alerts WHERE id=ANY($1::uuid[])', [alertIds]);
        if (eventIds.length) await pool.query('DELETE FROM security_events WHERE id=ANY($1::uuid[])', [eventIds]);
        if (ruleId) await pool.query('DELETE FROM detection_rules WHERE id=$1', [ruleId]);
        if (categoryEnabled !== null) await pool.query("UPDATE threat_categories SET enabled=$1 WHERE code='BRUTE_FORCE'", [categoryEnabled]);
      } catch {
        console.error('Task 13 verifier cleanup needs local review; synthetic verification records may remain.');
        process.exitCode = 1;
      }
      await pool.end();
    }
  }
}
if (require.main === module) main();
module.exports = { main };
