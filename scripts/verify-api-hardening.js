const assert=require('node:assert/strict');
const {AuthError}=require('../src/auth/errors');
const {accessHandler}=require('../src/api/access-handler');
const {apiRateLimiter,apiSecurityBoundary}=require('../src/api/security');

function request({url='/api/test',method='GET',headers={},address='127.0.0.1'}={}){
 const req={url,method,headers,socket:{remoteAddress:address},resume(){this.resumed=true;}};
 return req;
}
function response(){return {headers:{},setHeader(name,value){this.headers[name.toLowerCase()]=String(value);},end(body){this.body=body;this.ended=true;}};}

async function main(){
 let time=0;
 const limiter=apiRateLimiter({now:()=>time,windowMs:1000,requestLimit:3,mutationLimit:1,maxKeys:10});
 limiter.check('127.0.0.1','POST');
 assert.throws(()=>limiter.check('127.0.0.1','POST'),error=>error.status===429);
 time=1001;assert.doesNotThrow(()=>limiter.check('127.0.0.1','POST'));

 const boundary=apiSecurityBoundary({limiter:apiRateLimiter({requestLimit:10,mutationLimit:5})});
 let req=request({url:'/api/test#fragment'}),res=response();assert.equal(boundary(req,res),true);assert.equal(res.statusCode,414);
 req=request({headers:{'content-length':'1'}});res=response();assert.equal(boundary(req,res),true);assert.equal(res.statusCode,400);
 req=request();res=response();assert.equal(boundary(req,res),false);assert.equal(res.headers['cache-control'],'no-store');assert.equal(res.headers['referrer-policy'],'no-referrer');

 const config={origin:'http://localhost:3000',cookieName:'sentinelx_session',sessionSeconds:3600,secureCookie:false};
 let called=false;
 const handler=accessHandler({
  me:async()=>{throw new AuthError(401,'Authentication required.');},
  roles:async()=>{throw new AuthError(401,'Authentication required.');},
  users:async()=>{throw new Error('private database detail');},
  setRoles:async()=>{called=true;}
 },config);
 req=request({url:'/api/access/me'});res=response();await handler(req,res);assert.equal(res.statusCode,401);
 req=request({url:'/api/access/users'});res=response();await handler(req,res);assert.equal(res.statusCode,503);assert.equal(res.body.includes('private database'),false);
 req=request({url:'/api/access/users/11111111-1111-4111-8111-111111111111/roles',method:'PUT',headers:{origin:'http://evil.invalid'}});res=response();await handler(req,res);assert.equal(res.statusCode,403);assert.equal(called,false);

 console.log('Shared API rate limits, request-target/body guards, safe headers, authorization rejection and sanitized failures verified.');
}
if(require.main===module)main().catch(()=>{console.error('Task 35 API hardening verification failed. No credentials or internal error details were printed.');process.exitCode=1;});
module.exports={main};
