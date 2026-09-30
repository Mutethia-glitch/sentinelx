const assert=require('node:assert/strict');
const {externalWebhook}=require('../src/integrations/webhook');
const {ingestionService}=require('../src/events/ingestion');

async function main(){
 const env={SENTINELX_EXTERNAL_WEBHOOK_URL:'https://siem.example.invalid/sentinelx',SENTINELX_EXTERNAL_WEBHOOK_TOKEN:'synthetic-verifier-token-123456'};
 const stored={id:'22222222-2222-4222-8222-222222222222',receivedAt:'2026-09-30T20:00:01.000Z',normalizedAt:'2026-09-30T20:00:01.000Z',event:{timestamp:'2026-09-30T20:00:00.000Z',source:'sentinelx-simulated',type:'authentication',sourceIp:'192.0.2.34',destinationIp:null,user:'task34-user',host:'task34-host',action:'login',status:'failed',severity:'HIGH',rawData:{synthetic:true,secret:'not-exported'},metadata:{verification:'task34'}}};
 let sent;
 const ready=externalWebhook({env,now:()=>new Date('2026-09-30T20:00:02Z'),fetchImpl:async(url,options)=>{sent={url,options};return{ok:true,status:204};}});
 assert.equal(ready.status,'ready');assert.equal((await ready.publishEvent(stored)).status,'delivered');
 const body=JSON.parse(sent.options.body);assert.equal(body.schemaVersion,1);assert.equal(body.event.id,stored.id);assert.equal('rawData' in body.event,false);assert.equal('metadata' in body.event,false);assert.equal(sent.options.redirect,'error');assert.ok(sent.options.headers.Authorization.startsWith('Bearer '));
 assert.equal(externalWebhook({env:{}}).status,'disabled');
 assert.equal(externalWebhook({env:{SENTINELX_EXTERNAL_WEBHOOK_URL:'http://example.invalid',SENTINELX_EXTERNAL_WEBHOOK_TOKEN:env.SENTINELX_EXTERNAL_WEBHOOK_TOKEN}}).status,'unavailable');
 const unavailable=externalWebhook({env,fetchImpl:async()=>{throw new Error('synthetic unreachable integration');}});assert.equal((await unavailable.publishEvent(stored)).status,'unavailable');
 let persisted=0;
 const service=ingestionService({create:async()=>{persisted++;return stored;}},{me:async()=>({user:{id:'actor'},roles:['Security Analyst']})},['sentinelx-simulated'],null,unavailable);
 const receipt=await service.ingest('synthetic-token',stored.event);assert.equal(persisted,1);assert.equal(receipt.id,stored.id);assert.equal(receipt.alertsGenerated,0);
 console.log('Optional HTTPS webhook contract, minimal event export, disabled/unavailable states and safe core degradation verified.');
}
if(require.main===module)main().catch(()=>{console.error('Task 34 external integration verification failed. No credentials or remote response details were printed.');process.exitCode=1;});
module.exports={main};
