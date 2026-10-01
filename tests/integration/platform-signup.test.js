const test=require('node:test');
const assert=require('node:assert/strict');
const {createPool}=require('../../src/data/pool');
const {executeSql}=require('../../src/data/postgres');
const {platformMigrationSql}=require('../../scripts/migrate-platform');
const {platformRepository}=require('../../src/platform/repository');
const {platformService}=require('../../src/platform/service');

test('platform signup persists only onboarding metadata and erases temporary credential/code material after provisioning',async t=>{
 assert.equal(process.env.SENTINELX_TEST_DATABASE,'1','Use a disposable database.');
 executeSql(platformMigrationSql());
 const pool=createPool();t.after(()=>pool.end());
 let sent=null,provisioned=null,registrationId=null,tenantId=null;
 const mailer={async sendCode(m){sent=m;}},provisioner={async provision(payload){provisioned=payload;return{origin:payload.origin};}};
 const service=platformService(platformRepository(pool),{otpSecret:'p'.repeat(32),otpSeconds:600,otpMaxAttempts:5,otpResendSeconds:60,baseDomain:'example.test'},mailer,provisioner);
 try{
  const signup=await service.signup({companyName:'Task 41 Integration Company',adminName:'Initial Administrator',adminEmail:'task41-platform@example.invalid',password:'Synthetic Task 41 company password!'});
  registrationId=signup.registrationId;assert.match(sent.code,/^\d{6}$/);
  const before=(await pool.query('SELECT s.admin_password_hash,s.code_digest,t.id tenant_id,t.status FROM company_signups s JOIN tenants t ON t.id=s.tenant_id WHERE s.id=$1',[registrationId])).rows[0];
  tenantId=before.tenant_id;assert.match(before.admin_password_hash,/^scrypt\$/);assert.match(before.code_digest,/^[0-9a-f]{64}$/);assert.equal(before.status,'PENDING_EMAIL');
  const active=await service.verify({registrationId,code:sent.code});assert.equal(active.tenant.status,'ACTIVE');assert.ok(provisioned);assert.equal(provisioned.tenantId,tenantId);
  const after=(await pool.query('SELECT s.admin_password_hash,s.code_digest,t.status,t.origin FROM company_signups s JOIN tenants t ON t.id=s.tenant_id WHERE s.id=$1',[registrationId])).rows[0];
  assert.equal(after.admin_password_hash,null);assert.equal(after.code_digest,null);assert.equal(after.status,'ACTIVE');assert.equal(after.origin,active.tenant.origin);
 }finally{
  if(registrationId)await pool.query('DELETE FROM company_signups WHERE id=$1',[registrationId]);
  if(tenantId)await pool.query('DELETE FROM tenants WHERE id=$1',[tenantId]);
 }
});
