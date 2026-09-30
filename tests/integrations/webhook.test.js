const test=require('node:test');
const assert=require('node:assert/strict');
const {externalWebhook,eventPayload,WEBHOOK_SCHEMA_VERSION}=require('../../src/integrations/webhook');
const {ingestionService}=require('../../src/events/ingestion');

function saved(){return {id:'11111111-1111-4111-8111-111111111111',receivedAt:'2026-09-30T19:00:00.000Z',normalizedAt:'2026-09-30T19:00:00.000Z',event:{timestamp:'2026-09-30T18:59:59.000Z',source:'sentinelx-simulated',type:'authentication',sourceIp:'192.0.2.1',destinationIp:null,user:'synthetic',host:'host',action:'login',status:'failed',severity:'HIGH',rawData:{secret:'do-not-export'},metadata:{private:true}}};}

test('webhook is disabled by default and invalid configuration is unavailable',async()=>{
 assert.equal(externalWebhook({env:{}}).status,'disabled');
 assert.equal((await externalWebhook({env:{}}).publishEvent(saved())).status,'disabled');
 assert.equal(externalWebhook({env:{SENTINELX_EXTERNAL_WEBHOOK_URL:'http://example.invalid',SENTINELX_EXTERNAL_WEBHOOK_TOKEN:'1234567890123456'}}).status,'unavailable');
 assert.equal(externalWebhook({env:{SENTINELX_EXTERNAL_WEBHOOK_URL:'https://example.invalid'}}).status,'unavailable');
 assert.equal(externalWebhook({env:{SENTINELX_EXTERNAL_WEBHOOK_URL:'https://user:pass@example.invalid/hook',SENTINELX_EXTERNAL_WEBHOOK_TOKEN:'1234567890123456'}}).status,'unavailable');
});

test('payload is versioned and exports only the canonical event snapshot',()=>{
 const payload=eventPayload(saved(),()=>new Date('2026-09-30T20:00:00Z'));
 assert.equal(payload.schemaVersion,WEBHOOK_SCHEMA_VERSION);assert.equal(payload.eventType,'sentinelx.security_event');assert.equal(payload.emittedAt,'2026-09-30T20:00:00.000Z');
 assert.equal(payload.event.id,saved().id);assert.equal(payload.event.severity,'HIGH');
 assert.equal('rawData' in payload.event,false);assert.equal('metadata' in payload.event,false);
});

test('ready webhook sends bearer-authenticated HTTPS POST and degrades on remote failure',async()=>{
 const env={SENTINELX_EXTERNAL_WEBHOOK_URL:'https://siem.example.invalid/sentinelx',SENTINELX_EXTERNAL_WEBHOOK_TOKEN:'synthetic-token-1234567890',SENTINELX_EXTERNAL_WEBHOOK_TIMEOUT_MS:'1500'};
 let request;
 const ready=externalWebhook({env,now:()=>new Date('2026-09-30T20:00:00Z'),fetchImpl:async(url,options)=>{request={url,options};return {ok:true,status:204};}});
 assert.equal(ready.status,'ready');assert.equal((await ready.publishEvent(saved())).status,'delivered');
 assert.equal(request.url,env.SENTINELX_EXTERNAL_WEBHOOK_URL);assert.equal(request.options.method,'POST');assert.equal(request.options.redirect,'error');assert.equal(request.options.headers.Authorization,`Bearer ${env.SENTINELX_EXTERNAL_WEBHOOK_TOKEN}`);
 const body=JSON.parse(request.options.body);assert.equal(body.event.id,saved().id);assert.equal(JSON.stringify(body).includes('do-not-export'),false);
 const rejected=externalWebhook({env,fetchImpl:async()=>({ok:false,status:503})});assert.equal((await rejected.publishEvent(saved())).status,'unavailable');
 const offline=externalWebhook({env,fetchImpl:async()=>{throw new Error('private remote failure');}});assert.equal((await offline.publishEvent(saved())).status,'unavailable');
});

test('ingestion publishes only after persistence and webhook failure cannot fail the core receipt',async()=>{
 const order=[];const stored=saved();
 const repository={create:async(_event,_actor,afterPersist)=>{order.push('persist');if(afterPersist){order.push('detect');await afterPersist(stored,{});}return stored;}};
 const access={me:async()=>({user:{id:'actor'},roles:['Security Analyst']})};
 const detector={evaluate:async()=>[{id:'alert'}]};
 const integration={publishEvent:async item=>{assert.equal(item.id,stored.id);order.push('webhook');throw new Error('optional integration unavailable');}};
 const service=ingestionService(repository,access,['sentinelx-simulated'],detector,integration);
 const receipt=await service.ingest('token',stored.event);
 assert.deepEqual(order,['persist','detect','webhook']);assert.equal(receipt.id,stored.id);assert.equal(receipt.alertsGenerated,1);
});
