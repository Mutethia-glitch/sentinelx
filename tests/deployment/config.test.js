const test=require('node:test');
const assert=require('node:assert/strict');
const {configFromEnv}=require('../../src/auth/config');
const {emailConfig}=require('../../src/email/delivery');
const {platformConfig}=require('../../src/platform/config');
const {provisionerConfig}=require('../../src/platform/provisioner');
const TENANT='11111111-1111-4111-8111-111111111111';
test('production tenant configuration requires HTTPS, tenant identity and email 2FA secret',()=>{
 const base={NODE_ENV:'production',APP_ORIGIN:'https://acme.example.com',TENANT_ID:TENANT,TENANT_NAME:'Acme',TENANT_SLUG:'acme',AUTH_OTP_SECRET:'x'.repeat(32)};
 const config=configFromEnv(base);
 assert.equal(config.requireEmail2fa,true);assert.equal(config.secureCookie,true);assert.equal(config.bindHost,'0.0.0.0');
 assert.deepEqual(config.tenant,{id:TENANT,name:'Acme',slug:'acme'});
 for(const patch of [{APP_ORIGIN:'http://acme.example.com'},{TENANT_ID:''},{AUTH_OTP_SECRET:'short'},{TRUSTED_PROXY_IPS:'not-an-ip'}])assert.throws(()=>configFromEnv({...base,...patch}));
});
test('production email and provisioning adapters require HTTPS and separate secrets',()=>{
 assert.throws(()=>emailConfig({NODE_ENV:'production'}));
 assert.throws(()=>emailConfig({NODE_ENV:'production',EMAIL_DELIVERY_URL:'http://mail.example.com',EMAIL_DELIVERY_TOKEN:'x'.repeat(20),EMAIL_FROM:'noreply@example.com'}));
 assert.equal(emailConfig({NODE_ENV:'production',EMAIL_DELIVERY_URL:'https://mail.example.com/send',EMAIL_DELIVERY_TOKEN:'x'.repeat(20),EMAIL_FROM:'noreply@example.com'}).enabled,true);
 assert.throws(()=>provisionerConfig({TENANT_PROVISIONER_URL:'http://provision.example.com',TENANT_PROVISIONER_TOKEN:'x'.repeat(24)}));
 assert.equal(provisionerConfig({TENANT_PROVISIONER_URL:'https://provision.example.com',TENANT_PROVISIONER_TOKEN:'x'.repeat(24)}).url,'https://provision.example.com/');
});
test('platform production configuration is separate from tenant runtime configuration',()=>{
 const config=platformConfig({NODE_ENV:'production',PLATFORM_ORIGIN:'https://signup.example.com',PLATFORM_DATABASE_URL:'postgresql://platform.invalid/db',
  PLATFORM_OTP_SECRET:'p'.repeat(32),TENANT_BASE_DOMAIN:'example.com',TRUSTED_PROXY_IPS:'127.0.0.1'});
 assert.equal(config.origin,'https://signup.example.com');assert.equal(config.baseDomain,'example.com');assert.deepEqual(config.trustedProxyIps,['127.0.0.1']);
});
test('platform binds managed host PORT while preserving explicit local override',()=>{
 const base={PLATFORM_DATABASE_URL:'postgresql://platform.invalid/db',PLATFORM_OTP_SECRET:'p'.repeat(32)};
 assert.equal(platformConfig({...base,PORT:'10000'}).port,10000);
 assert.equal(platformConfig({...base,PORT:'10000',PLATFORM_PORT:'3100'}).port,3100);
 assert.throws(()=>platformConfig({...base,PORT:'invalid'}));
});
test('assigned Render origins do not require a custom tenant domain',()=>{
 const config=platformConfig({NODE_ENV:'production',PLATFORM_ORIGIN:'https://signup.onrender.com',PLATFORM_DATABASE_URL:'postgresql://platform.invalid/db',PLATFORM_OTP_SECRET:'p'.repeat(32),TENANT_ORIGIN_MODE:'render'});
 assert.equal(config.originMode,'render');assert.equal(config.baseDomain,'');
 assert.throws(()=>platformConfig({PLATFORM_DATABASE_URL:'postgresql://platform.invalid/db',PLATFORM_OTP_SECRET:'p'.repeat(32),TENANT_ORIGIN_MODE:'invalid'}));
});
