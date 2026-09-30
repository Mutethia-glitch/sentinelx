const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {dashboardHandler}=require('../../src/api/dashboard-handler');
const {AuthError}=require('../../src/auth/errors');
test('dashboard HTTP route is authenticated, read-only and rejects arbitrary filter parameters',async()=>{
 const calls=[],config={cookieName:'sid',origin:'http://localhost',sessionSeconds:600};
 const service={snapshot:async token=>{
  if(!token)throw new AuthError(401,'Authentication required.');
  calls.push(token);return{totals:{eventsTotal:3}};
 }};
 const server=http.createServer(dashboardHandler(service,config));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  let r=await fetch(base+'/api/dashboard');
  assert.equal(r.status,401);
  r=await fetch(base+'/api/dashboard',{headers:{Cookie:'sid=ok'}});
  assert.equal(r.status,200);
  assert.equal((await r.json()).dashboard.totals.eventsTotal,3);
  assert.equal(r.headers.get('cache-control'),'no-store');
  r=await fetch(base+'/api/dashboard?days=30',{headers:{Cookie:'sid=ok'}});
  assert.equal(r.status,400);
  r=await fetch(base+'/api/dashboard',{method:'POST',headers:{Cookie:'sid=ok'}});
  assert.equal(r.status,405);
  assert.deepEqual(calls,['ok']);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
