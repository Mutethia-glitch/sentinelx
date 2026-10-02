'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {createPool}=require('../../src/data/pool');
const {executeSql}=require('../../src/data/postgres');
const {migrationSql}=require('../../scripts/migrate');
const {authRepository}=require('../../src/data/auth-repository');
const {accessRepository}=require('../../src/data/access-repository');
const {authService}=require('../../src/auth/service');
const {hashPassword}=require('../../src/auth/passwords');
const {configFromEnv}=require('../../src/auth/config');
const {accessService}=require('../../src/access/service');
const {createServer}=require('../../src/api/server');
const ADDRESS='shared-member@example.invalid';
const COMPANIES=[
 {id:'11111111-1111-4111-8111-111111111111',name:'Isolated CI Company A',slug:'isolated-ci-a',role:'Administrator',password:'Company A synthetic password only!'},
 {id:'22222222-2222-4222-8222-222222222222',name:'Isolated CI Company B',slug:'isolated-ci-b',role:'Viewer/Management',password:'Company B synthetic password only!'}
];
async function fixture(t,details,databaseUrl){
 executeSql(migrationSql(),{...process.env,DATABASE_URL:databaseUrl});
 const pool=createPool({DATABASE_URL:databaseUrl});
 t.after(()=>pool.end());
 await pool.query('INSERT INTO tenant_profile(singleton,tenant_id,company_name,slug) VALUES(true,$1,$2,$3)',
   [details.id,details.name,details.slug]);
 const userId=await authRepository(pool).createUser(ADDRESS,'Shared mailbox with tenant-local identity',
   await hashPassword(details.password),'Disposable Task 41 cross-database test');
 const roleId=(await pool.query('SELECT id FROM roles WHERE name=$1',[details.role])).rows[0].id;
 await pool.query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)',[userId,roleId]);
 const sent=[];
 const mailer={async sendCode(item){sent.push(item);}};
 const config=configFromEnv({
   APP_ORIGIN:'http://localhost:3000',
   AUTH_EMAIL_2FA:'1',AUTH_OTP_SECRET:details.id.replace(/-/g,'')+'test-secret',
   TENANT_ID:details.id,TENANT_NAME:details.name,TENANT_SLUG:details.slug
 });
 const authentication=authService(authRepository(pool),config,mailer);
 const access=accessService(accessRepository(pool),authentication,{tenant:config.tenant});
 const server=createServer(authentication,config,access);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 return{
   origin:'http://127.0.0.1:'+server.address().port,config,authentication,sent,userId,pool,details,
   getCookie(token){return config.cookieName+'='+token;}
 };
}
async function verifiedSession(company){
 const login=await company.authentication.login({email:ADDRESS,password:company.details.password});
 assert.equal(login.requiresTwoFactor,true);
 assert.equal(login.token,undefined);
 assert.equal(company.sent.length,1);
 assert.match(company.sent[0].code,/^\d{6}$/);
 const response=await company.authentication.verifyTwoFactor(login.challengeId,{code:company.sent[0].code});
 assert.equal(response.user.id,company.userId);
 return company.getCookie(response.token);
}
function api(company,path,cookie,headers={}){
 return fetch(company.origin+path,{method:'GET',redirect:'manual',
   headers:{...(cookie?{Cookie:cookie}:{}),...headers}});
}
test('two separate migrated company databases cannot share identities, password, sessions or user lists',async t=>{
 assert.equal(process.env.SENTINELX_TEST_DATABASE,'1','Run only on dedicated disposable PostgreSQL databases.');
 const primary=process.env.DATABASE_URL,secondary=process.env.SECOND_TENANT_DATABASE_URL;
 assert.match(primary||'',/^postgres(?:ql)?:\/\//);
 assert.match(secondary||'',/^postgres(?:ql)?:\/\//);
 assert.notEqual(primary,secondary,'Two distinct disposable database URLs are required.');
 const a=await fixture(t,COMPANIES[0],primary);
 const b=await fixture(t,COMPANIES[1],secondary);
 const profilesA=(await a.pool.query('SELECT tenant_id,company_name FROM tenant_profile')).rows;
 const profilesB=(await b.pool.query('SELECT tenant_id,company_name FROM tenant_profile')).rows;
 assert.equal(profilesA.length,1);assert.equal(profilesB.length,1);
 assert.equal(profilesA[0].tenant_id,COMPANIES[0].id);
 assert.equal(profilesB[0].tenant_id,COMPANIES[1].id);
 assert.notEqual(a.userId,b.userId);
 await assert.rejects(a.authentication.login({email:ADDRESS,password:COMPANIES[1].password}),{status:401});
 await assert.rejects(b.authentication.login({email:ADDRESS,password:COMPANIES[0].password}),{status:401});
 const [cookieA,cookieB]=[await verifiedSession(a),await verifiedSession(b)];
 const ownA=await api(a,'/api/access/me',cookieA);
 const ownB=await api(b,'/api/access/me',cookieB);
 assert.equal(ownA.status,200);assert.equal(ownB.status,200);
 const [bodyA,bodyB]=[await ownA.json(),await ownB.json()];
 assert.equal(bodyA.user.id,a.userId);assert.equal(bodyB.user.id,b.userId);
 assert.equal(bodyA.tenant.id,COMPANIES[0].id);assert.equal(bodyB.tenant.id,COMPANIES[1].id);
 assert.deepEqual(bodyA.roles,['Administrator']);
 assert.deepEqual(bodyB.roles,['Viewer/Management']);
 assert.equal((await api(a,'/api/access/me',cookieB)).status,401);
 assert.equal((await api(b,'/api/access/me',cookieA)).status,401);
 const listA=await api(a,'/api/access/users',cookieA);
 assert.equal(listA.status,200);
 const users=(await listA.json()).users;
 assert.equal(users.length,1);
 assert.equal(users[0].id,a.userId);
 assert.equal(users.some(row=>row.id===b.userId),false);
 assert.equal((await api(b,'/api/access/users',cookieB,{'X-Role':'Administrator'})).status,403);
 assert.equal((await api(b,'/api/access/users',cookieA,{'X-Role':'Administrator'})).status,401);
 // The control plane has neither tenant connection; no production account is touched.
});
