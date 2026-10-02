'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createPlatformServer}=require('../../src/platform/server');
const {createServer}=require('../../src/api/server');
const {configFromEnv}=require('../../src/auth/config');

async function serve(t,server){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 return 'http://127.0.0.1:'+server.address().port;
}
test('production onboarding sends host-scoped HSTS on both health and signup, never on HTTP development',async t=>{
 const production=await serve(t,createPlatformServer({}, {production:true,origin:'https://signup.example.com'}));
 for(const uri of ['/healthz','/signup']){
  const result=await fetch(production+uri);
  assert.equal(result.status,200);
  assert.equal(result.headers.get('strict-transport-security'),'max-age=31536000');
  assert.doesNotMatch(result.headers.get('strict-transport-security'),/includeSubDomains|preload/i);
 }
 const development=await serve(t,createPlatformServer({}, {production:false,origin:'http://localhost:3100'}));
 assert.equal((await fetch(development+'/healthz')).headers.get('strict-transport-security'),null);
});
test('secure company runtime emits same host-only HSTS; local HTTP development does not',async t=>{
 const secure=configFromEnv({NODE_ENV:'production',APP_ORIGIN:'https://tenant.example.com',TENANT_ID:'11111111-1111-4111-8111-111111111111',TENANT_NAME:'Synthetic',TENANT_SLUG:'synthetic',AUTH_OTP_SECRET:'x'.repeat(32)});
 const production=await serve(t,createServer({},secure));
 for(const uri of ['/healthz','/access']){
  const result=await fetch(production+uri);
  assert.equal(result.status,200);
  assert.equal(result.headers.get('strict-transport-security'),'max-age=31536000');
 }
 const local=await serve(t,createServer({},configFromEnv({})));
 assert.equal((await fetch(local+'/healthz')).headers.get('strict-transport-security'),null);
});
