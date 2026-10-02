'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {accessHandler}=require('../../src/api/access-handler');
const {accessService}=require('../../src/access/service');
const {AuthError}=require('../../src/auth/errors');
test('integration readiness route enforces backend Administrator access and has read-only method',async t=>{
 const config={cookieName:'sid',origin:'http://127.0.0.1:4000'};
 const auth={async currentUser(token){
  if(!token)throw new AuthError(401,'Authentication required.');
  return{id:token};
 }};
 const roles={async rolesForUser(id){return id==='admin'?['Administrator']:['Viewer/Management'];}};
 const coverage={async list(){return{categories:[{categoryCode:'RECONNAISSANCE',state:'SOURCE_REQUIRED'}]};}};
 const service=accessService(roles,auth,{integrationCoverage:coverage});
 const server=http.createServer(accessHandler(service,config));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 const base='http://127.0.0.1:'+server.address().port;
 const call=(cookie,method='GET')=>fetch(base+'/api/access/integrations',{
  method,headers:cookie?{Cookie:'sid='+cookie}:{}});
 assert.equal((await call()).status,401);
 assert.equal((await call('viewer')).status,403);
 const valid=await call('admin');
 assert.equal(valid.status,200);
 const body=await valid.json();
 assert.equal(body.categories[0].categoryCode,'RECONNAISSANCE');
 assert.equal((await call('admin','POST')).status,405);
});
