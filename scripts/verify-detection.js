const { randomUUID } = require('node:crypto');
const { createPool } = require('../src/data/pool');
const { eventRepository } = require('../src/data/event-repository');
const { detectionRepository } = require('../src/data/detection-repository');
const { detectionEngine } = require('../src/detection/engine');

async function main() {
  let pool; let ruleId = null;
  const eventIds = []; const alertIds = [];
  try {
    pool = createPool();
    const category = (await pool.query("SELECT enabled FROM threat_categories WHERE code='BRUTE_FORCE'")).rows[0];
    if (!category) throw new Error('missing category');
    const definition = {
      schemaVersion: 1,
      conditions: [
        { field: 'source', operator: 'equals', value: 'sentinelx-simulated' },
        { field: 'type', operator: 'equals', value: 'authentication' },
        { field: 'status', operator: 'equals', value: 'failed' },
      ],
      threshold: 3, windowSeconds: 60, groupBy: ['sourceIp', 'user'],
    };
    ruleId = (await pool.query(
      "INSERT INTO detection_rules(name,description,enabled,definition,threat_level,category_code) VALUES($1,'Task 13 local verification',true,$2::jsonb,'HIGH','BRUTE_FORCE') RETURNING id",
      [`Task 13 verification ${randomUUID()}`, JSON.stringify(definition)],
    )).rows[0].id;

    const events = eventRepository(pool);
    const engine = detectionEngine(detectionRepository(pool));
    const base = Date.now() - 120000;
    const input = (offset, status = 'failed', sourceIp = '192.0.2.130') => ({
      timestamp: new Date(base + offset).toISOString(),
      source: 'sentinelx-simulated', type: 'authentication', sourceIp, destinationIp: null,
      user: 'task13-local', host: 'verification-host', action: 'login', status,
      severity: 'MEDIUM', rawData: { synthetic: true }, metadata: { verification: 'task13' },
    });
    const run = async event => {
      const saved = await events.create(event); eventIds.push(saved.id);
      const generated = await engine.evaluate(saved);
      for (const alert of generated) alertIds.push(alert.id);
      return { saved, generated };
    };

    if ((await run(input(0))).generated.length !== 0) throw new Error('premature alert');
    if ((await run(input(10000, 'success'))).generated.length !== 0) throw new Error('non-match alerted');
    if ((await run(input(20000))).generated.length !== 0) throw new Error('threshold not respected');
    const third = await run(input(30000));
    if (third.generated.length !== 1 || third.generated[0].eventIds.length !== 3) throw new Error('threshold alert missing');
    if ((await engine.evaluate(third.saved)).length !== 0) throw new Error('duplicate trigger alerted');
    if ((await run(input(100000))).generated.length !== 0) throw new Error('window not respected');
    if ((await run(input(105000, 'failed', '192.0.2.131'))).generated.length !== 0) throw new Error('grouping not respected');

    console.log('Deterministic matching, non-match rejection, thresholds, grouping, windows and duplicate suppression verified.');
  } catch {
    console.error('Task 13 detection verification failed. Check migrations and PostgreSQL configuration locally.');
    process.exitCode = 1;
  } finally {
    if (pool) {
      try {
        if (alertIds.length) await pool.query('DELETE FROM alert_events WHERE alert_id=ANY($1::uuid[])', [alertIds]);
        if (alertIds.length) await pool.query('DELETE FROM alerts WHERE id=ANY($1::uuid[])', [alertIds]);
        if (eventIds.length) await pool.query('DELETE FROM security_events WHERE id=ANY($1::uuid[])', [eventIds]);
        if (ruleId) await pool.query('DELETE FROM detection_rules WHERE id=$1', [ruleId]);
      } catch { process.exitCode = 1; }
      await pool.end();
    }
  }
}
if (require.main === module) main();
module.exports = { main };
