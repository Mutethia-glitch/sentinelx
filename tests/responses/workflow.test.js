const test=require('node:test');
const assert=require('node:assert/strict');
const {responseInput,responsePage,RESPONSE_ACTIONS}=require('../../src/responses/model');
const {responseService}=require('../../src/responses/service');
const {responseRepository}=require('../../src/data/response-repository');
const ID='11111111-1111-4111-8111-111111111111', ACTOR='22222222-2222-4222-8222-222222222222';
const good={action:'CONTAINMENT',reason:'Manual containment confirmed',details:'Affected session revoked outside SentinelX.',succeeded:true,containmentPerformed:true};
function fakePool(initial='NEW',failAudit=false,roles=['Security Analyst']){
 let saved={status:initial,actions:[],audits:[]},work,sequence=0;
 const pool={
   get state(){return saved;},
   async query(sql){
     if(sql.startsWith('SELECT id FROM incidents'))return{rows:[{id:ID}]};
     if(sql.includes('FROM response_actions ra'))return{rows:saved.actions.map(row=>({...row,actor_name:'Analyst'}))};
     throw Error('Unknown query');
   },
   async connect(){return{
     async query(sql,params){
       if(sql==='BEGIN'){work=structuredClone(saved);return{rows:[]};}
       if(sql==='COMMIT'){saved=work;work=null;return{rows:[]};}
       if(sql==='ROLLBACK'){work=null;return{rows:[]};}
       if(sql.startsWith('SELECT id,display_name FROM users'))return{rows:[{id:ACTOR,display_name:'Analyst'}]};
       if(sql.includes('FROM user_roles'))return{rows:roles.map(name=>({name}))};
       if(sql.startsWith('SELECT id,status FROM incidents'))return{rows:[{id:ID,status:work.status}]};
       if(sql.startsWith('INSERT INTO response_actions')){
         const row={id:'00000000-0000-4000-8000-'+String(++sequence).padStart(12,'0'),
           incident_id:ID,authorized_by:ACTOR,action:params[2],reason:params[3],
           result:JSON.parse(params[4]),succeeded:params[5],performed_at:new Date('2026-09-30T08:00:00Z')};
         work.actions.push(row);return{rows:[row]};
       }
       if(sql.startsWith("UPDATE incidents SET status='CONTAINED'")){work.status='CONTAINED';return{rows:[]};}
       if(sql.startsWith('INSERT INTO audit_logs')){
         if(failAudit)throw Error('private audit outage');
         work.audits.push({action:sql.includes('RESPONSE_ACTION_RECORDED')?'RESPONSE_ACTION_RECORDED':'INCIDENT_STATUS_CHANGED',
           context:JSON.parse(params[2])});return{rows:[]};
       }
       throw Error('Unknown transaction query');
     },release(){}
   };}
 };
 return pool;
}
test('only approved manual actions and explicit containment attestation accepted',()=>{
 assert.deepEqual(RESPONSE_ACTIONS,['CONTAINMENT','ESCALATION','FOLLOW_UP_TASK','COMMUNICATION']);
 assert.deepEqual(responseInput(good),good);
 for(const change of [{action:'BLOCK_HOST'},{containmentPerformed:false},{succeeded:false},{reason:''},{details:''},{details:'x'.repeat(2001)},{unexpected:1}]){
   assert.throws(()=>responseInput({...good,...change}),{status:400});
 }
 assert.equal(responseInput({...good,succeeded:false,containmentPerformed:false}).succeeded,false);
 assert.throws(()=>responseInput({...good,action:'COMMUNICATION'}),{status:400});
});
test('response-history page validation is bounded',()=>{
 assert.equal(responsePage(new URLSearchParams()),1);
 assert.equal(responsePage(new URLSearchParams('page=2')),2);
 for(const q of ['page=0','page=2001','page=a','page=1&page=2','q=x'])
   assert.throws(()=>responsePage(new URLSearchParams(q)),{status:400});
});
test('Viewer reads but cannot record; analyst can record',async()=>{
 const access={me:async name=>({user:{id:ACTOR},roles:[name]})};
 const repository={list:async(_id,page)=>({page,actions:[]}),record:async()=>({id:ID})};
 const service=responseService(repository,access);
 assert.equal((await service.list('Viewer/Management',ID,new URLSearchParams())).page,1);
 await assert.rejects(service.record('Viewer/Management',ID,good),{status:403});
 assert.equal((await service.record('Security Analyst',ID,good)).id,ID);
});
test('successful manual containment records action and changes status with two audit entries',async()=>{
 const pool=fakePool();
 const action=await responseRepository(pool).record(ACTOR,ID,good);
 assert.equal(action.incidentStatus,'CONTAINED');
 assert.equal(pool.state.status,'CONTAINED');
 assert.equal(pool.state.actions.length,1);
 assert.deepEqual(pool.state.audits.map(a=>a.action),['RESPONSE_ACTION_RECORDED','INCIDENT_STATUS_CHANGED']);
 assert.equal(pool.state.audits[1].context.responseActionId,action.id);
});
test('failed containment is visible but cannot set incident CONTAINED',async()=>{
 const pool=fakePool('INVESTIGATING');
 await responseRepository(pool).record(ACTOR,ID,{...good,succeeded:false,containmentPerformed:false});
 assert.equal(pool.state.status,'INVESTIGATING');
 assert.equal(pool.state.actions[0].succeeded,false);
 assert.equal(pool.state.audits.length,1);
});
test('other response records do not execute external operations or change status',async()=>{
 const pool=fakePool('INVESTIGATING');
 for(const action of ['ESCALATION','FOLLOW_UP_TASK','COMMUNICATION'])
   await responseRepository(pool).record(ACTOR,ID,{...good,action,containmentPerformed:false});
 assert.equal(pool.state.status,'INVESTIGATING');
 assert.equal(pool.state.actions.length,3);
 assert.ok(pool.state.actions.every(a=>a.result.mode==='MANUAL_ATTESTATION'));
});
test('terminal incidents and duplicate successful containment reject mutation',async()=>{
 for(const status of ['RESOLVED','DISMISSED','CONTAINED']){
   const pool=fakePool(status);
   await assert.rejects(responseRepository(pool).record(ACTOR,ID,good),{status:409});
   assert.equal(pool.state.actions.length,0);
 }
});
test('live RBAC revocation rejects operation inside transaction',async()=>{
 const pool=fakePool('NEW',false,['Viewer/Management']);
 await assert.rejects(responseRepository(pool).record(ACTOR,ID,good),{status:403});
 assert.equal(pool.state.actions.length,0);
});
test('audit failure rolls back both record and CONTAINED transition',async()=>{
 const pool=fakePool('INVESTIGATING',true);
 await assert.rejects(responseRepository(pool).record(ACTOR,ID,good),{name:'ResponsePersistenceError'});
 assert.equal(pool.state.status,'INVESTIGATING');assert.equal(pool.state.actions.length,0);
});
test('response history provides actor, time, action and outcome',async()=>{
 const pool=fakePool();
 await responseRepository(pool).record(ACTOR,ID,{...good,action:'ESCALATION',containmentPerformed:false});
 const list=await responseRepository(pool).list(ID,1);
 assert.equal(list.actions.length,1);
 assert.equal(list.actions[0].authorizedBy.displayName,'Analyst');
 assert.equal(list.actions[0].action,'ESCALATION');
 assert.equal(list.actions[0].result.summary,good.details);
});
