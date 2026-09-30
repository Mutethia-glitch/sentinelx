const test=require('node:test');
const assert=require('node:assert/strict');
const {createPool}=require('../../src/data/pool');
const {executeSql}=require('../../src/data/postgres');
const {migrationSql}=require('../../scripts/migrate');
const {verifyResponseWorkflow}=require('../../scripts/verify-response-workflow');
test('PostgreSQL preserves manual response records and controlled containment atomically',async t=>{
 assert.equal(process.env.SENTINELX_TEST_DATABASE,'1','Use a disposable database.');
 executeSql(migrationSql());const pool=createPool();t.after(()=>pool.end());
 assert.equal(await verifyResponseWorkflow(pool),true);
});
