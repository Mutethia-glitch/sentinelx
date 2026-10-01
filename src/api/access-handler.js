const { AuthError } = require('../auth/errors');
const { cookieToken, sessionCookie, readJson } = require('./auth-handler');
function accessHandler(service, config) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const send = (status, body) => { res.statusCode = status; res.end(JSON.stringify(body)); };
    try {
      const rolesMutation=/^\/api\/access\/users\/([^/]+)\/roles$/.exec(req.url);
      const activeMutation=/^\/api\/access\/users\/([^/]+)\/active$/.exec(req.url);
      const invitation=req.url==='/api/access/invitations';
      const read=['/api/access/me','/api/access/roles','/api/access/users'].includes(req.url);
      if(!rolesMutation&&!activeMutation&&!invitation&&!read)return send(404,{error:'Not found.'});
      const expected=rolesMutation?'PUT':activeMutation?'PATCH':invitation?'POST':'GET';
      if(req.method!==expected){res.setHeader('Allow',expected);return send(405,{error:'Method not allowed.'});}
      const mutation=Boolean(rolesMutation||activeMutation||invitation);
      if(mutation&&req.headers.origin!==config.origin){req.resume();throw new AuthError(403,'Request origin rejected.');}
      const token=cookieToken(req.headers.cookie,config.cookieName);
      if(rolesMutation)return send(200,await service.setRoles(token,rolesMutation[1],await readJson(req)));
      if(activeMutation)return send(200,await service.setActive(token,activeMutation[1],await readJson(req)));
      if(invitation)return send(201,{invitation:await service.inviteUser(token,await readJson(req))});
      if(req.url==='/api/access/me')return send(200,await service.me(token));
      if(req.url==='/api/access/roles')return send(200,{roles:await service.roles(token)});
      return send(200,{users:await service.users(token)});
    } catch (error) {
      const expected=error instanceof AuthError,status=expected?error.status:503;
      if(status===401)res.setHeader('Set-Cookie',sessionCookie('',config,true));
      return send(status,{error:expected?error.message:'Access management temporarily unavailable.'});
    }
  };
}
module.exports={accessHandler};
