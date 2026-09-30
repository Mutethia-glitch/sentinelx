const test=require('node:test');
const assert=require('node:assert/strict');
const {createPool}=require('../../src/data/pool');
const {executeSql}=require('../../src/data/postgres');
const {migrationSql}=require('../../scripts/migrate');
const {verifyNotifications}=require('../../scripts/verify-notifications');
test('in-app notifications deliver privately with severity, deduplication and safe read state',async t=>{
 assert.equal(process.env.SENTINELX_TEST_DATABASE,'1','Use a disposable database.');
 executeSql(migrationSql());const pool=createPool();t.after(()=>pool.end());
 assert.equal(await verifyNotifications(pool),true);
});
