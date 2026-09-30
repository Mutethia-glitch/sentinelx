const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {EventEmitter}=require('node:events');
const {AuthError}=require('../../src/auth/errors');
const {accessHandler}=require('../../src/api/access-handler');
const {apiRateLimiter,apiSecurityBoundary,MAX_REQUEST_TARGET_BYTES}=require('../../src/api/security');

function request({url='/api/test',method='GET',headers={},address='127.0.0.1'}={}){
 const req=new EventEmitter();req.url=url;req.method=method;req.headers=headers;req.socket={remoteAddress:address};req.resume=()=>{req.resumed=true;};return req;
}
function response(){return {headers:{},setHeader(name,value){this.headers[name.toLowerCase()]=String(value);},end(body){this.body=body;this.ended=true;}};}

test('API limiter applies per socket IP and keeps mutations tighter',()=>{
 let time=0;const limiter=apiRateLimiter({now:()=>time,windowMs:1000,requestLimit:4,mutationLimit:2,maxKeys:10});
 limiter.check('127.0.0.1','POST');limiter.check('127.0.0.1','POST');
 assert.throws(()=>limiter.check('127.0.0.1','POST'),error=>error.status===429);
 limiter.check('127.0.0.2','GET');time=1001;assert.doesNotThrow(()=>limiter.check('127.0.0.1','POST'));
});

test('forwarding headers do not create a new API limiter identity',()=>{
 const limiter=apiRateLimiter({windowMs:1000,requestLimit:1,mutationLimit:1,maxKeys:10});
 const boundary=apiSecurityBoundary({limiter});
 const first=request({headers:{'x-forwarded-for':'198.51.100.1'}}),firstRes=response();assert.equal(boundary(first,firstRes),false);
 const second=request({headers:{'x-forwarded-for':'203.0.113.2'}}),secondRes=response();assert.equal(boundary(second,secondRes),true);assert.equal(secondRes.statusCode,429);
});

test('API boundary rejects ambiguous or oversized targets and read bodies',()=>{
 const boundary=apiSecurityBoundary({limiter:apiRateLimiter({requestLimit:20,mutationLimit:10})});
 for(const req of [request({url:'/api/test#fragment'}),request({url:'/api\\test'}),request({url:'/api/'+ 'x'.repeat(MAX_REQUEST_TARGET_BYTES)}),request({headers:{'content-length':'1'}})]){
  const res=response();assert.equal(boundary(req,res),true);assert.ok([400,414].includes(res.statusCode));assert.equal(req.resumed,true);assert.doesNotMatch(res.body,/stack|secret|token/i);
 }
});

test('API boundary adds uniform safe response headers without handling valid requests',()=>{
 const boundary=apiSecurityBoundary({limiter:apiRateLimiter({requestLimit:20,mutationLimit:10})});
 const req=request(),res=response();assert.equal(boundary(req,res),false);assert.equal(res.headers['cache-control'],'no-store');assert.equal(res.headers['x-content-type-options'],'nosniff');assert.equal(res.headers['referrer-policy'],'no-referrer');assert.equal(res.headers['cross-origin-resource-policy'],'same-origin');assert.equal(res.ended,undefined);
});

async function withServer(service,run){
 const config={origin:'http://localhost:3000',cookieName:'sentinelx_session',sessionSeconds:3600,secureCookie:false};
 const boundary=apiSecurityBoundary({limiter:apiRateLimiter({requestLimit:50,mutationLimit:20})});
 const handler=accessHandler(service,config);
 const server=http.createServer((req,res)=>{if(boundary(req,res))return;handler(req,res);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{return await run(`http://127.0.0.1:${server.address().port}`);}
 finally{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
}

test('protected access routes fail closed and internal errors stay sanitized',async()=>{
 let mutationCalled=false;
 await withServer({
  me:async()=>{throw new AuthError(401,'Authentication required.');},
  roles:async()=>{throw new AuthError(401,'Authentication required.');},
  users:async()=>{throw new Error('private database secret token');},
  setRoles:async()=>{mutationCalled=true;}
 },async base=>{
  let result=await fetch(base+'/api/access/me');assert.equal(result.status,401);assert.deepEqual(await result.json(),{error:'Authentication required.'});
  result=await fetch(base+'/api/access/users');assert.equal(result.status,503);const body=await result.text();assert.equal(body.includes('private database'),false);
  result=await fetch(base+'/api/access/users/11111111-1111-4111-8111-111111111111/roles',{method:'PUT',headers:{Origin:'http://evil.invalid','Content-Type':'application/json'},body:'{}'});
  assert.equal(result.status,403);assert.equal(mutationCalled,false);
 });
});
