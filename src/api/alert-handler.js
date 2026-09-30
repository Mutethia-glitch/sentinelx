const { AuthError } = require('../auth/errors');
const { cookieToken, readJson, sessionCookie } = require('./auth-handler');
function alertHandler(service, config) {
  return async (req, res) => {
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Type','application/json; charset=utf-8');
    const send=(status,body)=>{res.statusCode=status;res.end(JSON.stringify(body));};
    try {
      const url=new URL(req.url,'http://localhost');
      const detail=/^\/api\/alerts\/([0-9a-f-]+)$/i.exec(url.pathname);
      const status=/^\/api\/alerts\/([0-9a-f-]+)\/status$/i.exec(url.pathname);
      const base=url.pathname==='/api/alerts';
      if(!base&&!detail&&!status){req.resume();return send(404,{error:'Not found.'});}
      const allowed=base||detail?['GET']:['PATCH'];
      if(!allowed.includes(req.method)){req.resume();res.setHeader('Allow',allowed.join(', '));return send(405,{error:'Method not allowed.'});}
      const token=cookieToken(req.headers.cookie,config.cookieName);
      if(req.method==='GET'){
        if(detail){
          if(url.search) throw new AuthError(400,'Invalid alert filters.');
          return send(200,{alert:await service.inspect(token,detail[1])});
        }
        return send(200,await service.list(token,url.searchParams));
      }
      if(req.headers.origin!==config.origin){req.resume();throw new AuthError(403,'Request origin rejected.');}
      await service.authorizeWrite(token);
      if(url.search) throw new AuthError(400,'Invalid alert filters.');
      const body=await readJson(req);
      return send(200,{alert:await service.updateStatus(token,status[1],body)});
    } catch(error) {
      req.resume();
      const expected=error instanceof AuthError;
      const code=expected?error.status:503;
      if(code===401)res.setHeader('Set-Cookie',sessionCookie('',config,true));
      return send(code,{error:expected?error.message:'Alert management temporarily unavailable.'});
    }
  };
}
module.exports={alertHandler};
