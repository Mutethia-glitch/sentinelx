'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {REQUIREMENTS,integrationCoverage}=require('../../src/integrations/coverage');
const {CATEGORY_CODES}=require('../../src/threats/taxonomy');
const {AuthError}=require('../../src/auth/errors');
const {accessService}=require('../../src/access/service');
const tenantId='89238480-9405-49b1-abeb-34bb851612ab';
const config={tenant:{id:tenantId},selfMonitorEnabled:true};
const website={async list(){return{sites:[
 {status:'REPORTING',origin:'https://iphyn.vercel.app'},
 {status:'REVOKED',origin:'https://disabled.example.com'}]};}};
test('coverage manifest enumerates every taxonomy category using the actual issuer-bound contracts',()=>{
 assert.deepEqual(REQUIREMENTS.map(x=>x.categoryCode),CATEGORY_CODES);
 assert.ok(REQUIREMENTS.every(x=>x.signals.length&&x.providers.length&&x.issuers.length));
 const byCode=new Map(REQUIREMENTS.map(x=>[x.categoryCode,x]));
 assert.ok(byCode.get('WEB_APPLICATION_ATTACK').signals.includes('app_sqli_blocked'));
 assert.deepEqual(byCode.get('MALWARE').issuers,['endpoint']);
 assert.deepEqual(byCode.get('SUPPLY_CHAIN_COMPROMISE').issuers,['ci']);
});
test('tenant-local source readiness never turns provider configuration into live acceptance',async()=>{
 let sql,values;
 const pool={async query(query,args){
  sql=query;values=args;
  return{rows:[{category_code:'RECONNAISSANCE',total:1,latest:new Date('2026-10-02T12:19:30.510Z')}]};
 }};
 const feeds=[{issuer:'identity',name:'approved-idp',digest:Buffer.alloc(32)}];
 const result=await integrationCoverage(pool,website,feeds,config).list();
 assert.equal(result.categories.length,15);
 assert.equal(values[0],tenantId);
 assert.deepEqual(values[1],CATEGORY_CODES);
 assert.match(sql,/sourceContract/);
 assert.match(sql,/tenantId/);
 assert.doesNotMatch(JSON.stringify(result),/digest|token|secret|approved-idp/);
 const get=code=>result.categories.find(x=>x.categoryCode===code);
 assert.equal(get('RECONNAISSANCE').observedEventCount,1);
 assert.equal(get('RECONNAISSANCE').state,'EVIDENCE_OBSERVED_NOT_LIVE_ACCEPTED');
 assert.equal(get('BRUTE_FORCE').eligibleSources,2,'site + self-monitor eligible but no evidence implied');
 assert.equal(get('BRUTE_FORCE').state,'SOURCE_CONFIGURED_CATEGORY_UNVERIFIED');
 assert.equal(get('CREDENTIAL_ATTACK').eligibleSources,1);
 assert.equal(get('CREDENTIAL_ATTACK').state,'SOURCE_CONFIGURED_CATEGORY_UNVERIFIED');
 assert.equal(get('MALWARE').state,'SOURCE_REQUIRED');
 assert.equal(get('SUPPLY_CHAIN_COMPROMISE').state,'SOURCE_REQUIRED');
 assert.equal(get('MALWARE').observedEventCount,0);
 assert.equal(get('RECONNAISSANCE').lastObservedAt,'2026-10-02T12:19:30.510Z');
});
test('readiness service requires live users.manage, not merely a forged front-end role',async()=>{
 let called=0;
 const auth={async currentUser(token){if(token==='invalid')throw new AuthError(401,'Authentication required.');return{id:'user-1'};}};
 let names=['Viewer/Management'];
 const roles={async rolesForUser(){return names;}};
 const coverage={async list(){called++;return{categories:[]};}};
 const service=accessService(roles,auth,{integrationCoverage:coverage});
 await assert.rejects(()=>service.integrationReadiness('valid'),{status:403});
 assert.equal(called,0);
 names=['Administrator'];
 assert.deepEqual(await service.integrationReadiness('valid'),{categories:[]});
 assert.equal(called,1);
 await assert.rejects(()=>service.integrationReadiness('invalid'),{status:401});
 assert.equal(called,1);
});
