const test=require('node:test');
const assert=require('node:assert/strict');
const {detectionEngine}=require('../../src/detection/engine');
const definition={schemaVersion:1,conditions:[{field:'status',operator:'equals',value:'failed'}],threshold:1,windowSeconds:60,groupBy:['user']};
const saved={id:'event-1',event:{timestamp:'2026-09-30T00:00:00Z',source:'sim',type:'authentication',sourceIp:'192.0.2.1',destinationIp:null,user:'alice',host:'host-a',action:'login',status:'failed',severity:'MEDIUM',rawData:{},metadata:{}}};

test('newly created alert is correlated with the same database client',async()=>{
  const db={query(){}};let correlated;
  const repo={enabledRules:async()=>[{id:'rule-1',name:'Rule',severity:'HIGH',categoryCode:'BRUTE_FORCE',definition}],matchingEvents:async()=>[{id:'event-1'}],createAlert:async()=>({id:'alert-1',threat:'BRUTE_FORCE',timestamp:'2026-09-30T00:00:01Z',affectedEntities:{user:'alice',host:'host-a'}})};
  const correlator={evaluate:async(alert,seenDb)=>{correlated={alert,seenDb};return{alertId:alert.id,correlations:[],groupAlertIds:[alert.id]};}};
  const result=await detectionEngine(repo,correlator).evaluate(saved,db);
  assert.equal(correlated.seenDb,db);
  assert.equal(result[0].correlation.groupAlertIds[0],'alert-1');
});

test('duplicate-suppressed alert is not correlated again',async()=>{
  let calls=0;
  const repo={enabledRules:async()=>[{id:'rule-1',name:'Rule',severity:'HIGH',categoryCode:'BRUTE_FORCE',definition}],matchingEvents:async()=>[{id:'event-1'}],createAlert:async()=>null};
  const correlator={evaluate:async()=>{calls++;}};
  assert.deepEqual(await detectionEngine(repo,correlator).evaluate(saved),[]);
  assert.equal(calls,0);
});

test('correlation failure propagates so enclosing ingestion transaction can roll back',async()=>{
  const repo={enabledRules:async()=>[{id:'rule-1',name:'Rule',severity:'HIGH',categoryCode:'BRUTE_FORCE',definition}],matchingEvents:async()=>[{id:'event-1'}],createAlert:async()=>({id:'alert-1',threat:'BRUTE_FORCE',timestamp:'2026-09-30T00:00:01Z',affectedEntities:{user:'alice',host:'host-a'}})};
  await assert.rejects(detectionEngine(repo,{evaluate:async()=>{throw new Error('synthetic correlation failure');}}).evaluate(saved),/synthetic correlation failure/);
});
