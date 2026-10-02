const {test}=require('node:test');
const assert=require('node:assert/strict');
const preset=require('../../fixtures/rules/iphyn-repeated-access-denial.json');
const {ruleInput}=require('../../src/rules/model');
const {eventMatches,validDefinition,detectionEngine}=require('../../src/detection/engine');
const {connectorConfig,connectorEvent}=require('../../src/integrations/collector');

const config=connectorConfig({CONNECTOR_TOKEN:'a'.repeat(64),CONNECTOR_SOURCE:'iphyn-app',
  CONNECTOR_HOST:'iphyn.vercel.app'}, {id:'disposable-tenant'});
const input=(patch={})=>({eventId:'12345678-1234-1234-1234-123456789abc',
  timestamp:new Date().toISOString(),kind:'access_denied',sourceIp:'192.0.2.22',subject:'b'.repeat(64),...patch});

test('Iphyn unauthorized-access preset has valid API shape and stays disabled',()=>{
  const parsed=ruleInput(preset);
  assert.equal(parsed.enabled,false);
  assert.equal(parsed.categoryCode,'UNAUTHORIZED_ACCESS');
  assert.equal(parsed.severity,'HIGH');
  assert.equal(validDefinition(parsed.definition),true);
  assert.equal(parsed.definition.threshold,3);
  assert.equal(parsed.definition.windowSeconds,300);
  assert.deepEqual(parsed.definition.groupBy,['sourceIp','user']);
  assert.deepEqual(parsed.mitreTechniqueIds,[]);
});

test('scoped denied-access rule accepts only attributable genuine denial evidence',()=>{
  const {definition}=ruleInput(preset);
  const positive=connectorEvent(input(),config);
  assert.equal(positive.type,'access');
  assert.equal(positive.status,'denied');
  assert.equal(positive.severity,'MEDIUM','event and alert severity stay separate');
  assert.equal(eventMatches(positive,definition),true);
  for(const negative of [
    connectorEvent(input({sourceIp:null}),config),
    connectorEvent(input({subject:undefined}),config),
    connectorEvent(input({kind:'login_failed'}),config),
    connectorEvent(input({kind:'rate_limit_blocked'}),config),
    connectorEvent(input({kind:'privileged_access_denied'}),config),
    {...positive,source:'other-app'},
    {...positive,host:'untrusted.example'},
    {...positive,status:'success'},
  ])assert.equal(eventMatches(negative,definition),false);
});

test('benign below-threshold denial does not alert; third matching denial can alert',async()=>{
  const parsed=ruleInput(preset);
  const normalized=connectorEvent(input(),config);
  const matches=[{id:'denied-1'},{id:'denied-2'}];
  let alerts=0;
  const detector=detectionEngine({
    enabledRules:async()=>[{id:'disabled-until-approved',name:parsed.name,severity:parsed.severity,
      categoryCode:parsed.categoryCode,definition:parsed.definition}],
    matchingEvents:async(def,event,group)=>{
      assert.deepEqual(group,[normalized.sourceIp,normalized.user]);
      return matches;
    },
    createAlert:async()=>{alerts++;return {id:'controlled-alert'};}
  },null,{requiresHistory:()=>false,snapshot:()=>null});
  assert.deepEqual(await detector.evaluate({id:'denied-2',event:normalized}),[]);
  assert.equal(alerts,0);
  matches.push({id:'denied-3'});
  assert.equal((await detector.evaluate({id:'denied-3',event:normalized})).length,1);
  assert.equal(alerts,1);
});
