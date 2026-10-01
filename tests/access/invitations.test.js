const test=require('node:test');
const assert=require('node:assert/strict');
const {accessService}=require('../../src/access/service');
test('only a company Administrator can create an email invitation with an approved initial role',async()=>{
 const actor={id:'11111111-1111-4111-8111-111111111111',email:'admin@example.invalid',displayName:'Admin'};
 let roles=['Administrator'],created=null,sent=null;
 const authentication={async currentUser(){return actor;}};
 const repository={
  async rolesForUser(){return roles;},
  async createInvitation(id,input){created={actorId:id,...input};return{id:input.id,email:input.email,displayName:input.displayName,role:input.role,status:'PENDING_ACTIVATION'};},
  async cancelInvitation(){},
 };
 const mailer={async sendCode(message){sent=message;}};
 const service=accessService(repository,authentication,{tenant:{name:'Acme'},mailer,otpSecret:'x'.repeat(32),otpSeconds:600});
 const invitation=await service.inviteUser('token',{email:' analyst@acme.example ',displayName:' Analyst ',role:'Security Analyst',reason:'SOC access'});
 assert.equal(invitation.role,'Security Analyst');assert.equal(created.actorId,actor.id);assert.match(sent.code,/^\d{6}$/);assert.equal(sent.to,'analyst@acme.example');
 roles=['Security Analyst'];await assert.rejects(service.inviteUser('token',{email:'other@acme.example',displayName:'Other',role:'Viewer/Management',reason:'Read access'}),{status:403});
});
