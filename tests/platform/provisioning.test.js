const test=require('node:test');
const assert=require('node:assert/strict');
const {provisioningConfig}=require('../../src/provisioning/config');
const {provisioningService,authorized}=require('../../src/provisioning/service');
const {providerClients}=require('../../src/provisioning/providers');
const {createProvisioningServer}=require('../../src/provisioning/server');
const config={token:'t'.repeat(32),otpKey:'o'.repeat(32),baseDomain:'example.com',ownerId:'tea-example',orgId:'org-example',repo:'https://github.com/example/sentinelx',neonKey:'neon-secret',renderKey:'render-secret',email:{url:'https://api.resend.com/emails',token:'email-secret',from:'no-reply@example.com'}};
const tenant={tenantId:'11111111-1111-4111-8111-111111111111',companyName:'Synthetic',slug:'synthetic',origin:null,admin:{name:'Admin',email:'admin@example.com',passwordHash:'scrypt$131072$8$1$'+'a'.repeat(32)+'$'+'b'.repeat(128)}};
const body={schemaVersion:1,type:'sentinelx.tenant.provision',tenant};
function fixture(){
 let job=null,ready=false;const calls=[];
 const repo={registration:{status:'VERIFIED',slug:tenant.slug,company_name:tenant.companyName,admin_email:tenant.admin.email,admin_name:tenant.admin.name,admin_password_hash:tenant.admin.passwordHash},async get(){return job;},async create(fingerprint){job={stage:'NEW',fingerprint};},async save(value){job={...value};}};
 const providers={async createProject(){calls.push('database');return{projectId:'project-id',branchId:'branch-id'};},async databaseUrl(){return 'postgresql://synthetic.invalid/neondb';},async createService(t,env){calls.push('service');assert.equal(env.APP_ORIGIN,'https://unconfigured.invalid');assert.equal(env.TENANT_ID,t.tenantId);assert.equal(env.TENANT_ADMIN_PASSWORD_HASH,undefined);assert.equal(env.RENDER_API_KEY,undefined);assert.equal(env.NEON_API_KEY,undefined);assert.equal(env.AUTH_EMAIL_2FA,'1');return{serviceId:'srv-example',renderUrl:'https://synthetic.onrender.com'};},async configureOrigin(){calls.push('origin');},async deploy(){calls.push('deploy');},async ready(){return ready;}};
 const service=provisioningService({withTenant:async(id,fn)=>fn(repo)},providers,async()=>calls.push('bootstrap'),config);
 return{service,repo,providers,calls,setReady(){ready=true;},job:()=>job};
}
test('provisioning persists stages, initializes DB before runtime and activates only after HTTPS readiness',async()=>{
 const f=fixture();for(let i=0;i<5;i++)assert.equal((await f.service.provision(body)).status,'PROVISIONING');
 assert.equal(f.job().stage,'WAITING_HTTPS');assert.deepEqual(f.calls,['database','bootstrap','service','origin','deploy']);
 f.setReady();assert.deepEqual(await f.service.provision(body),{origin:'https://synthetic.onrender.com'});
 assert.deepEqual(await f.service.provision(body),{origin:'https://synthetic.onrender.com'});assert.equal(f.calls.length,5);
 assert.equal(JSON.stringify(f.job()).includes('password'),false);
 await assert.rejects(()=>f.service.provision({...body,tenant:{...tenant,companyName:'Changed'}}),e=>e.status===403);
});
test('requested signup website is bound to verified provisioning identity, not caller-selected telemetry',async()=>{
 const {validTenant}=require('../../src/provisioning/service');
 const origin='https://www.acme.com',t={...tenant,websiteOrigin:origin};
 assert.equal(validTenant({...body,tenant:t},config).websiteOrigin,origin);
 for(const invalid of ['http://www.acme.com','https://127.0.0.1','https://www.acme.com/admin','https://www.acme.com?token=x']){
  assert.throws(()=>validTenant({...body,tenant:{...tenant,websiteOrigin:invalid}},config),{status:400});
 }
 const fixtureWithPendingSite=fixture();
 fixtureWithPendingSite.repo.registration.requested_website_origin=origin;
 await assert.rejects(()=>fixtureWithPendingSite.service.provision(body),{status:403});
 assert.equal((await fixtureWithPendingSite.service.provision({...body,tenant:t})).status,'PROVISIONING');
});
test('uncertain resource creation pauses for review and never automatically creates another resource',async()=>{
 const f=fixture();let attempts=0;f.providers.createProject=async()=>{attempts++;throw new Error('credential-containing provider error');};
 await assert.rejects(()=>f.service.provision(body),e=>e.status===503&&!e.message.includes('credential'));
 assert.equal(f.job().stage,'REVIEW_REQUIRED');
 await assert.rejects(()=>f.service.provision(body),e=>e.status===503);assert.equal(attempts,1);
});
test('unverified or changed tenant identities cannot create provider resources',async()=>{
 const f=fixture();f.repo.registration.status='PENDING_EMAIL';await assert.rejects(()=>f.service.provision(body),e=>e.status===403);
 await assert.rejects(()=>f.service.provision({...body,tenant:{...tenant,origin:'https://evil.example.com'}}),e=>e.status===400);
 assert.equal(f.calls.length,0);
});
test('provider requests pin ownership and free Render plan, isolate secrets and sanitize failures',async()=>{
 const requests=[];const fetcher=async(url,opts)=>{requests.push({url,opts});return{ok:true,status:201,json:async()=>url.includes('neon.tech')?{project:{id:'p'},branch:{id:'b'}}:{service:{id:'srv',serviceDetails:{url:'https://synthetic.onrender.com'}}}};};
 const clients=providerClients(config,fetcher);await clients.createProject(tenant);await clients.createService(tenant,{DATABASE_URL:'private-url'});
 const neon=JSON.parse(requests[0].opts.body),render=JSON.parse(requests[1].opts.body);
 assert.equal(neon.project.org_id,config.orgId);assert.equal(render.ownerId,config.ownerId);assert.equal(render.serviceDetails.plan,'free');assert.equal(render.serviceDetails.runtime,'docker');assert.equal(render.autoDeployTrigger,'off');
 assert.equal(requests[0].opts.redirect,'error');assert.equal(render.envVars[0].key,'DATABASE_URL');
 const failures=providerClients(config,async()=>({ok:false,status:403,json:async()=>({secret:'private'})}));
 await assert.rejects(()=>failures.createProject(tenant),e=>e.status===403&&!e.message.includes('private'));
 const wrong=providerClients(config,async()=>({ok:true,json:async()=>({status:'ok',tenantId:'other'})}));assert.equal(await wrong.ready('https://synthetic.onrender.com',tenant.tenantId),false);
 const stale=providerClients(config,async()=>({ok:true,json:async()=>({status:'ok',tenantId:tenant.tenantId,origin:'https://unconfigured.invalid'})}));assert.equal(await stale.ready('https://synthetic.onrender.com',tenant.tenantId),false);
 const healthy=providerClients(config,async()=>({ok:true,json:async()=>({status:'ok',tenantId:tenant.tenantId,origin:'https://synthetic.onrender.com'})}));assert.equal(await healthy.ready('https://synthetic.onrender.com',tenant.tenantId),true);
});
test('provisioner HTTP endpoint authenticates before parsing or invoking provider work',async t=>{
 let calls=0;const server=createProvisioningServer({async provision(){calls++;return{status:'PROVISIONING'};}},config);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 const url='http://127.0.0.1:'+server.address().port+'/provision';
 assert.equal((await fetch(url,{method:'POST',body:'bad'})).status,401);assert.equal(calls,0);
 const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal(response.status,202);assert.equal(response.headers.get('Retry-After'),'10');assert.equal(calls,1);
 assert.equal(authorized('Bearer short',config.token),false);
});
test('provisioner config requires ownership, secrets and valid host port',()=>{
 const env={TENANT_PROVISIONER_TOKEN:config.token,PROVISIONER_OTP_KEY:config.otpKey,RENDER_OWNER_ID:'tea-example',NEON_ORG_ID:'org-example',RENDER_API_KEY:'private',NEON_API_KEY:'private',PLATFORM_DATABASE_URL:'postgresql://private/db',TENANT_BASE_DOMAIN:'example.com',EMAIL_DELIVERY_URL:'https://api.resend.com/emails',EMAIL_DELIVERY_TOKEN:'e'.repeat(20),EMAIL_FROM:'no-reply@example.com',PORT:'10000'};
 assert.equal(provisioningConfig(env).port,10000);assert.throws(()=>provisioningConfig({...env,NEON_ORG_ID:'invalid'}));
});
test('platform accepts pending provisioning without activation and validates assigned HTTPS origin on completion',async()=>{
 const {platformService}=require('../../src/platform/service');const {digestCode}=require('../../src/auth/otp');
 const id='22222222-2222-4222-8222-222222222222',secret='p'.repeat(32),code='123456';let active=0,origin='https://synthetic.onrender.com',pending=true;
 const row={id,status:'VERIFIED',attempts:0,expires_at:new Date(Date.now()+600000),code_digest:digestCode(secret,'COMPANY_SIGNUP',id,code),tenant_id:tenant.tenantId,company_name:tenant.companyName,slug:tenant.slug,admin_email:tenant.admin.email,admin_name:tenant.admin.name,admin_password_hash:tenant.admin.passwordHash};
 const repository={registration:async()=>row,markVerified:async()=>row,activate:async()=>{active++;return{};}};
 const service=platformService(repository,{originMode:'render',otpSecret:secret,otpMaxAttempts:5},{},{provision:async input=>{assert.equal(input.origin,null);return pending?{status:'PROVISIONING'}:{origin};}});
 assert.equal((await service.verify({registrationId:id,code})).status,'PROVISIONING');assert.equal(active,0);
 pending=false;origin='https://attacker.example.com';await assert.rejects(()=>service.verify({registrationId:id,code}),e=>e.status===503);assert.equal(active,0);
 origin='https://synthetic.onrender.com';assert.equal((await service.verify({registrationId:id,code})).tenant.origin,origin);assert.equal(active,1);
});
test('database connection retrieval strips unsupported parameters and rejects non-Neon destinations',async()=>{
 const uri='postgresql://owner:synthetic-secret@ep-example.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
 const clients=providerClients(config,async()=>({ok:true,status:200,json:async()=>({uri})}));
 const url=await clients.databaseUrl({projectId:'p',branchId:'b'});assert.equal(new URL(url).search,'?sslmode=require');
 const invalid=providerClients(config,async()=>({ok:true,status:200,json:async()=>({uri:'postgresql://owner:private@localhost/neondb'})}));
 await assert.rejects(()=>invalid.databaseUrl({projectId:'p',branchId:'b'}),e=>!e.message.includes('private'));
});
test('enqueue acknowledges without waiting for provider creation and continues setup without browser step delays',async()=>{
 const f=fixture();let release;const wait=new Promise(resolve=>{release=resolve;});let started=false;
 const original=f.providers.createProject;f.providers.createProject=async t=>{started=true;await wait;return original(t);};
 const response=await f.service.enqueue(body);assert.equal(response.status,'PROVISIONING');assert.equal(response.stage,'NEW');assert.equal(started,false);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(started,true);
 assert.equal((await f.service.enqueue(body)).status,'PROVISIONING');assert.equal(f.calls.length,0);
 release();
 for(let i=0;i<20&&f.job().stage!=='WAITING_HTTPS';i++)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.job().stage,'WAITING_HTTPS');assert.deepEqual(f.calls,['database','bootstrap','service','origin','deploy']);
 f.setReady();assert.equal((await f.service.enqueue(body)).status,'PROVISIONING');
 for(let i=0;i<20&&f.job().stage!=='READY';i++)await new Promise(resolve=>setImmediate(resolve));
 assert.equal((await f.service.enqueue(body)).origin,'https://synthetic.onrender.com');assert.equal(f.calls.length,5);
});
test('new process resumes safe persisted checkpoints without recreating company resources',async()=>{
 const f=fixture();await f.service.provision(body);assert.equal(f.job().stage,'DATABASE_CREATED');
 await f.service.enqueue(body);
 for(let i=0;i<20&&f.job().stage!=='WAITING_HTTPS';i++)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.calls.filter(x=>x==='database').length,1);assert.equal(f.job().stage,'WAITING_HTTPS');
});
test('progress checks have a separate bounded budget and do not consume signup login attempts',async t=>{
 const {createPlatformServer}=require('../../src/platform/server');const {loginLimiter}=require('../../src/auth/rate-limit');let now=0;
 const cfg={origin:'http://placeholder.invalid'};
 const server=createPlatformServer({async verify(){return{status:'PROVISIONING'};},async signup(){return{registrationId:'synthetic'};}},cfg,{limiter:loginLimiter({now:()=>now}),verificationLimiter:loginLimiter({now:()=>now,windowMs:60000})});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 const origin='http://127.0.0.1:'+server.address().port;cfg.origin=origin;
 for(let i=0;i<30;i++){now=i*10000;const r=await fetch(origin+'/api/company-signup/verify',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({registrationId:'synthetic',code:'123456'})});assert.equal(r.status,202);}
 const r=await fetch(origin+'/api/company-signup',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});assert.equal(r.status,201);
});
