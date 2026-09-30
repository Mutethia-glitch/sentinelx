const test=require('node:test');
const assert=require('node:assert/strict');
const {dashboardService}=require('../../src/dashboard/service');
test('existing dashboard.read permission admits approved roles and rejects others',async()=>{
 let calls=0;
 const repository={snapshot:async()=>{calls++;return{asOf:'live'};}};
 const access={me:async token=>({roles:[token],user:{id:'synthetic'}})};
 const service=dashboardService(repository,access);
 for(const role of ['Administrator','Security Analyst','Viewer/Management']){
  assert.equal((await service.snapshot(role)).asOf,'live');
 }
 assert.equal(calls,3);
 await assert.rejects(service.snapshot('Unknown'),{status:403});
 assert.equal(calls,3);
});
