'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createPool}=require('../../src/data/pool');
const {executeSql}=require('../../src/data/postgres');
const {migrationSql}=require('../../scripts/migrate');
const {verifyEndToEndScenarios}=require('../../scripts/verify-end-to-end-scenarios');

test('controlled Task 40 scenarios propagate all fifteen threat categories through the system',async t=>{
  assert.equal(process.env.SENTINELX_TEST_DATABASE,'1','Use a controlled disposable/test database.');
  executeSql(migrationSql());
  const pool=createPool();
  t.after(()=>pool.end());
  const result=await verifyEndToEndScenarios(pool);
  assert.equal(result.categoryCount,15);
  assert.equal(result.requiredScenarios.bruteForce,'BRUTE_FORCE');
  assert.ok(result.requiredScenarios.suspiciousAuthentication.includes('CREDENTIAL_ATTACK'));
  assert.equal(result.requiredScenarios.privilegeEscalation,'PRIVILEGE_ESCALATION');
  assert.equal(result.requiredScenarios.reconnaissance,'RECONNAISSANCE');
  assert.ok(result.requiredScenarios.suspiciousOutbound.includes('DATA_EXFILTRATION'));
  assert.equal(result.requiredScenarios.correlation,'BRUTE_FORCE');
});
