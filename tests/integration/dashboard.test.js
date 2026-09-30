const test=require('node:test');
const assert=require('node:assert/strict');
const {createPool}=require('../../src/data/pool');
const {executeSql}=require('../../src/data/postgres');
const {migrationSql}=require('../../scripts/migrate');
const {verifyDashboard}=require('../../scripts/verify-dashboard');
test('dashboard metrics track real PostgreSQL changes under an authorized read-only snapshot',async t=>{
 assert.equal(process.env.SENTINELX_TEST_DATABASE,'1','Use a disposable database.');
 executeSql(migrationSql());const pool=createPool();t.after(()=>pool.end());
 assert.equal(await verifyDashboard(pool),true);
});
