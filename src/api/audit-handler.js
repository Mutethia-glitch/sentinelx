const {AuthError}=require('../auth/errors');
const {cookieToken,sessionCookie}=require('./auth-handler');
function auditHandler(service,config){return async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Type','application/json; charset=utf-8');
 const send=(status,body)=>{res.statusCode=status;res.end(JSON.stringify(body));};
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname!=='/api/audit'){req.resume();return send(404,{error:'Not found.'});}
  if(req.method!=='GET'){req.resume();res.setHeader('Allow','GET');return send(405,{error:'Method not allowed.'});}
  return send(200,await service.list(cookieToken(req.headers.cookie,config.cookieName),url.searchParams));
 }catch(error){req.resume();const expected=error instanceof AuthError,status=expected?error.status:503;if(status===401)res.setHeader('Set-Cookie',sessionCookie('',config,true));return send(status,{error:expected?error.message:'Audit trail temporarily unavailable.'});}
};}
module.exports={auditHandler};
