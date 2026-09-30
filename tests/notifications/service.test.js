const test=require('node:test');
const assert=require('node:assert/strict');
const {notificationService}=require('../../src/notifications/service');
const ID='11111111-1111-4111-8111-111111111111';
const body={recipientId:ID,incidentId:ID,alertId:null,reason:'Review required'};
test('Viewer has a private inbox but cannot dispatch; analysts can dispatch',async()=>{
 let sender=null,reader=null,marked=null;
 const repository={
  list:async(id,filters)=>{reader=id;return {notifications:[],...filters};},
  send:async(id,input)=>{sender=id;return{delivered:true,...input};},
  markRead:async(id,target)=>{marked=[id,target];return{changed:true};}
 };
 const access={me:async role=>({user:{id:ID},roles:[role]})};
 const service=notificationService(repository,access);
 assert.equal((await service.list('Viewer/Management',new URLSearchParams())).page,1);
 assert.equal(reader,ID);
 await assert.rejects(service.send('Viewer/Management',body),{status:403});
 assert.equal((await service.send('Security Analyst',body)).delivered,true);
 assert.equal(sender,ID);
 assert.equal((await service.markRead('Viewer/Management',ID,{})).changed,true);
 assert.deepEqual(marked,[ID,ID]);
 await assert.rejects(service.markRead('Viewer/Management',ID,{x:1}),{status:400});
});
