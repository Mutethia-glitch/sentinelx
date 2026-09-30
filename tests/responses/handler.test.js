const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {responseHandler}=require('../../src/api/response-handler');
const ID='11111111-1111-4111-8111-111111111111';
const data={action:'CONTAINMENT',reason:'Approved',details:'Manual containment succeeded.',succeeded:true,containmentPerformed:true};
test('response HTTP API applies read/write method and origin boundaries',async()=>{
 const config={origin:'http://localhost',cookieName:'sid',sessionSeconds:600},calls=[];
 const service={
   list:async(token,id,params)=>{calls.push('read');return{actions:[],page:1,hasMore:false};},
   authorizeWrite:async token=>{if(!token)throw Object.assign(new Error('Authentication required.'),{status:401});return{id:ID};},
   record:async(token,id,body)=>{calls.push('write');return{id:ID,action:body.action};},
 };
 const server=http.createServer(responseHandler(service,config));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  const url=base+'/api/responses/'+ID;
  let response=await fetch(url,{headers:{Cookie:'sid=ok'}});
  assert.equal(response.status,200);
  response=await fetch(url,{method:'POST',headers:{Cookie:'sid=ok',Origin:config.origin,'Content-Type':'application/json'},body:JSON.stringify(data)});
  assert.equal(response.status,405);
  response=await fetch(url+'/actions',{method:'POST',headers:{Cookie:'sid=ok',Origin:'http://untrusted.example','Content-Type':'application/json'},body:JSON.stringify(data)});
  assert.equal(response.status,403);
  response=await fetch(url+'/actions',{method:'POST',headers:{Cookie:'sid=ok',Origin:config.origin,'Content-Type':'application/json'},body:JSON.stringify(data)});
  assert.equal(response.status,201);
  response=await fetch(url+'/actions?extra=1',{method:'POST',headers:{Cookie:'sid=ok',Origin:config.origin,'Content-Type':'application/json'},body:JSON.stringify(data)});
  assert.equal(response.status,400);
  assert.deepEqual(calls,['read','write']);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
