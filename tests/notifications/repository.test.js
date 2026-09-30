const test=require('node:test');
const assert=require('node:assert/strict');
const {notificationRepository,view}=require('../../src/data/notification-repository');
const ID='11111111-1111-4111-8111-111111111111';
test('recipient notification view exposes only minimal source and state fields',()=>{
 const row={id:ID,recipient_id:ID,incident_id:ID,alert_id:null,severity:'CRITICAL',
  message:'CRITICAL incident requires timely review.',created_at:new Date('2026-09-30T00:00:00Z'),read_at:null};
 const item=view(row);
 assert.deepEqual(Object.keys(item),['id','incidentId','alertId','severity','message','deliveredAt','readAt','state']);
 assert.equal(item.state,'UNREAD');assert.equal(item.severity,'CRITICAL');
 assert.equal(view({...row,read_at:new Date('2026-09-30T00:01:00Z')}).state,'READ');
});
test('inbox queries are recipient-scoped, severity ordered and return unread count',async()=>{
 const queries=[];
 const pool={query:async(sql,params)=>{
  queries.push({sql,params});
  if(sql.startsWith('SELECT n.*'))return{rows:[]};
  if(sql.startsWith('SELECT count(*)'))return{rows:[{n:3}]};
  throw Error('Unexpected SQL');
 }};
 const result=await notificationRepository(pool).list(ID,{status:'UNREAD',page:2});
 assert.equal(result.unreadCount,3);assert.equal(result.page,2);assert.equal(result.hasMore,false);
 assert.ok(queries[0].sql.includes('n.recipient_id=$1'));
 assert.ok(queries[0].sql.includes('n.read_at IS NULL'));
 assert.ok(queries[0].sql.includes("WHEN 'CRITICAL' THEN 4"));
 assert.deepEqual(queries[0].params,[ID,50]);
 assert.deepEqual(queries[1].params,[ID]);
});
test('unexpected storage errors fail closed without exposing database internals',async()=>{
 const pool={connect:async()=>{throw Error('private DB connection and password details');}};
 await assert.rejects(notificationRepository(pool).send(ID,{recipientId:ID,incidentId:ID,alertId:null,reason:'x'}),error=>{
  assert.equal(error.name,'NotificationPersistenceError');
  assert.ok(!error.message.includes('password'));return true;
 });
});
