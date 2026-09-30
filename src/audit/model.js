const {AuthError}=require('../auth/errors');
const {timestamp}=require('../events/model');
const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
function auditQuery(params){
 if(!(params instanceof URLSearchParams)||params.toString().length>4096)throw new AuthError(400,'Invalid audit filters.');
 const allowed=new Set(['actorId','action','targetType','targetId','from','to','page']);
 const out={page:1};
 for(const [key,raw] of params){
  if(!allowed.has(key)||params.getAll(key).length!==1||!raw||!raw.trim()||raw.includes('\0'))throw new AuthError(400,'Invalid audit filters.');
  const value=raw.trim();
  if(key==='page'){if(!/^[1-9][0-9]{0,3}$/.test(value)||Number(value)>2000)throw new AuthError(400,'Invalid audit filters.');out.page=Number(value);}
  else if(key==='actorId'||key==='targetId'){if(!UUID.test(value))throw new AuthError(400,'Invalid audit identifier.');out[key]=value;}
  else if(key==='from'||key==='to'){try{out[key]=timestamp(value);}catch{throw new AuthError(400,'Invalid audit date range.');}}
  else {if(value.length>200)throw new AuthError(400,'Invalid audit filters.');out[key]=value;}
 }
 if(out.from&&out.to&&out.from>out.to)throw new AuthError(400,'Invalid audit date range.');
 return out;
}
module.exports={auditQuery};
