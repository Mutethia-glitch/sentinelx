const test = require('node:test');
const assert = require('node:assert/strict');
const { createPool } = require('../../src/data/pool');
const { executeSql } = require('../../src/data/postgres');
const { migrationSql } = require('../../scripts/migrate');
const { verifyInitialRules } = require('../../scripts/verify-initial-rules');
const { INITIAL_RULES } = require('../../src/rules/initial-rules');

test('PostgreSQL installs all fifteen Task 14 core rules with tested definitions', async t => {
  assert.equal(process.env.SENTINELX_TEST_DATABASE, '1', 'Use a disposable database.');
  executeSql(migrationSql());
  const pool = createPool();
  t.after(async () => pool.end());
  const result = await verifyInitialRules(pool);
  assert.equal(result.count, 15);
  const categories = (await pool.query(`SELECT category_code, count(*)::int AS count FROM detection_rules
    WHERE name = ANY($1::text[]) GROUP BY category_code ORDER BY category_code`, [INITIAL_RULES.map(rule => rule.name)])).rows;
  assert.equal(categories.length, 15);
  assert.ok(categories.every(row => row.count === 1));
});
