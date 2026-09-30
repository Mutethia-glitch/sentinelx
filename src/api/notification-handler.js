const {AuthError}=require('../auth/errors');
const {cookieToken,readJson,sessionCookie}=require('./auth-handler');
function notificationHandler(service,config){
  return async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Type','application/json; charset=utf-8');
    const send=(status,body)=>{res.statusCode=status;res.end(JSON.stringify(body));};
    try{
      const url=new URL(req.url,'http://localhost');
      const inbox=url.pathname==='/api/notifications';
      const read=/^\/api\/notifications\/([0-9a-f-]+)\/read$/i.exec(url.pathname);
      if(!inbox&&!read){req.resume();return send(404,{error:'Not found.'});}
      const allowed=inbox?['GET','POST']:['PATCH'];
      if(!allowed.includes(req.method)){req.resume();res.setHeader('Allow',allowed.join(', '));return send(405,{error:'Method not allowed.'});}
      const token=cookieToken(req.headers.cookie,config.cookieName);
      if(req.method==='GET')return send(200,await service.list(token,url.searchParams));
      if(req.headers.origin!==config.origin){req.resume();throw new AuthError(403,'Request origin rejected.');}
      if(inbox)await service.authorizeSend(token);
      if(url.search){req.resume();throw new AuthError(400,'Invalid notification request.');}
      const body=await readJson(req);
      if(inbox){const result=await service.send(token,body);return send(result.delivered?201:200,result);}
      return send(200,await service.markRead(token,read[1],body));
    }catch(error){
      req.resume();const expected=error instanceof AuthError,status=expected?error.status:503;
      if(status===401)res.setHeader('Set-Cookie',sessionCookie('',config,true));
      return send(status,{error:expected?error.message:'Notification delivery temporarily unavailable.'});
    }
  };
}
module.exports={notificationHandler};
