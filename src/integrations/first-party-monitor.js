'use strict';
const {randomUUID}=require('node:crypto');
const {isIP}=require('node:net');

// First-party observations are derived from completed SentinelX responses, not
// from attacker-supplied descriptions of an attack. No request body, full URL,
// email, user agent, cookie, authorization header or OTP is retained.
const PATH_PROBE=/^\/api\/(?:\.env(?:\/|$)|\.git(?:\/|$)|wp-admin(?:\/|$)|phpmyadmin(?:\/|$)|adminer(?:\/|$))/i;
function firstPartyMonitor(repository,detector,config,{now=Date.now,limit=10,windowMs=60000,maxKeys=2048}={}){
 if(!config?.tenant?.id||!config?.origin||!Number.isInteger(limit)||limit<1||
    !Number.isInteger(windowMs)||windowMs<1000||!Number.isInteger(maxKeys)||maxKeys<1)
   throw new Error('Invalid first-party monitoring configuration.');
 const buckets=new Map();
 const host=new URL(config.origin).hostname;
 function sample(key){
  const t=now();
  for(const [id,bucket] of buckets)if(bucket.expiry<=t)buckets.delete(id);
  let bucket=buckets.get(key);
  if(!bucket){
   if(buckets.size>=maxKeys)return false;
   bucket={count:0,expiry:t+windowMs};
   buckets.set(key,bucket);
  }
  return ++bucket.count<=limit;
 }
 function classify(req,res){
  const raw=req.url;
  if(typeof raw!=='string'||!raw.startsWith('/api/'))return null;
  const path=raw.split('?',1)[0];
  // A rejected invalid password is a directly observed application outcome.
  if(path==='/api/auth/login'&&req.method==='POST'&&res.statusCode===401)
   return{signal:'password_login_rejected',categoryCode:'BRUTE_FORCE',
     type:'authentication',action:'login',status:'failed',severity:'LOW'};
  // An actual limiter rejection, not proof of DoS or credential compromise.
  if(res.statusCode===429)
   return{signal:'api_request_throttled',categoryCode:null,
     type:'api_request',action:'rate_limit',status:'blocked',severity:'LOW'};
  // These *specific* rejected API targets are low-confidence discovery
  // indicators. Ordinary missing resources and harmless typos are excluded.
  if(req.method==='GET'&&res.statusCode===404&&PATH_PROBE.test(path))
   return{signal:'known_probe_route_rejected',categoryCode:'RECONNAISSANCE',
     type:'reconnaissance',action:'probe',status:'rejected',severity:'LOW'};
  return null;
 }
 function observe(req,res){
  if(typeof req.url!=='string'||!req.url.startsWith('/api/'))return;
  res.once('finish',()=>{
   const verdict=classify(req,res);
   if(!verdict)return;
   const address=req.sentinelxClientAddress||req.socket?.remoteAddress||null;
   const sourceIp=typeof address==='string'&&isIP(address)?address:null;
   if(!sample((sourceIp||'unknown')+':'+verdict.signal))return;
   const evidenceRef='sentinelx.response:'+randomUUID();
   const event={
    timestamp:new Date(now()).toISOString(),
    source:'sentinelx-internal',type:verdict.type,sourceIp,destinationIp:null,
    user:null,host,action:verdict.action,status:verdict.status,severity:verdict.severity,
    rawData:{signal:verdict.signal,evidenceRef},
    metadata:{issuer:'sentinelx-runtime',tenantId:config.tenant.id,
      ...(verdict.categoryCode?{categoryCode:verdict.categoryCode}:{}),
      evidenceRef,classification:'observed-http-outcome',
      ipAttribution:'trusted-proxy-or-connection',sourceContract:'sentinelx-self-v1'}
   };
   // Best effort; the original response and rate limits are never changed.
   void Promise.resolve().then(()=>repository.create(event,null,async(saved,db)=>{
    if(detector)await detector.evaluate(saved,db);
   })).catch(()=>{});
  });
 }
 return{observe};
}
module.exports={firstPartyMonitor,PATH_PROBE};
