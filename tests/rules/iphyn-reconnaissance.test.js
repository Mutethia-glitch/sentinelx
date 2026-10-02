'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fixture=require('../../fixtures/rules/iphyn-scoped-reconnaissance.json');
const {ruleInput}=require('../../src/rules/model');
const {validDefinition,eventMatches,detectionEngine}=require('../../src/detection/engine');
const {collectorConfig,connectorEvent}=require('../../src/integrations/collector');
const config=collectorConfig({CONNECTOR_TOKEN:'a'.repeat(64),CONNECTOR_SOURCE:'iphyn-app',CONNECTOR_HOST:'iphyn.vercel.app'},{id:'disposable-iphyn'});
const input=(id,kind='reconnaissance_probe',sourceIp='192.0.2.22')=>({
 eventId:id,timestamp:new Date().toISOString(),kind,sourceIp
});
test('scoped Iphyn reconnaissance rule stays disabled and matches only attributed application probes',()=>{
 const rule=ruleInput(fixture);
 assert.equal(rule.enabled,false);assert.equal(rule.categoryCode,'RECONNAISSANCE');
 assert.equal(rule.severity,'MEDIUM');assert.equal(rule.definition.threshold,3);
 assert.equal(rule.definition.windowSeconds,120);
 assert.deepEqual(rule.definition.groupBy,['sourceIp','host']);
 assert.equal(validDefinition(rule.definition),true);
 const normalized=connectorEvent(input('12345678-1234-1234-1234-123456789abc'),config);
 assert.equal(normalized.severity,'LOW');
 assert.equal(normalized.type,'reconnaissance');
 assert.equal(eventMatches(normalized,rule.definition),true);
 for(const notProbe of [
  connectorEvent(input('22345678-1234-1234-1234-123456789abc','login_failed'),config),
  connectorEvent(input('32345678-1234-1234-1234-123456789abc','rate_limit_blocked'),config),
  {...normalized,source:'other-company'},
  {...normalized,host:'other-company.example.com'},
  {...normalized,sourceIp:null},
  {...normalized,status:'allowed'}
 ])assert.equal(eventMatches(notProbe,rule.definition),false);
 assert.throws(()=>connectorEvent(input('42345678-1234-1234-1234-123456789abc','reconnaissance_probe',null),config),{status:400});
});
test('two same-IP probes and one unrelated host/IP do not raise a reconnaissance alert; third genuine match can',async()=>{
 const rule=ruleInput(fixture);
 const event=connectorEvent(input('12345678-1234-1234-1234-123456789abc'),config);
 let count=0;
 const history=[{id:'probe-one'},{id:'probe-two'}];
 const detector=detectionEngine({
  enabledRules:async()=>[{...rule,id:'scoped-disabled-fixture-enabled-in-unit-test-only'}],
  matchingEvents:async(definition,persisted,group)=>{
   assert.deepEqual(group,['192.0.2.22','iphyn.vercel.app']);return history;
  },
  createAlert:async()=>{count++;return{id:'controlled-recon-alert'};}
 },null,{requiresHistory:()=>false,snapshot:()=>null});
 assert.deepEqual(await detector.evaluate({id:'probe-two',event}),[]);
 assert.equal(count,0);
 history.push({id:'probe-three'});
 const result=await detector.evaluate({id:'probe-three',event});
 assert.equal(result.length,1);
 assert.equal(count,1);
});
