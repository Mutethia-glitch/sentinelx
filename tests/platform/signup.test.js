const test=require('node:test');
const assert=require('node:assert/strict');
const {platformService}=require('../../src/platform/service');
test('company signup verifies a six-digit email code before handing an isolated tenant to the provisioner',async()=>{
 let stored=null,sent=null,provisioned=null,activated=null;
 const repository={
  async create(input){stored={...input,attempts:0,status:'PENDING_EMAIL',expires_at:new Date(Date.now()+600000),id:input.registrationId,
    tenant_id:input.tenantId,company_name:input.companyName,admin_email:input.adminEmail,admin_name:input.adminName,
    admin_password_hash:input.passwordHash,code_digest:input.codeDigest,slug:input.slug};},
  async registration(){return stored;},
  async failCode(){stored.attempts++;},
  async markVerified(){stored.status='VERIFIED';return stored;},
  async activate(id,origin){activated={id,origin};stored.status='ACTIVE';stored.admin_password_hash=null;stored.code_digest=null;return activated;},
  async markFailed(){stored.status='FAILED';},
  async replaceCode(){throw new Error('unused');},
 };
 const mailer={async sendCode(message){sent=message;}};
 const provisioner={async provision(payload){provisioned=payload;return{origin:payload.origin};}};
 const config={otpSecret:'p'.repeat(32),otpSeconds:600,otpMaxAttempts:5,otpResendSeconds:60,baseDomain:'example.com'};
 const service=platformService(repository,config,mailer,provisioner);
 const result=await service.signup({companyName:'Acme Security',adminName:'Alice Admin',adminEmail:'alice@acme.example',password:'A synthetic password 123!'});
 assert.match(result.registrationId,/^[0-9a-f-]{36}$/);assert.match(sent.code,/^\d{6}$/);assert.equal(sent.to,'alice@acme.example');
 assert.match(stored.passwordHash,/^scrypt\$/);assert.equal(stored.passwordHash.includes('A synthetic password'),false);
 const verified=await service.verify({registrationId:result.registrationId,code:sent.code});
 assert.equal(verified.tenant.status,'ACTIVE');assert.equal(provisioned.admin.email,'alice@acme.example');
 assert.equal(provisioned.admin.passwordHash,stored.passwordHash===null?provisioned.admin.passwordHash:stored.passwordHash);
 assert.equal(verified.tenant.origin,'https://'+stored.slug+'.example.com');assert.ok(activated);
});
