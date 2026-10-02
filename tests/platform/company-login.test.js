'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {companyKey,safeOrigin,legacyRoutesFromEnv,resolveCompany}=require('../../src/platform/directory');
const {createPlatformServer}=require('../../src/platform/server');
const {platformRepository}=require('../../src/platform/repository');
const CONFIG={baseDomain:'example.com',legacyRoutes:[]};
test('company locator validates an exact company-only object and HTTPS route',()=>{
 assert.equal(companyKey({company:' Iphyn Network '}),'iphyn network');
 for(const body of [{},{company:''},{company:'a'},{company:'a'.repeat(121)},{company:'ok',password:'secret'},{company:23},{company:'a\ncode'}])
  assert.throws(()=>companyKey(body),{status:400});
 assert.equal(safeOrigin('https://sentinelx-iphyn-network.onrender.com','iphyn-network',CONFIG),
 'https://sentinelx-iphyn-network.onrender.com');
 for(const url of ['http://iphyn.onrender.com','https://iphyn.onrender.com.evil.test',
 'https://evil.test','https://evil.test@iphyn.onrender.com','https://iphyn.onrender.com/path',
 'https://iphyn.onrender.com?next=evil','https://iphyn.onrender.com:444']){
  assert.equal(safeOrigin(url,'iphyn-network',CONFIG),null,url);
 }
 assert.equal(safeOrigin('https://my-company.example.com','my-company',CONFIG),'https://my-company.example.com');
});
test('operator legacy routes are bounded, validated and cannot include account secrets',()=>{
 const env={COMPANY_LOGIN_LEGACY_ROUTES:JSON.stringify([{companyName:'Iphyn Network',slug:'iphyn-network',
   origin:'https://sentinelx-iphyn-network.onrender.com'}])};
 const routes=legacyRoutesFromEnv(env,'');
 assert.equal(routes.length,1);assert.equal(routes[0].company_name,'Iphyn Network');
 for(const bad of ['not-json',JSON.stringify([{companyName:'Test',slug:'test',origin:'https://evil.test'}]),
 JSON.stringify([{companyName:'Test',slug:'test',origin:'https://test.onrender.com',password:'secret'}]),
 JSON.stringify(Array.from({length:9},(_,i)=>({companyName:'Test '+i,slug:'test-'+i,origin:'https://test.onrender.com'})))])
 assert.throws(()=>legacyRoutesFromEnv({COMPANY_LOGIN_LEGACY_ROUTES:bad},''));
});
test('existing active tenant and invited staff resolve by company without global password directory',async()=>{
 const rows=[{company_name:'Registered Company',slug:'registered-1234',origin:'https://registered-company.onrender.com'}];
 const repo={async findActiveCompanies(key){return rows.filter(r=>r.slug===key||r.company_name.toLowerCase()===key);}};
 assert.deepEqual(await resolveCompany(repo,CONFIG,{company:'registered company'}),{companyName:'Registered Company',
 origin:'https://registered-company.onrender.com'});
 assert.deepEqual(await resolveCompany(repo,CONFIG,{company:'registered-1234'}),{companyName:'Registered Company',
 origin:'https://registered-company.onrender.com'});
 await assert.rejects(()=>resolveCompany(repo,CONFIG,{company:'unknown company'}),{status:404});
});
test('ambiguous company name fails closed and exact code disambiguates; inactive companies are not returned',async()=>{
 const routes=[{company_name:'Same Co',slug:'same-one',origin:'https://same-one.onrender.com'},
  {company_name:'Same Co',slug:'same-two',origin:'https://same-two.onrender.com'}];
 const repo={async findActiveCompanies(k){return routes.filter(x=>x.company_name.toLowerCase()===k||x.slug===k);}};
 await assert.rejects(()=>resolveCompany(repo,CONFIG,{company:'same co'}),{status:404});
 assert.equal((await resolveCompany(repo,CONFIG,{company:'same-one'})).origin,'https://same-one.onrender.com');
 const inactiveRepo={async findActiveCompanies(){return[];}};
 await assert.rejects(()=>resolveCompany(inactiveRepo,CONFIG,{company:'pending company'}),{status:404});
});
test('legacy Iphyn route remains usable when its tenant predates self-service onboarding',async()=>{
 const legacyRoutes=legacyRoutesFromEnv({COMPANY_LOGIN_LEGACY_ROUTES:JSON.stringify([
 {companyName:'Iphyn Network',slug:'iphyn-network',origin:'https://sentinelx-iphyn-network.onrender.com'}
 ])});
 const repo={async findActiveCompanies(){return[];}};
 assert.equal((await resolveCompany(repo,{...CONFIG,legacyRoutes},{company:'Iphyn Network'})).origin,
 'https://sentinelx-iphyn-network.onrender.com');
});
test('platform SQL selects only ACTIVE company-origin metadata, not tenant credentials',async()=>{
 let statement='',params;
 const repo=platformRepository({async query(sql,args){statement=sql;params=args;return{rows:[]};}});
 assert.deepEqual(await repo.findActiveCompanies('my company'),[]);
 assert.match(statement,/status='ACTIVE'/);assert.match(statement,/SELECT company_name,slug,origin/);
 assert.doesNotMatch(statement,/password_hash|auth_sessions|user_roles/);
 assert.deepEqual(params,['my company']);
});
test('company locator page and API require exact origin; signup endpoint remains independent',async t=>{
 const cfg={origin:'http://placeholder.invalid'};
 let resolved=0;
 const server=createPlatformServer({
  async resolveCompany(body){resolved++;return{companyName:body.company,origin:'https://company.onrender.com'};},
  async signup(){return{registrationId:'synthetic'};}
 },cfg);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 const base='http://127.0.0.1:'+server.address().port;cfg.origin=base;
 const page=await fetch(base+'/');assert.equal(page.status,200);assert.match(await page.text(),/Find your company/);
 const js=await fetch(base+'/login/login.js');assert.equal(js.status,200);assert.match(await js.text(),/api\/company-login\/resolve/);
 const missing=await fetch(base+'/api/company-login/resolve',{method:'GET'});assert.equal(missing.status,405);
 const forbidden=await fetch(base+'/api/company-login/resolve',{method:'POST',headers:{Origin:'https://evil.test','Content-Type':'application/json'},body:'{}'});
 assert.equal(forbidden.status,403);assert.equal(resolved,0);
 const route=await fetch(base+'/api/company-login/resolve',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},
 body:JSON.stringify({company:'Company'})});
 assert.equal(route.status,200);assert.deepEqual(await route.json(),{companyName:'Company',origin:'https://company.onrender.com'});
 assert.equal(route.headers.get('cache-control'),'no-store');assert.equal(route.headers.get('access-control-allow-origin'),null);
 assert.equal(resolved,1);
 const signup=await fetch(base+'/api/company-signup',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'{}'});
 assert.equal(signup.status,201);
});
