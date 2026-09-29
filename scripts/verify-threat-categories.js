const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createPool } = require('../src/data/pool');
const { categoryRepository } = require('../src/data/category-repository');
const { CATEGORY_CODES } = require('../src/threats/taxonomy');
async function main() {
  let pool; let client;
  try {
    pool = createPool();
    const categories = await categoryRepository(pool).list();
    assert.deepEqual(categories.map(row => row.code).sort(), [...CATEGORY_CODES].sort());
    client = await pool.connect(); await client.query('BEGIN');
    await client.query("UPDATE threat_categories SET enabled=true WHERE code='BRUTE_FORCE'");
    const rule = (await client.query("INSERT INTO detection_rules(name, definition, threat_level, category_code) VALUES ($1, '{}', 'LOW', 'BRUTE_FORCE') RETURNING category_code", [`synthetic-verification-${randomUUID()}`])).rows[0];
    const incident = (await client.query("INSERT INTO incidents(title, threat_level, category_code) VALUES ('Synthetic taxonomy verification', 'HIGH', 'BRUTE_FORCE') RETURNING id, category_code")).rows[0];
    assert.equal(rule.category_code, incident.category_code);
    await client.query("UPDATE threat_categories SET enabled=false WHERE code='BRUTE_FORCE'");
    for (const sql of ["INSERT INTO incidents(title, threat_level, category_code) VALUES ('Rejected synthetic selection', 'LOW', 'BRUTE_FORCE')", "INSERT INTO detection_rules(name, definition, threat_level, category_code) VALUES ('Rejected synthetic selection', '{}', 'LOW', 'BRUTE_FORCE')"]) {
      await client.query('SAVEPOINT category_selection');
      await assert.rejects(client.query(sql), { code: '23514' });
      await client.query('ROLLBACK TO SAVEPOINT category_selection');
      await client.query('RELEASE SAVEPOINT category_selection');
    }
    await client.query("UPDATE incidents SET status='RESOLVED', category_code=category_code WHERE id=$1", [incident.id]);
    const retained = (await client.query('SELECT category_code, status, threat_level FROM incidents WHERE id=$1', [incident.id])).rows[0];
    assert.deepEqual(retained, { category_code: 'BRUTE_FORCE', status: 'RESOLVED', threat_level: 'HIGH' });
    await client.query('ROLLBACK');
    console.log('Seven threat categories and rule/incident selection verified. Synthetic changes rolled back.');
  } catch {
    console.error('Threat taxonomy verification failed. Check database migrations and configuration locally.'); process.exitCode = 1;
  } finally {
    if (client) { try { await client.query('ROLLBACK'); } catch { process.exitCode = 1; } client.release(); }
    if (pool) await pool.end();
  }
}
if (require.main === module) main();
module.exports = { main };
