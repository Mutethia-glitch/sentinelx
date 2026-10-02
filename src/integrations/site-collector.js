'use strict';
const {AuthError}=require('../auth/errors');
const {readJson}=require('../api/auth-handler');
const {normalizeEvidence}=require('./evidence-catalog');
function siteCollectorHandler(websites,repository,detector,tenantId){
 return async(req,res)=>{
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  const send=(status,payload)=>{res.statusCode=status;res.end(JSON.stringify(payload));};
  try{
   if(req.url!=='/api/connectors/site-events'){req.resume();return send(404,{error:'Not found.'});}
   if(req.method!=='POST'){req.resume();res.setHeader('Allow','POST');return send(405,{error:'Method not allowed.'});}
   if(req.headers.origin){req.resume();return send(401,{error:'Company website connector authentication required.'});}
   const auth=req.headers.authorization||'';
   const token=typeof auth==='string'&&auth.startsWith('Bearer ')?auth.slice(7):'';
   const site=await websites.byToken(token);
   if(!site){req.resume();return send(401,{error:'Company website connector authentication required.'});}
   const input=await readJson(req);
   const event=normalizeEvidence(input,{
     tenantId,source:'site.'+site.id,host:site.host,issuer:'application'
   });
   const saved=await repository.create(event,null,async(persisted,db)=>{
    await websites.markReporting(db,site.id);await detector.evaluate(persisted,db);
   },{source:'site.'+site.id,externalId:input.eventId});
   return send(200,{accepted:true,eventId:saved.id});
  }catch(error){
   req.resume();const expected=error instanceof AuthError;
   return send(expected?error.status:503,{error:expected?error.message:'Website connector temporarily unavailable.'});
  }
 };
}
module.exports={siteCollectorHandler};
