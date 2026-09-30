const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const { alertHandler }=require('../../src/api/alert-handler');
const { AuthError }=require('../../src/auth/errors');

test('alert HTTP routes enforce methods, origin and Viewer mutation denial',async t=>{
  const id='11111111-1111-4111-8111-111111111111';
  let updated=0;
  const service={
    list:async()=>({alerts:[],page:1,pageSize:50,hasMore:false}),
    inspect:async()=>({id}),
    authorizeWrite:async token=>{if(token==='viewer')throw new AuthError(403,'Permission denied.');},
    updateStatus:async(token,value,body)=>{updated++;return{id:value,status:body.status};},
  };
  const config={cookieName:'sid',origin:'http://bad',sessionSeconds:3600,secureCookie:false};
  const server=http.createServer(alertHandler(service,config));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const base=`http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base+'/api/alerts')).status,200);
  assert.equal((await fetch(base+`/api/alerts/${id}`)).status,200);
  assert.equal((await fetch(base+`/api/alerts/${id}/status`)).status,405);
  assert.equal((await fetch(base+`/api/alerts/${id}/status`,{method:'PATCH',headers:{Cookie:'sid=analyst','Content-Type':'application/json'},body:'{}'})).status,403);
  config.origin=base;
  assert.equal((await fetch(base+`/api/alerts/${id}/status`,{method:'PATCH',headers:{Cookie:'sid=viewer',Origin:base,'Content-Type':'application/json'},body:JSON.stringify({status:'ACKNOWLEDGED',reason:'x'})})).status,403);
  assert.equal((await fetch(base+`/api/alerts/${id}/status`,{method:'PATCH',headers:{Cookie:'sid=analyst',Origin:base,'Content-Type':'application/json'},body:JSON.stringify({status:'ACKNOWLEDGED',reason:'x'})})).status,200);
  assert.equal(updated,1);
});
