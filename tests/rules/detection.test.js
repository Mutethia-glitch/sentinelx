const test = require('node:test');
const assert = require('node:assert/strict');
const { detectionEngine, validDefinition, eventMatches } = require('../../src/detection/engine');
const event = (patch={}) => ({timestamp:'2026-09-30T00:00:00.000Z',source:'sentinelx-simulated',type:'authentication',sourceIp:'192.0.2.10',destinationIp:null,user:'demo',host:'workstation',action:'login',status:'failed',severity:'MEDIUM',rawData:{},metadata:{},...patch});
const definition = {schemaVersion:1,conditions:[{field:'type',operator:'equals',value:'authentication'},{field:'status',operator:'equals',value:'failed'}],threshold:3,windowSeconds:60,groupBy:['sourceIp','user']};
test('deterministic conditions match normalized fields only',()=>{assert.equal(validDefinition(definition),true);assert.equal(eventMatches(event(),definition),true);assert.equal(eventMatches(event({status:'success'}),definition),false);assert.equal(validDefinition({...definition,schemaVersion:2}),false);});
test('threshold creates one alert from bounded matching evidence',async()=>{let created=0;const repo={enabledRules:async()=>[{id:'rule',name:'Failures',severity:'HIGH',categoryCode:'BRUTE_FORCE',definition}],matchingEvents:async()=>[{id:'1'},{id:'2'},{id:'3'}],createAlert:async(rule,events,evidence)=>{created++;return {id:'alert',events,evidence};}};const result=await detectionEngine(repo).evaluate({id:'3',event:event()});assert.equal(created,1);assert.equal(result.length,1);assert.deepEqual(result[0].evidence.groupValues,['192.0.2.10','demo']);});
test('non-match and below-threshold events create no alerts',async()=>{let created=0;const repo={enabledRules:async()=>[{id:'rule',definition,severity:'HIGH'}],matchingEvents:async()=>[{id:'1'},{id:'2'}],createAlert:async()=>{created++;}};assert.deepEqual(await detectionEngine(repo).evaluate({id:'x',event:event({status:'success'})}),[]);assert.deepEqual(await detectionEngine(repo).evaluate({id:'x',event:event()}),[]);assert.equal(created,0);});

test('malformed persisted definitions are rejected instead of guessed',()=>{
  assert.equal(validDefinition({...definition,conditions:[{field:'status',operator:'in',value:null}]}),false);
  assert.equal(validDefinition({...definition,conditions:[{field:'sourceIp',operator:'equals',value:'not-an-ip'}]}),false);
  assert.equal(validDefinition({...definition,groupBy:['user','user']}),false);
  assert.equal(validDefinition({...definition,extra:true}),false);
});


test('no-transaction evaluation lets repositories use their default pool', async () => {
  const repo = {
    enabledRules: async db => {
      assert.equal(db, undefined);
      return [{ id: 'rule', name: 'Failures', severity: 'HIGH', categoryCode: 'BRUTE_FORCE', definition }];
    },
    matchingEvents: async (ruleDefinition, normalizedEvent, group, db) => {
      assert.equal(db, undefined);
      return [{ id: '1' }, { id: '2' }, { id: '3' }];
    },
    createAlert: async (rule, events, evidence, db) => {
      assert.equal(db, undefined);
      return null;
    },
  };
  assert.deepEqual(await detectionEngine(repo).evaluate({ id: '3', event: event() }), []);
});
