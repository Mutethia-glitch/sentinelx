const assert = require('node:assert/strict');
const { createPool } = require('../src/data/pool');
const { eventRepository } = require('../src/data/event-repository');
const { normalizeRawEvent, NormalizationError } = require('../src/normalization/service');
async function main() {
  let pool; const ids = [];
  try {
    pool = createPool(); const repository = eventRepository(pool); const normalized = [];
    for (const name of ['raw-flat', 'raw-nested']) {
      const input = require(`../fixtures/events/${name}.json`);
      const canonical = normalizeRawEvent(input);
      const saved = await repository.create(canonical); ids.push(saved.id);
      const loaded = await repository.getById(saved.id);
      assert.deepEqual(loaded.event, canonical); assert.deepEqual(loaded.rawData, input.rawData);
      normalized.push(loaded.event);
    }
    for (const field of ['timestamp', 'source', 'type', 'sourceIp', 'destinationIp', 'user', 'host', 'action', 'status', 'severity']) assert.deepEqual(normalized[0][field], normalized[1][field]);
    assert.throws(() => normalizeRawEvent({ format: 'unsupported', source: 'sentinelx-simulated', rawData: {} }), NormalizationError);
    console.log('Log normalization and raw evidence persistence verified.');
  } catch {
    console.error('Normalization verification failed. Check database configuration and migrations locally.'); process.exitCode = 1;
  } finally {
    if (pool) {
      try { await pool.query('DELETE FROM security_events WHERE id = ANY($1::uuid[]) AND source = $2', [ids, 'sentinelx-simulated']); }
      catch { console.error('Synthetic normalization cleanup failed. Check locally.'); process.exitCode = 1; }
      await pool.end();
    }
  }
}
if (require.main === module) main();
module.exports = { main };
