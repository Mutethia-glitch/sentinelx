'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createServer}=require('../../src/api/server');
const {configFromEnv}=require('../../src/auth/config');
const {accessService}=require('../../src/access/service');
const {AuthError}=require('../../src/auth/errors');

const COMPANY_A={
  id:'11111111-1111-4111-8111-111111111111',
  name:'Test Company A',slug:'test-company-a'
};
const COMPANY_B={
  id:'22222222-2222-4222-8222-222222222222',
  name:'Test Company B',slug:'test-company-b'
};
const USER_A={id:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',email:'administrator@company-a.invalid',displayName:'Company A Administrator'};
const USER_B={id:'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',email:'viewer@company-b.invalid',displayName:'Company B Viewer'};
const TOKEN_A='a'.repeat(43),TOKEN_B='b'.repeat(43);

async function tenantFixture(t,tenant,user,token,roles){
  let attemptedChanges=0;
  const auth={
    async currentUser(candidate){
      if(candidate!==token)throw new AuthError(401,'Authentication required.');
      return user;
    }
  };
  const repo={
    async rolesForUser(userId){
      assert.equal(userId,user.id,'Only the local company repository is consulted.');
      return [...roles];
    },
    async listUsers(){return [{id:user.id,email:user.email,displayName:user.displayName,active:true,roles:[...roles]}];},
    async setRoles(actorId,targetId){
      attemptedChanges++;
      assert.equal(actorId,user.id);
      assert.equal(targetId,user.id);
      return{userId:targetId,roles:[...roles],changed:false};
    }
  };
  const config=configFromEnv({APP_ORIGIN:'http://localhost:3000'});
  const server=createServer(auth,config,accessService(repo,auth,{tenant}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  return{
    origin:'http://127.0.0.1:'+server.address().port,
    cookie:'sentinelx_session='+token,
    get mutations(){return attemptedChanges;}
  };
}
function request(fixture,path,cookie,extra={}){
  return fetch(fixture.origin+path,{
    redirect:'manual',
    headers:{...(cookie?{Cookie:cookie}:{}),...extra}
  });
}
test('two independent tenant HTTP handlers do not accept each other\'s credentials or roles',async t=>{
 const a=await tenantFixture(t,COMPANY_A,USER_A,TOKEN_A,['Administrator']);
 const b=await tenantFixture(t,COMPANY_B,USER_B,TOKEN_B,['Viewer/Management']);
 for(const [own,credential,expected,foreign] of [[a,a.cookie,USER_A,b.cookie],[b,b.cookie,USER_B,a.cookie]]){
   const good=await request(own,'/api/access/me',credential);
   assert.equal(good.status,200);
   const data=await good.json();
   assert.equal(data.user.id,expected.id);
   assert.equal(data.tenant.id,own===a?COMPANY_A.id:COMPANY_B.id);
   assert.equal((await request(own,'/api/access/me',foreign)).status,401);
   assert.equal((await request(own,'/api/access/me',null)).status,401);
 }
 const usersA=await request(a,'/api/access/users',a.cookie);
 assert.equal(usersA.status,200);
 const records=(await usersA.json()).users;
 assert.equal(records.length,1);
 assert.equal(records[0].id,USER_A.id);
 assert.equal(records.some(u=>u.id===USER_B.id),false);
 assert.equal((await request(b,'/api/access/users',b.cookie,{'X-Role':'Administrator'})).status,403);
 assert.equal((await request(b,'/api/access/users',a.cookie,{'X-Role':'Administrator'})).status,401);
 assert.equal((await request(a,'/api/access/users',b.cookie,{'X-Role':'Administrator'})).status,401);
 assert.equal(a.mutations,0);
 assert.equal(b.mutations,0);
});

test('cross-company and insufficient-role mutations are denied before reaching tenant repository',async t=>{
 const a=await tenantFixture(t,COMPANY_A,USER_A,TOKEN_A,['Administrator']);
 const b=await tenantFixture(t,COMPANY_B,USER_B,TOKEN_B,['Viewer/Management']);
 const mutate=async (fixture,cookie,id)=>fetch(fixture.origin+'/api/access/users/'+id+'/roles',{
   method:'PUT',
   headers:{Cookie:cookie,Origin:'http://localhost:3000','Content-Type':'application/json','X-Role':'Administrator'},
   body:JSON.stringify({roles:['Administrator'],reason:'Task 41 cross-tenant regression'})
 });
 assert.equal((await mutate(a,b.cookie,USER_A.id)).status,401);
 assert.equal((await mutate(b,a.cookie,USER_B.id)).status,401);
 assert.equal((await mutate(b,b.cookie,USER_B.id)).status,403);
 assert.equal(a.mutations,0);
 assert.equal(b.mutations,0);
 // The local company Administrator may still use its own authorized operation.
 assert.equal((await mutate(a,a.cookie,USER_A.id)).status,200);
 assert.equal(a.mutations,1);
 assert.equal(b.mutations,0);
});
