const test=require('node:test');
const assert=require('node:assert/strict');
const {sendInput,inboxQuery,readInput,notificationId,deliveryMessage}=require('../../src/notifications/model');
const ID='11111111-1111-4111-8111-111111111111';
const good={recipientId:ID,incidentId:ID,alertId:null,reason:'Assigned analyst needs to review the incident'};
test('dispatch input requires exact bounded fields and exactly one validated source',()=>{
 assert.deepEqual(sendInput({...good,reason:'  Review now  '}),{...good,reason:'Review now'});
 assert.equal(sendInput({...good,incidentId:null,alertId:ID}).alertId,ID);
 for(const input of [null,[],{}, {...good,incidentId:null}, {...good,alertId:ID},
  {...good,reason:''},{...good,reason:'x'.repeat(501)},{...good,extra:'x'},
  {...good,recipientId:'bad'},{...good,incidentId:'bad'},{...good,reason:'a\0b'}])
  assert.throws(()=>sendInput(input),{status:400});
});
test('inbox filtering is bounded, read body is empty and IDs are validated',()=>{
 assert.deepEqual(inboxQuery(new URLSearchParams()),{status:'ALL',page:1});
 assert.deepEqual(inboxQuery(new URLSearchParams('status=UNREAD&page=2')),{status:'UNREAD',page:2});
 for(const query of ['status=UNKNOWN','status=READ&status=ALL','page=0','page=2001','page=1&page=2','other=a'])
  assert.throws(()=>inboxQuery(new URLSearchParams(query)),{status:400});
 assert.deepEqual(readInput({}),{});
 assert.throws(()=>readInput({id:ID}),{status:400});
 assert.equal(notificationId(ID),ID);
 assert.throws(()=>notificationId('invalid'),{status:400});
});
test('severity-aware messages disclose no incident details',()=>{
 assert.equal(deliveryMessage('CRITICAL','INCIDENT'),'CRITICAL incident requires timely review.');
 assert.equal(deliveryMessage('HIGH','ALERT'),'HIGH alert requires timely review.');
 assert.equal(deliveryMessage('LOW','INCIDENT'),'LOW incident shared for review.');
 assert.equal(deliveryMessage('MEDIUM','ALERT'),'MEDIUM alert shared for review.');
 assert.throws(()=>deliveryMessage('EXTREME','ALERT'),TypeError);
});
