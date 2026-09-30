'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createServer}=require('../../src/api/server');
const {configFromEnv}=require('../../src/auth/config');
const {AuthError}=require('../../src/auth/errors');
const {accessService}=require('../../src/access/service');
const {sessionCookie}=require('../../src/api/auth-handler');
const {loginLimiter}=require('../../src/auth/rate-limit');

const token='A'.repeat(43);
const user={id:'11111111-1111-4111-8111-111111111111',email:'security@example.invalid',displayName:'Synthetic Security Tester'};

async function harness(t){
  const config=configFromEnv({APP_ORIGIN:'http://localhost:3000'});
  let brokenLogin=false;
  let roles=['Viewer/Management'];
  let mutations=0;
  const auth={
    async login(){if(brokenLogin)throw new Error('postgres://private:secret@internal.invalid/sentinelx SELECT token_hash');return{user,token};},
    async currentUser(value){if(value!==token)throw new AuthError(401,'Authentication required.');return user;},
    async logout(value){if(value!==token)throw new AuthError(401,'Authentication required.');},
  };
  const repository={
    async rolesForUser(){return roles;},
    async listUsers(){return [user];},
    async setRoles(actorId,userId,names,reason){mutations++;return{userId,roles:names,changed:true,actorId,reason};},
  };
  const access=accessService(repository,auth);
  const server=createServer(auth,config,access);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  return{
    base,config,
    cookie:'sentinelx_session='+token,
    setBroken(value){brokenLogin=value;},
    setRoles(value){roles=value;},
    mutations(){return mutations;}
  };
}

function loginOptions(config,body={email:user.email,password:'synthetic password only'},headers={}){
  return{method:'POST',headers:{Origin:config.origin,'Content-Type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)};
}

test('security validation: session token stays in strict HttpOnly cookie transport',async t=>{
  const h=await harness(t);
  const response=await fetch(h.base+'/api/auth/login',loginOptions(h.config));
  assert.equal(response.status,200);
  const setCookie=response.headers.get('set-cookie');
  assert.match(setCookie,/sentinelx_session=/);
  assert.match(setCookie,/Path=\//);
  assert.match(setCookie,/HttpOnly/);
  assert.match(setCookie,/SameSite=Strict/);
  assert.equal(setCookie.includes('Secure'),false,'local HTTP development cookie is intentionally not Secure');
  assert.deepEqual(await response.json(),{user});
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  assert.equal(response.headers.get('referrer-policy'),'no-referrer');
  assert.equal(response.headers.get('cross-origin-resource-policy'),'same-origin');
  assert.equal(response.headers.get('access-control-allow-origin'),null);

  const production=sessionCookie(token,{cookieName:'__Host-sentinelx_session',sessionSeconds:3600,secureCookie:true});
  assert.match(production,/__Host-sentinelx_session=/);
  assert.match(production,/Secure/);
  assert.match(production,/HttpOnly/);
  assert.match(production,/SameSite=Strict/);

  assert.equal((await fetch(h.base+'/api/auth/me',{headers:{Cookie:h.cookie}})).status,200);
  assert.equal((await fetch(h.base+'/api/auth/me?token='+token)).status,404);
  assert.equal((await fetch(h.base+'/api/auth/me',{headers:{Authorization:'Bearer '+token}})).status,401);
  assert.equal((await fetch(h.base+'/api/auth/me',{headers:{Cookie:h.cookie+'; '+h.cookie}})).status,401);
});

test('security validation: mutation origin, content type, schema and body bounds fail closed',async t=>{
  const h=await harness(t);
  for(const origin of [undefined,'null','https://attacker.invalid']){
    const headers={'Content-Type':'application/json'};
    if(origin!==undefined)headers.Origin=origin;
    const response=await fetch(h.base+'/api/auth/login',{method:'POST',headers,body:JSON.stringify({email:user.email,password:'synthetic password only'})});
    assert.equal(response.status,403);
  }

  assert.equal((await fetch(h.base+'/api/auth/login',loginOptions(h.config,'{'))).status,400);
  assert.equal((await fetch(h.base+'/api/auth/login',loginOptions(h.config,[]))).status,400);
  assert.equal((await fetch(h.base+'/api/auth/login',loginOptions(h.config,{email:user.email,password:'synthetic password only',role:'Administrator'}))).status,400);
  assert.equal((await fetch(h.base+'/api/auth/login',loginOptions(h.config,{email:user.email,password:'synthetic password only'},{'Content-Type':'text/plain'}))).status,415);
  assert.equal((await fetch(h.base+'/api/auth/login',loginOptions(h.config,{email:user.email,password:'synthetic password only'},{'Content-Encoding':'gzip'}))).status,415);
  assert.equal((await fetch(h.base+'/api/auth/login',loginOptions(h.config,'x'.repeat(9000)))).status,413);
  assert.equal((await fetch(h.base+'/api/auth/login')).status,405);
});

test('security validation: forged client role state cannot bypass backend RBAC or CSRF checks',async t=>{
  const h=await harness(t);
  const authHeaders={Cookie:h.cookie,'X-Role':'Administrator'};
  assert.equal((await fetch(h.base+'/api/access/users',{headers:authHeaders})).status,403);
  assert.equal((await fetch(h.base+'/api/access/roles',{headers:authHeaders})).status,403);

  const target=user.id;
  const update={
    method:'PUT',
    headers:{...authHeaders,Origin:h.config.origin,'Content-Type':'application/json'},
    body:JSON.stringify({roles:['Administrator'],reason:'Synthetic Task 39 authorization test'})
  };
  assert.equal((await fetch(h.base+'/api/access/users/'+target+'/roles',update)).status,403);
  assert.equal(h.mutations(),0);

  h.setRoles(['Administrator']);
  const crossOrigin={...update,headers:{...update.headers,Origin:'https://attacker.invalid'}};
  assert.equal((await fetch(h.base+'/api/access/users/'+target+'/roles',crossOrigin)).status,403);
  assert.equal(h.mutations(),0);

  assert.equal((await fetch(h.base+'/api/access/users/'+target+'/roles',update)).status,200);
  assert.equal(h.mutations(),1);
});

test('security validation: page surfaces resist clickjacking, unsafe loading and path probing',async t=>{
  const h=await harness(t);
  for(const path of ['/access','/dashboard','/events','/alerts','/incidents','/notifications','/audit']){
    const response=await fetch(h.base+path);
    assert.equal(response.status,200,path);
    assert.equal(response.headers.get('cache-control'),'no-store');
    assert.equal(response.headers.get('x-content-type-options'),'nosniff');
    assert.equal(response.headers.get('referrer-policy'),'no-referrer');
    const csp=response.headers.get('content-security-policy')||'';
    assert.match(csp,/default-src 'self'/);
    assert.match(csp,/script-src 'self'/);
    assert.match(csp,/object-src 'none'/);
    assert.match(csp,/base-uri 'none'/);
    assert.match(csp,/frame-ancestors 'none'/);
    assert.match(csp,/form-action 'none'/);
    assert.equal(response.headers.get('access-control-allow-origin'),null);
  }

  for(const path of ['/.env','/access/.env','/access/%2e%2e/.env','/ui/%2e%2e/.env','/package.json']){
    const response=await fetch(h.base+path);
    assert.equal(response.status,404,path);
    const body=await response.text();
    assert.doesNotMatch(body,/PGPASSWORD|DATABASE_URL|private:secret/i);
  }

  assert.equal((await fetch(h.base+'/access',{method:'POST'})).status,405);
  assert.equal((await fetch(h.base+'/ui/sentinelx-ui.js',{method:'POST'})).status,405);
});

test('security validation: rate limits and unexpected failures remain bounded and sanitized',async t=>{
  let time=0;
  const limiter=loginLimiter({now:()=>time,windowMs:1000,maxKeys:100});
  for(let i=0;i<10;i++)limiter.account('victim@example.invalid');
  assert.throws(()=>limiter.account('victim@example.invalid'),error=>error.status===429);
  for(let i=0;i<20;i++)limiter.ip('127.0.0.9');
  assert.throws(()=>limiter.ip('127.0.0.9'),error=>error.status===429);
  time=1001;
  assert.doesNotThrow(()=>limiter.account('victim@example.invalid'));
  assert.doesNotThrow(()=>limiter.ip('127.0.0.9'));

  const h=await harness(t);
  h.setBroken(true);
  const response=await fetch(h.base+'/api/auth/login',loginOptions(h.config));
  assert.equal(response.status,503);
  const body=await response.text();
  assert.match(body,/Authentication temporarily unavailable/);
  assert.doesNotMatch(body,/postgres|private|secret|SELECT|token_hash/i);
});
