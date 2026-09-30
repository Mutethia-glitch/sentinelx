const test=require('node:test');
const assert=require('node:assert/strict');
const {noteInput}=require('../../src/investigations/model');
const {investigationService}=require('../../src/investigations/service');
const {affectedEntities,buildTimeline}=require('../../src/data/investigation-repository');

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';

test('investigation note input is bounded and evidence references are unique UUIDs',()=>{
  assert.deepEqual(noteInput({content:' Finding ',alertIds:[A],eventIds:[B]}),{content:'Finding',alertIds:[A],eventIds:[B]});
  for(const body of [
    {content:'',alertIds:[],eventIds:[]},
    {content:'x',alertIds:[A,A],eventIds:[]},
    {content:'x',alertIds:['bad'],eventIds:[]},
    {content:'x',alertIds:[],eventIds:[],extra:true},
  ]) assert.throws(()=>noteInput(body),{status:400});
});

test('Viewer can read an investigation but cannot record findings',async()=>{
  const access={me:async token=>({user:{id:A},roles:[token]})};
  const repository={get:async()=>({incident:{id:A}}),addNote:async()=>({id:B})};
  const service=investigationService(repository,access);
  assert.equal((await service.workspace('Viewer/Management',A)).incident.id,A);
  await assert.rejects(service.addNote('Viewer/Management',A,{content:'x',alertIds:[],eventIds:[]}),{status:403});
  assert.equal((await service.addNote('Security Analyst',A,{content:'x',alertIds:[],eventIds:[]})).id,B);
});

test('affected entities are deduplicated across alerts and events',()=>{
  const result=affectedEntities(
    [{affectedEntities:{user:'alice',host:'host-a',sourceIp:'192.0.2.1'}}],
    [{user:'alice',host:'host-b',sourceIp:'192.0.2.1',destinationIp:'198.51.100.2'}]
  );
  assert.deepEqual(result,{user:['alice'],host:['host-a','host-b'],sourceIp:['192.0.2.1'],destinationIp:['198.51.100.2']});
});

test('timeline orders event, alert, incident history and findings chronologically',()=>{
  const incident={id:A,createdAt:'2026-09-30T00:03:00.000Z'};
  const alerts=[{id:B,timestamp:'2026-09-30T00:02:00.000Z',severity:'HIGH',threat:'MALWARE',ruleName:'Rule',status:'NEW',source:'sim'}];
  const events=[{id:A,timestamp:'2026-09-30T00:01:00.000Z',source:'sim',type:'malware',severity:'HIGH',user:'alice',host:'host-a',action:'execute',status:'detected'}];
  const notes=[{id:'33333333-3333-4333-8333-333333333333',createdAt:'2026-09-30T00:05:00.000Z',author:{id:A,displayName:'Analyst'},content:'Finding',evidence:{alertIds:[B],eventIds:[A]}}];
  const history=[{id:'44444444-4444-4444-8444-444444444444',action:'INCIDENT_STATUS_CHANGED',timestamp:'2026-09-30T00:04:00.000Z',actor:{id:A,displayName:'Analyst'},context:{status:'INVESTIGATING'}}];
  assert.deepEqual(buildTimeline(incident,alerts,events,notes,history).map(item=>item.type),['SECURITY_EVENT','ALERT','INCIDENT_CREATED','INCIDENT_HISTORY','INVESTIGATION_NOTE']);
});
