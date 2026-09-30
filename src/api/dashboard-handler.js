const {AuthError}=require('../auth/errors');
const {cookieToken,sessionCookie}=require('./auth-handler');
function dashboardHandler(service,config){
  return async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Type','application/json; charset=utf-8');
    const send=(status,body)=>{res.statusCode=status;res.end(JSON.stringify(body));};
    try{
      const url=new URL(req.url,'http://localhost');
      if(url.pathname!=='/api/dashboard'){req.resume();return send(404,{error:'Not found.'});}
      if(req.method!=='GET'){req.resume();res.setHeader('Allow','GET');return send(405,{error:'Method not allowed.'});}
      if(url.search){req.resume();throw new AuthError(400,'Dashboard does not accept filters.');}
      return send(200,{dashboard:await service.snapshot(cookieToken(req.headers.cookie,config.cookieName))});
    }catch(error){
      req.resume();const expected=error instanceof AuthError,status=expected?error.status:503;
      if(status===401)res.setHeader('Set-Cookie',sessionCookie('',config,true));
      return send(status,{error:expected?error.message:'Dashboard temporarily unavailable.'});
    }
  };
}
module.exports={dashboardHandler};
