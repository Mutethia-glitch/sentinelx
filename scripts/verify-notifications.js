const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {createPool}=require('../src/data/pool');
const {notificationRepository}=require('../src/data/notification-repository');
const {incidentManagementFixture}=require('./verify-incident-management');
async function verifyNotifications(pool){
 const f=await incidentManagementFixture(pool);
 try{
  async function login(user){
   const response=await fetch(f.base+'/api/auth/login',{method:'POST',headers:{Origin:f.base,'Content-Type':'application/json'},
    body:JSON.stringify({email:user.email,password:f.password})});
   assert.equal(response.status,200);
   return response.headers.get('set-cookie').split(';')[0];
  }
  const cookies=[];for(const user of f.users)cookies.push(await login(user));
  const request=(path,cookie,{method='GET',body=null,origin=f.base}={})=>fetch(f.base+path,{method,headers:{
   Cookie:cookie||'',Origin:origin,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const created=await request('/api/incidents',cookies[1],{method:'POST',body:{
   title:'Task 23 private in-app notification',description:'Synthetic evidence only',
   alertIds:f.alertIds,assignedTo:f.users[1].id,reason:'Task 23 verifier incident'
  }});
  assert.equal(created.status,201);const incident=(await created.json()).incident;f.incidentIds.push(incident.id);
  const endpoint='/api/notifications',receiver=f.users[1].id;
  const source={recipientId:receiver,incidentId:incident.id,alertId:null,reason:'Explicit authorized analyst notification'};
  assert.equal((await request(endpoint,'')).status,401);
  assert.equal((await request(endpoint,cookies[2])).status,200);
  assert.equal((await request(endpoint,cookies[2],{method:'POST',body:source})).status,403);
  assert.equal((await request(endpoint,cookies[0],{method:'POST',body:source,origin:'http://untrusted.example'})).status,403);
  assert.equal((await request(endpoint,cookies[0],{method:'POST',body:{...source,alertId:f.alertIds[0]}})).status,400);
  assert.equal((await request(endpoint,cookies[0],{method:'POST',body:{...source,incidentId:null}})).status,400);
  assert.equal((await request(endpoint,cookies[0],{method:'POST',body:{...source,recipientId:randomUUID()}})).status,400);
  assert.equal((await request(endpoint,cookies[0],{method:'POST',body:{...source,incidentId:randomUUID()}})).status,404);
  const delivered=await request(endpoint,cookies[0],{method:'POST',body:source});
  assert.equal(delivered.status,201);const first=(await delivered.json());
  assert.equal(first.delivered,true);assert.equal(first.deduplicated,false);
  assert.equal(first.notification.severity,'CRITICAL');assert.equal(first.notification.state,'UNREAD');
  assert.ok(first.notification.deliveredAt);
  assert.equal(first.notification.message,'CRITICAL incident requires timely review.');
  assert.ok(!JSON.stringify(first.notification).includes('Synthetic evidence only'));

  const duplicate=await request(endpoint,cookies[0],{method:'POST',body:{...source,reason:'Second dispatch attempt'}});
  assert.equal(duplicate.status,200);const repeat=(await duplicate.json());
  assert.equal(repeat.delivered,false);assert.equal(repeat.deduplicated,true);assert.equal(repeat.notification.id,first.notification.id);
  assert.equal((await pool.query('SELECT count(*)::integer AS n FROM notifications WHERE recipient_id=$1 AND incident_id=$2',[receiver,incident.id])).rows[0].n,1);

  const alertBody={recipientId:receiver,incidentId:null,alertId:f.alertIds[0],reason:'Send linked alert'};
  const alertResponse=await request(endpoint,cookies[1],{method:'POST',body:alertBody});
  assert.equal(alertResponse.status,201);const alertNotification=(await alertResponse.json()).notification;
  assert.equal(alertNotification.severity,'HIGH');
  const inbox=(await (await request(endpoint+'?status=UNREAD&page=1',cookies[1])).json());
  assert.deepEqual(inbox.notifications.map(n=>n.severity),['CRITICAL','HIGH']);
  assert.equal(inbox.unreadCount,2);
  assert.equal((await (await request(endpoint,cookies[2])).json()).notifications.length,0);
  assert.equal((await (await request(endpoint,cookies[0])).json()).notifications.length,0);
  assert.equal((await request(endpoint+'?status=BAD',cookies[1])).status,400);
  assert.equal((await request(endpoint+'?page=0',cookies[1])).status,400);
  assert.equal((await request(endpoint+'/'+first.notification.id+'/read',cookies[2],{method:'PATCH',body:{}})).status,404);
  assert.equal((await request(endpoint+'/'+first.notification.id+'/read',cookies[1],{method:'PATCH',body:{extra:true}})).status,400);

  const read=await request(endpoint+'/'+first.notification.id+'/read',cookies[1],{method:'PATCH',body:{}});
  assert.equal(read.status,200);assert.equal((await read.json()).changed,true);
  const again=await request(endpoint+'/'+first.notification.id+'/read',cookies[1],{method:'PATCH',body:{}});
  assert.equal(again.status,200);assert.equal((await again.json()).changed,false);
  const readAudit=(await pool.query("SELECT count(*)::integer AS n FROM audit_logs WHERE target_type='notification' AND target_id=$1 AND action='NOTIFICATION_READ'",[first.notification.id])).rows[0].n;
  assert.equal(readAudit,1);
  assert.equal((await (await request(endpoint+'?status=READ',cookies[1])).json()).notifications[0].id,first.notification.id);
  assert.equal((await (await request(endpoint+'?status=UNREAD',cookies[1])).json()).unreadCount,1);

  const reissued=await request(endpoint,cookies[0],{method:'POST',body:{...source,reason:'New notification after prior item read'}});
  assert.equal(reissued.status,201);const newOne=(await reissued.json()).notification;
  assert.notEqual(newOne.id,first.notification.id);

  // The severity snapshot is stable even if the source incident is later reassessed.
  await pool.query("UPDATE incidents SET threat_level='MEDIUM' WHERE id=$1",[incident.id]);
  const viewerBody={recipientId:f.users[2].id,incidentId:incident.id,alertId:null,reason:'Medium incident review'};
  const medium=await request(endpoint,cookies[0],{method:'POST',body:viewerBody});
  assert.equal(medium.status,201);assert.equal((await medium.json()).notification.severity,'MEDIUM');
  assert.equal((await (await request(endpoint+'?status=ALL',cookies[1])).json()).notifications.find(n=>n.id===first.notification.id).severity,'CRITICAL');
  await pool.query("UPDATE incidents SET threat_level='LOW' WHERE id=$1",[incident.id]);
  const low=await request(endpoint,cookies[0],{method:'POST',body:{recipientId:f.users[0].id,incidentId:incident.id,alertId:null,reason:'Low severity example'}});
  assert.equal(low.status,201);assert.equal((await low.json()).notification.severity,'LOW');

  // A storage/audit failure must not claim delivery or change recipient read state.
  const failPool={connect:async()=>{const client=await pool.connect();return {
   query:(sql,values)=>{if(sql.startsWith('INSERT INTO audit_logs'))throw new Error('synthetic audit outage');return client.query(sql,values);},
   release:error=>client.release(error),
  };}};
  const countBefore=(await pool.query('SELECT count(*)::integer AS n FROM notifications WHERE recipient_id=$1 AND alert_id=$2',[f.users[2].id,f.alertIds[0]])).rows[0].n;
  await assert.rejects(notificationRepository(failPool).send(f.users[0].id,{
   recipientId:f.users[2].id,incidentId:null,alertId:f.alertIds[0],reason:'Atomic delivery rollback'
  }),{name:'NotificationPersistenceError'});
  const countAfter=(await pool.query('SELECT count(*)::integer AS n FROM notifications WHERE recipient_id=$1 AND alert_id=$2',[f.users[2].id,f.alertIds[0]])).rows[0].n;
  assert.equal(countAfter,countBefore);
  await assert.rejects(notificationRepository(failPool).markRead(receiver,alertNotification.id),{name:'NotificationPersistenceError'});
  assert.equal((await pool.query('SELECT read_at FROM notifications WHERE id=$1',[alertNotification.id])).rows[0].read_at,null);
  const deliveredAudit=(await pool.query("SELECT count(*)::integer AS n FROM audit_logs WHERE target_type='notification' AND action='NOTIFICATION_DELIVERED' AND actor_id=ANY($1::uuid[])",[f.users.map(u=>u.id)])).rows[0].n;
  const actual=(await pool.query('SELECT count(*)::integer AS n FROM notifications WHERE recipient_id=ANY($1::uuid[])',[f.users.map(u=>u.id)])).rows[0].n;
  assert.equal(deliveredAudit,actual);
  assert.equal((await pool.query('SELECT count(*)::integer AS n FROM response_actions WHERE incident_id=$1',[incident.id])).rows[0].n,0);
  return true;
 }finally{await f.cleanup();}
}
async function main(){let pool;try{pool=createPool();await verifyNotifications(pool);
 console.log('Severity-aware in-app delivery, recipient isolation, duplicate suppression, read state, RBAC, auditing and atomic failure rollback verified. Synthetic changes cleaned up.');
 }catch(error){console.error('Task 23 notification verification failed. Check migrations, PostgreSQL and local quality checks. No credentials were printed.');process.exitCode=1;
 }finally{if(pool)await pool.end();}}
if(require.main===module)main();
module.exports={verifyNotifications};
