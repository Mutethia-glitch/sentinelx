const test=require('node:test');
const assert=require('node:assert/strict');
const {createPool}=require('../../src/data/pool');
const {executeSql}=require('../../src/data/postgres');
const {migrationSql}=require('../../scripts/migrate');
const {verifyIncidentClassification}=require('../../scripts/verify-incident-classification');
test('PostgreSQL enforces controlled incident taxonomy and severity adjustment',async t=>{assert.equal(process.env.SENTINELX_TEST_DATABASE,'1','Use a disposable database.');executeSql(migrationSql());const pool=createPool();t.after(()=>pool.end());assert.equal(await verifyIncidentClassification(pool),true);});
