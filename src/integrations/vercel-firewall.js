'use strict';
const {createHmac,timingSafeEqual}=require('node:crypto');
const {AuthError}=require('../auth/errors');
const {securityEvent}=require('../events/model');

const SOURCE='vercel-firewall';
const MAX_BODY_BYTES=262144;
const MAX_RECORDS=50;
const MAX_AGE_MS=15*60*1000;
const ACTIONS=new Set(['sql_injection','xss','path_traversal','command_injection']);
const IDENTIFIER=/^[A-Za-z0-9][A-Za-z0-9_.:-]{2,127}$/;
const HOST=/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

function vercelFirewallConfig(env=process.env,tenant=null){
 const keys=['VERCEL_FIREWALL_DRAIN_SECRET','VERCEL_FIREWALL_PROJECT_ID',
  'VERCEL_FIREWALL_HOST','VERCEL_FIREWALL_RULE_MAP'];
 if(keys.every(k=>!env[k]))return null; // Disabled until the operator provides the complete source contract.
 if(!tenant?.id||keys.some(k=>typeof env[k]!=='string'||!env[k].trim()))throw new Error('Incomplete Vercel firewall source configuration.');
 const secret=env.VERCEL_FIREWALL_DRAIN_SECRET;
 const projectId=env.VERCEL_FIREWALL_PROJECT_ID;
 const host=env.VERCEL_FIREWALL_HOST;
 if(secret.length<32||secret.length>512||!IDENTIFIER.test(projectId)||!HOST.test(host)||host.length>253)
  throw new Error('Invalid Vercel firewall source configuration.');
 let parsed;
 try{parsed=JSON.parse(env.VERCEL_FIREWALL_RULE_MAP);}catch{throw new Error('Invalid Vercel firewall rule mapping.');}
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||Object.keys(parsed).length<1||Object.keys(parsed).length>20)
  throw new Error('Invalid Vercel firewall rule mapping.');
 const rules=Object.create(null);
 for(const [ruleId,categoryAction] of Object.entries(parsed)){
  if(!IDENTIFIER.test(ruleId)||!ACTIONS.has(categoryAction))throw new Error('Invalid Vercel firewall rule mapping.');
  rules[ruleId]=categoryAction;
 }
 return Object.freeze({tenantId:tenant.id,source:SOURCE,host,projectId,
  secret,rules:Object.freeze(rules)});
}
function validSignature(raw,header,secret){
 if(typeof header!=='string'||!/^[a-fA-F0-9]{40}$/.test(header))return false;
 const expected=createHmac('sha1',secret).update(raw).digest();
 const actual=Buffer.from(header,'hex');
 return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
async function rawBody(req){
 const length=req.headers['content-length'];
 if(length!==undefined&&(!/^\d+$/.test(length)||Number(length)>MAX_BODY_BYTES)){
  req.resume();throw new AuthError(413,'Firewall batch exceeds allowed size.');
 }
 const parts=[];let total=0,oversize=false;
 for await(const chunk of req){
  total+=chunk.length;
  if(total>MAX_BODY_BYTES){oversize=true;continue;}
  parts.push(chunk);
 }
 if(oversize)throw new AuthError(413,'Firewall batch exceeds allowed size.');
 return Buffer.concat(parts,total);
}
function selectFirewallEvent(log,config,now=Date.now()){
 // Only an explicitly attributed and denied firewall rule can become web attack evidence.
 // No client request text (message, path, query, URL, user-agent, referer) is retained.
 if(!log||typeof log!=='object'||Array.isArray(log))throw new AuthError(400,'Invalid firewall batch.');
 if(log.projectId!==config.projectId||log.host!==config.host||
    (log.environment!==undefined&&log.environment!=='production'))return null;
 const proxy=log.proxy;
 if(log.source!=='firewall'||!proxy||typeof proxy!=='object'||Array.isArray(proxy)||
    proxy.host!==config.host||proxy.wafAction!=='deny'||
    typeof proxy.wafRuleId!=='string'||!Object.hasOwn(config.rules,proxy.wafRuleId)||
    (proxy.statusCode!==undefined&&proxy.statusCode!==403))return null;
 if(typeof log.id!=='string'||!IDENTIFIER.test(log.id)||
    typeof log.deploymentId!=='string'||!IDENTIFIER.test(log.deploymentId)||
    !Number.isSafeInteger(log.timestamp)||Math.abs(now-log.timestamp)>MAX_AGE_MS)
  throw new AuthError(400,'Invalid firewall evidence.');
 const categoryAction=config.rules[proxy.wafRuleId];
 const event=securityEvent({
  timestamp:new Date(log.timestamp).toISOString(),source:SOURCE,type:'web_application',
  action:categoryAction,status:'blocked',severity:'MEDIUM',
  sourceIp:null,destinationIp:null,user:null,host:config.host,
  rawData:{provider:'vercel',decision:'deny',ruleId:proxy.wafRuleId,
    projectId:config.projectId,deploymentId:log.deploymentId,logId:log.id},
  metadata:{provider:'vercel',tenantId:config.tenantId,sourceContract:'vercel-log-drain-v1',
    mappedRuleId:proxy.wafRuleId,evidence:'signed-firewall-denial',
    classificationBasis:'operator-approved-specific-waf-rule',
    ipRedacted:true}
 });
 return{event,externalId:config.projectId+':'+log.id};
}
function vercelFirewallHandler(config,repository,detector){
 return async(req,res)=>{
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  const send=(status,body)=>{res.statusCode=status;res.end(JSON.stringify(body));};
  try{
   if(!config||req.url!=='/api/connectors/vercel-firewall'){req.resume();return send(404,{error:'Not found.'});}
   if(req.method!=='POST'){req.resume();res.setHeader('Allow','POST');return send(405,{error:'Method not allowed.'});}
   if(req.headers.origin||!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type']||'')){
    req.resume();return send(415,{error:'Signed JSON firewall drain required.'});
   }
   const raw=await rawBody(req);
   if(!validSignature(raw,req.headers['x-vercel-signature'],config.secret))return send(403,{error:'Firewall drain signature rejected.'});
   let logs;
   try{logs=JSON.parse(raw.toString('utf8'));}catch{throw new AuthError(400,'Invalid firewall batch.');}
   if(!Array.isArray(logs)||logs.length<1||logs.length>MAX_RECORDS)throw new AuthError(400,'Invalid firewall batch.');
   // Verify entire batch before writing anything; malformed signed records do not partially ingest.
   const selected=logs.map(log=>selectFirewallEvent(log,config)).filter(Boolean);
   let ingested=0;
   for(const item of selected){
    await repository.create(item.event,null,async(saved,client)=>detector.evaluate(saved,client),
      {source:SOURCE,externalId:item.externalId});
    ingested++;
   }
   return send(200,{accepted:true,processed:ingested,ignored:logs.length-selected.length});
  }catch(error){
   req.resume();
   return send(error instanceof AuthError?error.status:503,
     {error:error instanceof AuthError?error.message:'Firewall ingestion temporarily unavailable.'});
  }
 };
}
module.exports={SOURCE,MAX_BODY_BYTES,MAX_RECORDS,vercelFirewallConfig,validSignature,
 selectFirewallEvent,vercelFirewallHandler};
