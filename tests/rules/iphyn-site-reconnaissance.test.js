'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fixture=require('../../fixtures/rules/iphyn-site-scoped-reconnaissance.json');
const {ruleInput}=require('../../src/rules/model');
const {validDefinition,eventMatches,detectionEngine}=require('../../src/detection/engine');
const {normalizeEvidence}=require('../../src/integrations/evidence-catalog');

const tenantId='89238480-9405-49b1-abeb-34bb851612ab';
const source='site.847bd8a1-a123-4395-82e3-51c622cea1bf';
const host='iphyn.vercel.app';
const feed={tenantId,source,host,issuer:'application'};
const makeEvent=(sourceIp='192.0.2.22')=>normalizeEvidence({
 eventId:'12345678-1234-1234-1234-123456789abc',
 timestamp:new Date().toISOString(),signal:'app_route_probe',
 evidenceRef:'iphyn.route-probe:12345678-1234-1234-1234-123456789abc',
 sourceIp
},feed);

test('Iphyn website rule is disabled and matches the real application-evidence contract only',()=>{
 const rule=ruleInput(fixture),event=makeEvent();
 assert.equal(rule.enabled,false);
 assert.equal(rule.categoryCode,'RECONNAISSANCE');
 assert.equal(rule.severity,'MEDIUM');
 assert.equal(rule.definition.threshold,3);
 assert.equal(rule.definition.windowSeconds,120);
 assert.deepEqual(rule.definition.groupBy,['sourceIp','host']);
 assert.equal(validDefinition(rule.definition),true);
 assert.equal(event.severity,'LOW');
 assert.equal(event.metadata.categoryCode,'RECONNAISSANCE');
 assert.equal(eventMatches(event,rule.definition),true);
 for(const unrelated of [
  {...event,source:'iphyn-app'},
  {...event,source:'site.00000000-0000-0000-0000-000000000000'},
  {...event,host:'another-tenant.example.com'},
  {...event,sourceIp:null},
  {...event,type:'authentication'},
  {...event,action:'login'},
  {...event,status:'allowed'}
 ])assert.equal(eventMatches(unrelated,rule.definition),false);
});

test('rule reaches threshold only for three scoped same-IP observations in disposable memory',async()=>{
 const rule=ruleInput(fixture),event=makeEvent();
 let matched=[{id:'one'},{id:'two'}],created=0;
 const detector=detectionEngine({
  enabledRules:async()=>[{...rule,id:'disposable-rule-only'}],
  matchingEvents:async(definition,persisted,group)=>{
   assert.deepEqual(group,['192.0.2.22','iphyn.vercel.app']);
   return matched;
  },
  createAlert:async()=>{created++;return{id:'memory-only-alert'};}
 },null,{requiresHistory:()=>false,snapshot:()=>null});
 assert.deepEqual(await detector.evaluate({id:'two',event}),[]);
 assert.equal(created,0);
 matched=[...matched,{id:'three'}];
 assert.equal((await detector.evaluate({id:'three',event})).length,1);
 assert.equal(created,1);
});
