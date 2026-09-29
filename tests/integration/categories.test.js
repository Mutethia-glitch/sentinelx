const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createPool } = require('../../src/data/pool');
const { categoryRepository } = require('../../src/data/category-repository');
const { CATEGORY_CODES } = require('../../src/threats/taxonomy');
const { executeSql } = require('../../src/data/postgres');
const { migrationSql } = require('../../scripts/migrate');
test('PostgreSQL taxonomy is configurable, selectable by rules/incidents and transactionally audited', async t => {
  assert.equal(process.env.SENTINELX_TEST_DATABASE, '1', 'Use a disposable database.'); executeSql(migrationSql()); executeSql(migrationSql());
  const pool = createPool(); const repo = categoryRepository(pool); let actorId; let ruleId; let incidentId;
  const trigger = `category_test_${randomUUID().replaceAll('-', '')}`;
  const previous = (await repo.list()).find(row => row.code === 'BRUTE_FORCE');
  t.after(async () => {
    await pool.query(`DROP TRIGGER IF EXISTS ${trigger} ON audit_logs`); await pool.query(`DROP FUNCTION IF EXISTS ${trigger}()`);
    if (ruleId) await pool.query('DELETE FROM detection_rules WHERE id=$1', [ruleId]);
    if (incidentId) await pool.query('DELETE FROM incidents WHERE id=$1', [incidentId]);
    if (actorId) {
      await pool.query('DELETE FROM audit_logs WHERE actor_id=$1', [actorId]); await pool.query('DELETE FROM user_roles WHERE user_id=$1', [actorId]); await pool.query('DELETE FROM users WHERE id=$1', [actorId]);
    }
    await pool.query('UPDATE threat_categories SET name=$1, description=$2, enabled=$3 WHERE code=$4', [previous.name, previous.description, previous.enabled, previous.code]); await pool.end();
  });
  assert.deepEqual((await repo.list()).map(row => row.code).sort(), [...CATEGORY_CODES].sort());
  actorId = (await pool.query('INSERT INTO users(email, display_name, password_hash) VALUES ($1, $2, $3) RETURNING id', [`${randomUUID()}@example.invalid`, 'Synthetic category operator', 'not a usable hash'])).rows[0].id;
  await pool.query("INSERT INTO user_roles(user_id, role_id) SELECT $1, id FROM roles WHERE name='Administrator'", [actorId]);
  const configuration = { name: 'Synthetic brute force label', description: 'Synthetic configuration only', enabled: true, reason: 'Verify taxonomy configuration' };
  assert.equal((await repo.update(actorId, 'BRUTE_FORCE', configuration)).name, configuration.name);
  const rule = await pool.query("INSERT INTO detection_rules(name, definition, threat_level, category_code) VALUES ($1, '{}'::jsonb, 'LOW', 'BRUTE_FORCE') RETURNING id", [`synthetic-${randomUUID()}`]); ruleId = rule.rows[0].id;
  incidentId = (await pool.query("INSERT INTO incidents(title, threat_level, category_code) VALUES ('Synthetic category fixture', 'HIGH', 'BRUTE_FORCE') RETURNING id")).rows[0].id;
  await repo.update(actorId, 'BRUTE_FORCE', { ...configuration, enabled: false, reason: 'Disable new selection' });
  assert.equal((await repo.list(true)).some(row => row.code === 'BRUTE_FORCE'), false); await assert.rejects(repo.requireSelectable('BRUTE_FORCE'), { status: 400 });
  for (const sql of ["INSERT INTO detection_rules(name, definition, threat_level, category_code) VALUES ('disabled selection', '{}', 'LOW', 'BRUTE_FORCE')", "INSERT INTO incidents(title, threat_level, category_code) VALUES ('disabled selection', 'LOW', 'BRUTE_FORCE')"]) await assert.rejects(pool.query(sql), { code: '23514' });
  await pool.query('UPDATE incidents SET category_code=category_code, status=$1 WHERE id=$2', ['RESOLVED', incidentId]);
  const retained = (await pool.query('SELECT category_code, status, threat_level FROM incidents WHERE id=$1', [incidentId])).rows[0];
  assert.deepEqual(retained, { category_code: 'BRUTE_FORCE', status: 'RESOLVED', threat_level: 'HIGH' });
  await assert.rejects(pool.query("UPDATE incidents SET category_code='ARBITRARY' WHERE id=$1", [incidentId]));
  await assert.rejects(pool.query("DELETE FROM threat_categories WHERE code='BRUTE_FORCE'"), { code: '23503' });
  await assert.rejects(pool.query("INSERT INTO threat_categories(code,name) VALUES ('ARBITRARY','Not approved')"), { code: '23514' });
  const audits = await pool.query("SELECT context FROM audit_logs WHERE actor_id=$1 AND action='THREAT_CATEGORY_UPDATED' ORDER BY occurred_at", [actorId]);
  assert.equal(audits.rows.length, 2); assert.equal(audits.rows[1].context.next.enabled, false); assert.equal(audits.rows[1].context.code, 'BRUTE_FORCE');
  await pool.query(`CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'THREAT_CATEGORY_UPDATED' AND NEW.actor_id = '${actorId}'::uuid THEN RAISE EXCEPTION 'synthetic category audit failure'; END IF; RETURN NEW; END $$`);
  await pool.query(`CREATE TRIGGER ${trigger} BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION ${trigger}()`);
  await assert.rejects(repo.update(actorId, 'BRUTE_FORCE', configuration), { message: 'Threat category persistence unavailable.' });
  assert.equal((await repo.list()).find(row => row.code === 'BRUTE_FORCE').enabled, false);
  await pool.query(`DROP TRIGGER ${trigger} ON audit_logs`); await pool.query(`DROP FUNCTION ${trigger}()`);
  // Revoked Administrator access is rechecked before configuration writes.
  await pool.query('DELETE FROM user_roles WHERE user_id=$1', [actorId]);
  await assert.rejects(repo.update(actorId, 'BRUTE_FORCE', configuration), { status: 403 });
  assert.equal((await repo.list()).find(row => row.code === 'BRUTE_FORCE').enabled, false);
});
