const { AuthError } = require('../auth/errors');
const { cookieToken, readJson, sessionCookie } = require('./auth-handler');
function incidentHandler(service, config) {
  return async (req, res) => {
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Type','application/json; charset=utf-8');
    const send=(status,body)=>{res.statusCode=status;res.end(JSON.stringify(body));};
    try {
      const url=new URL(req.url,'http://localhost');
      const detail=/^\/api\/incidents\/([0-9a-f-]+)$/i.exec(url.pathname);
      const assignment=/^\/api\/incidents\/([0-9a-f-]+)\/assignment$/i.exec(url.pathname);
      const assessment=/^\/api\/incidents\/([0-9a-f-]+)\/assessment$/i.exec(url.pathname);
      const status=/^\/api\/incidents\/([0-9a-f-]+)\/status$/i.exec(url.pathname);
      const base=url.pathname==='/api/incidents';
      if(!base&&!detail&&!assignment&&!assessment&&!status){req.resume();return send(404,{error:'Not found.'});}
      const allowed=base?['GET','POST']:detail?['GET']:['PATCH'];
      if(!allowed.includes(req.method)){req.resume();res.setHeader('Allow',allowed.join(', '));return send(405,{error:'Method not allowed.'});}
      const token=cookieToken(req.headers.cookie,config.cookieName);
      if(req.method==='GET'){
        if(detail){if(url.search)throw new AuthError(400,'Invalid incident filters.');return send(200,{incident:await service.inspect(token,detail[1])});}
        return send(200,await service.list(token,url.searchParams));
      }
      if(req.headers.origin!==config.origin){req.resume();throw new AuthError(403,'Request origin rejected.');}
      await service.authorizeWrite(token);
      if(url.search)throw new AuthError(400,'Invalid incident filters.');
      const body=await readJson(req);
      if(base)return send(201,{incident:await service.create(token,body)});
      if(assignment)return send(200,{incident:await service.assign(token,assignment[1],body)});
      if(assessment)return send(200,{incident:await service.assess(token,assessment[1],body)});
      return send(200,{incident:await service.updateStatus(token,status[1],body)});
    } catch(error) {
      req.resume();const expected=error instanceof AuthError;const code=expected?error.status:503;
      if(code===401)res.setHeader('Set-Cookie',sessionCookie('',config,true));
      return send(code,{error:expected?error.message:'Incident management temporarily unavailable.'});
    }
  };
}
module.exports={incidentHandler};
