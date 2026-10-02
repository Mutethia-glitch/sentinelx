'use strict';
const {createHash,timingSafeEqual}=require('node:crypto');
const {AuthError}=require('../auth/errors');
const {readJson}=require('../api/auth-handler');
const {ISSUERS,normalizeEvidence}=require('./evidence-catalog');
const NAME=/^[a-z][a-z0-9-]{2,49}$/;
const HOST=/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
function evidenceFeedsConfig(env=process.env,tenant=null){
 const raw=env.SECURITY_EVIDENCE_FEEDS_JSON||'';
 if(!raw||raw==='[]')return null;
 if(!tenant?.id||raw.length>9000)throw new Error('Invalid security feed configuration.');
 let entries;try{entries=JSON.parse(raw);}catch{throw new Error('Invalid security feed configuration.');}
 if(!Array.isArray(entries)||entries.length<1||entries.length>12)throw new Error('Invalid security feed configuration.');
 const seenNames=new Set(),seenTokens=new Set();
 const feeds=entries.map(x=>{
  if(!x||typeof x!=='object'||Array.isArray(x)||
     Object.keys(x).sort().join(',')!=='host,issuer,name,token'||
     typeof x.name!=='string'||!NAME.test(x.name)||
     typeof x.host!=='string'||!HOST.test(x.host)||x.host.length>253||
     !ISSUERS.includes(x.issuer)||typeof x.token!=='string'||!/^[0-9a-f]{64}$/.test(x.token)||
     seenNames.has(x.name)||seenTokens.has(x.token))throw new Error('Invalid security feed configuration.');
  seenNames.add(x.name);seenTokens.add(x.token);
  return Object.freeze({tenantId:tenant.id,source:'evidence.'+x.name,host:x.host,issuer:x.issuer,
    digest:createHash('sha256').update(x.token).digest()});
 });
 return Object.freeze(feeds);
}
function selectFeed(header,feeds){
 const value=typeof header==='string'&&header.startsWith('Bearer ')?header.slice(7):'';
 const valid=/^[0-9a-f]{64}$/.test(value);
 const digest=createHash('sha256').update(valid?value:'').digest();
 let found=null;
 for(const feed of feeds||[])if(timingSafeEqual(digest,feed.digest))found=feed;
 return valid?found:null;
}
function evidenceHandler(feeds,repository,detector,managed=null){
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  const send=(status,payload)=>{res.statusCode=status;res.end(JSON.stringify(payload));};
  try{
   if((!feeds&&!managed)||req.url!=='/api/connectors/evidence'){req.resume();return send(404,{error:'Not found.'});}
   if(req.method!=='POST'){req.resume();res.setHeader('Allow','POST');return send(405,{error:'Method not allowed.'});}
   if(req.headers.origin){req.resume();return send(401,{error:'Trusted source authentication required.'});}
   const feed=selectFeed(req.headers.authorization,feeds)||
     (managed?await managed.byToken(typeof req.headers.authorization==='string'&&req.headers.authorization.startsWith('Bearer ')?req.headers.authorization.slice(7):''):null);
   if(!feed){req.resume();return send(401,{error:'Trusted source authentication required.'});}
   const input=await readJson(req);
   const event=normalizeEvidence(input,feed);
   const saved=await repository.create(event,null,async(persisted,db)=>{
     if(feed.registryId)await managed.markReporting(db,feed.registryId);
     await detector.evaluate(persisted,db);
   },
     {source:feed.source,externalId:input.eventId});
   return send(200,{eventId:saved.id,accepted:true});
  }catch(error){
   req.resume();const expected=error instanceof AuthError;
   return send(expected?error.status:503,{error:expected?error.message:'Trusted security ingestion unavailable.'});
  }
 };
}
module.exports={evidenceFeedsConfig,selectFeed,evidenceHandler};
