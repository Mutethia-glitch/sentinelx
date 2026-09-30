const test=require('node:test');
const assert=require('node:assert/strict');
const {createPool}=require('../../src/data/pool');
const {executeSql}=require('../../src/data/postgres');
const {migrationSql}=require('../../scripts/migrate');
const {verifyCorrelation}=require('../../scripts/verify-correlation');

test('PostgreSQL correlation groups related alerts with explainable deduplicated edges',async t=>{
  assert.equal(process.env.SENTINELX_TEST_DATABASE,'1','Use a disposable database.');
  executeSql(migrationSql());
  const pool=createPool();
  t.after(()=>pool.end());
  assert.equal(await verifyCorrelation(pool),true);
});

test('concurrent correlation waits for commit and groups older waiting alerts exactly once',async t=>{
  assert.equal(process.env.SENTINELX_TEST_DATABASE,'1','Use a disposable database.');executeSql(migrationSql());
  const pool=createPool();t.after(()=>pool.end());
  const {verifyCorrelationConcurrency}=require('../../scripts/verify-correlation-concurrency');
  assert.equal(await verifyCorrelationConcurrency(pool),true);
});
