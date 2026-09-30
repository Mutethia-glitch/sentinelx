const test = require('node:test');
const assert = require('node:assert/strict');
const { createPool } = require('../../src/data/pool');
const { executeSql } = require('../../src/data/postgres');
const { migrationSql } = require('../../scripts/migrate');
const { verifyAlertModel } = require('../../scripts/verify-alert-model');

test('PostgreSQL generated alert satisfies the Task 15 alert model', async t => {
  assert.equal(process.env.SENTINELX_TEST_DATABASE, '1', 'Use a disposable database.');
  executeSql(migrationSql());
  const pool = createPool();
  t.after(async () => pool.end());
  const result = await verifyAlertModel(pool);
  assert.match(result.alertId, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);
});
