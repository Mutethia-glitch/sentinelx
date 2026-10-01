const test=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID,randomBytes}=require('node:crypto');
const {createServer}=require('../../src/api/server');
const {configFromEnv}=require('../../src/auth/config');
const {AuthError}=require('../../src/auth/errors');
test('HTTP login with email 2FA does not issue a session until the six-digit code is verified',async t=>{
 const config=configFromEnv({APP_ORIGIN:'http://localhost:3000',AUTH_EMAIL_2FA:'1',AUTH_OTP_SECRET:'x'.repeat(32)});
 const challenge=randomUUID(),token=randomBytes(32).toString('base64url'),user={id:'u',email:'user@example.invalid',displayName:'User'};
 const service={
  async login(){return{user,requiresTwoFactor:true,challengeId:challenge,expiresInSeconds:600};},
  async verifyTwoFactor(id,body){if(id!==challenge||body.code!=='123456')throw new AuthError(401,'Invalid or expired verification code.');return{user,token};},
  async resendTwoFactor(id){if(id!==challenge)throw new AuthError(401,'Verification required.');return{expiresInSeconds:600};},
  async currentUser(value){if(value!==token)throw new AuthError(401,'Authentication required.');return user;},
  async logout(){},
 };
 const server=createServer(service,config);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 const base='http://127.0.0.1:'+server.address().port,headers={Origin:config.origin,'Content-Type':'application/json'};
 let response=await fetch(base+'/api/auth/login',{method:'POST',headers,body:JSON.stringify({email:user.email,password:'synthetic'})});
 assert.equal(response.status,202);const challengeCookie=response.headers.get('set-cookie');assert.match(challengeCookie,/sentinelx_2fa=/);assert.doesNotMatch(challengeCookie,/sentinelx_session=/);
 response=await fetch(base+'/api/auth/me');assert.equal(response.status,401);
 response=await fetch(base+'/api/auth/verify-2fa',{method:'POST',headers:{...headers,Cookie:challengeCookie.split(';')[0]},body:JSON.stringify({code:'000000'})});
 assert.equal(response.status,401);assert.equal(response.headers.get('set-cookie'),null);
 response=await fetch(base+'/api/auth/verify-2fa',{method:'POST',headers:{...headers,Cookie:challengeCookie.split(';')[0]},body:JSON.stringify({code:'123456'})});
 assert.equal(response.status,200);const cookies=response.headers.get('set-cookie');assert.match(cookies,/sentinelx_session=/);assert.match(cookies,/sentinelx_2fa=;/);
});
