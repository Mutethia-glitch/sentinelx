const { createPool } = require('../src/data/pool');
const { eventRepository } = require('../src/data/event-repository');
const assert = require('node:assert/strict');
async function main() {
  let pool; let id;
  try {
    pool = createPool();
    const repository = eventRepository(pool);
    const input = { timestamp: new Date().toISOString(), source: 'sentinelx-synthetic-verification', type: 'authentication', sourceIp: '192.0.2.10', destinationIp: '2001:db8::10', user: 'synthetic user', host: 'synthetic host', action: 'login', status: 'failed', severity: 'LOW', rawData: { synthetic: true, evidence: ['retained', false] }, metadata: { purpose: 'Task 07 local verification' } };
    const saved = await repository.create(input); id = saved.id;
    const loaded = await repository.getById(id);
    assert.deepEqual(loaded.event, input);
    assert.deepEqual(loaded, saved);
    console.log('Security event model persistence verified.');
  } catch {
    console.error('Security event verification failed. Check database configuration and migrations locally.');
    process.exitCode = 1;
  } finally {
    if (pool) {
      try { if (id) await pool.query('DELETE FROM security_events WHERE id = $1 AND source = $2', [id, 'sentinelx-synthetic-verification']); }
      catch { console.error('Synthetic event cleanup failed. Check locally.'); process.exitCode = 1; }
      await pool.end();
    }
  }
}
if (require.main === module) main();
module.exports = { main };
