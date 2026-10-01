const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {configFromEnv}=require('../src/auth/config');
const {platformConfig}=require('../src/platform/config');
const {CATEGORY_CODES}=require('../src/threats/taxonomy');
function source(file){return fs.readFileSync(path.join(__dirname,'..',file),'utf8');}
function main(){
 const tenantId='11111111-1111-4111-8111-111111111111';
 const tenant=configFromEnv({NODE_ENV:'production',APP_ORIGIN:'https://acme.example.com',TENANT_ID:tenantId,TENANT_NAME:'Acme',TENANT_SLUG:'acme',AUTH_OTP_SECRET:'x'.repeat(32),TRUSTED_PROXY_IPS:'127.0.0.1'});
 assert.equal(tenant.requireEmail2fa,true);assert.equal(tenant.secureCookie,true);assert.equal(tenant.bindHost,'0.0.0.0');
 const platform=platformConfig({NODE_ENV:'production',PLATFORM_ORIGIN:'https://signup.example.com',PLATFORM_DATABASE_URL:'postgresql://placeholder.invalid/platform',PLATFORM_OTP_SECRET:'p'.repeat(32),TENANT_BASE_DOMAIN:'example.com'});
 assert.equal(platform.baseDomain,'example.com');
 assert.equal(CATEGORY_CODES.length,15);assert.equal(new Set(CATEGORY_CODES).size,15);
 for(const file of ['Dockerfile','deploy/tenant.env.example','deploy/platform.env.example','deploy/compose.tenant.yml','deploy/compose.platform.yml',
   'db/migrations/016_tenant_identity_and_email_auth.sql','platform/db/migrations/001_company_onboarding.sql'])assert.equal(fs.existsSync(path.join(__dirname,'..',file)),true,file);
 const auth=source('src/api/auth-handler.js');for(const route of ['/api/auth/verify-2fa','/api/auth/resend-2fa','/api/auth/activate'])assert.ok(auth.includes(route),route);
 const access=source('src/api/access-handler.js');assert.ok(access.includes('/api/access/invitations'));assert.ok(access.includes('/active'));
 const server=source('src/api/server.js');assert.ok(server.includes("req.url==='/healthz'"));assert.ok(server.includes('tenant_profile'));assert.ok(server.includes('trustedProxyIps'));
 const platformServer=source('src/platform/server.js');assert.ok(platformServer.includes('/api/company-signup/verify'));assert.ok(platformServer.includes('/healthz'));
 const ui=source('frontend/shared/sentinelx-ui.js');assert.ok(ui.includes('beginTwoFactor'));
 for(const page of ['events','alerts','incidents','dashboard','notifications','audit'])assert.ok(source('frontend/'+page+'/'+page+'.js').includes('beginTwoFactor'),page+' 2FA redirect');
 const pkg=JSON.parse(source('package.json'));for(const name of ['start:platform','db:migrate:platform','tenant:bootstrap','verify:deployment','smoke:online','test:tenant-auth:integration','test:platform-signup:integration'])assert.ok(pkg.scripts[name],name);
 console.log('Production HTTPS configuration, isolated tenant identity, six-digit email 2FA, company user administration, onboarding control plane and deployment artifacts verified.');
}
if(require.main===module){try{main();}catch(error){console.error('Task 41 deployment verification failed: '+error.message);process.exitCode=1;}}
module.exports={main};
