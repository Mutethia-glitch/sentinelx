const test=require('node:test');
const assert=require('node:assert/strict');
const {incidentService}=require('../../src/incidents/service');
const ID='11111111-1111-4111-8111-111111111111';
test('all approved roles can read but only incident managers can mutate',async()=>{const access={me:async token=>({user:{id:ID},roles:[token]})};const repo={list:async q=>({incidents:[],page:q.page}),get:async()=>({id:ID}),create:async()=>({id:ID}),updateAssignment:async()=>({id:ID}),updateStatus:async()=>({id:ID,status:'INVESTIGATING'})};const s=incidentService(repo,access);for(const r of ['Administrator','Security Analyst','Viewer/Management'])assert.equal((await s.inspect(r,ID)).id,ID);await assert.rejects(s.create('Viewer/Management',{title:'x',description:'',alertIds:[ID],assignedTo:null,reason:'x'}),{status:403});assert.equal((await s.create('Security Analyst',{title:'x',description:'',alertIds:[ID],assignedTo:null,reason:'x'})).id,ID);});
