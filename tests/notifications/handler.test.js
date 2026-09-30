const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {notificationHandler}=require('../../src/api/notification-handler');
const ID='11111111-1111-4111-8111-111111111111';
test('notification HTTP endpoints enforce origin, method and recipient flow',async()=>{
 const called=[];
 const service={
  list:async()=>{called.push('list');return{notifications:[],unreadCount:0};},
  authorizeSend:async token=>{if(!token)throw Object.assign(new Error('Auth required'),{status:401});},
  send:async()=>{called.push('send');return{delivered:true,notification:{id:ID}};},
  markRead:async()=>{called.push('read');return{changed:true};}
 };
 const cfg={origin:'http://localhost',cookieName:'sid',sessionSeconds:600};
 const server=http.createServer(notificationHandler(service,cfg));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const body={recipientId:ID,incidentId:ID,alertId:null,reason:'Review'};
 try{
  let r=await fetch(base+'/api/notifications',{headers:{Cookie:'sid=ok'}});assert.equal(r.status,200);
  r=await fetch(base+'/api/notifications',{method:'PATCH',headers:{Cookie:'sid=ok',Origin:cfg.origin,'Content-Type':'application/json'},body:'{}'});assert.equal(r.status,405);
  r=await fetch(base+'/api/notifications',{method:'POST',headers:{Cookie:'sid=ok',Origin:'http://untrusted.example','Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,403);
  r=await fetch(base+'/api/notifications',{method:'POST',headers:{Cookie:'sid=ok',Origin:cfg.origin,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,201);
  r=await fetch(base+'/api/notifications/'+ID+'/read',{method:'PATCH',headers:{Cookie:'sid=ok',Origin:cfg.origin,'Content-Type':'application/json'},body:'{}'});assert.equal(r.status,200);
  r=await fetch(base+'/api/notifications/'+ID+'/read?x=1',{method:'PATCH',headers:{Cookie:'sid=ok',Origin:cfg.origin,'Content-Type':'application/json'},body:'{}'});assert.equal(r.status,400);
  assert.deepEqual(called,['list','send','read']);
 }finally{await new Promise(r=>server.close(r));}
});
