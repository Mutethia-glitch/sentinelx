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
      const sites=req.url==='/api/access/sites';
      const integrations=req.url==='/api/access/integrations';
      const managedFeeds=req.url==='/api/access/evidence-feeds';
      const revokeFeed=/^\\/api\\/access\\/evidence-feeds\\/([a-f0-9-]{36})\\/revoke$/i.exec(req.url);
      const siteRevoke=/^\/api\/access\/sites\/([a-f0-9-]{36})\/revoke$/i.exec(req.url);
      const read=['/api/access/me','/api/access/roles','/api/access/users'].includes(req.url);
      if(!rolesMutation&&!activeMutation&&!invitation&&!read&&!sites&&!siteRevoke&&!integrations&&!managedFeeds&&!revokeFeed)return send(404,{error:'Not found.'});
      const allowed=integrations?'GET':managedFeeds?'GET, POST':revokeFeed?'POST':sites?'GET, POST':rolesMutation?'PUT':activeMutation?'PATCH':siteRevoke?'POST':invitation?'POST':'GET';
      if(!((sites||managedFeeds)?['GET','POST'].includes(req.method):req.method===allowed)){
        res.setHeader('Allow',allowed);return send(405,{error:'Method not allowed.'});
      }
      const mutation=Boolean(rolesMutation||activeMutation||invitation||siteRevoke||revokeFeed||((sites||managedFeeds)&&req.method==='POST'));
      if(mutation&&req.headers.origin!==config.origin){req.resume();throw new AuthError(403,'Request origin rejected.');}
      const token=cookieToken(req.headers.cookie,config.cookieName);
      if(rolesMutation)return send(200,await service.setRoles(token,rolesMutation[1],await readJson(req)));
      if(activeMutation)return send(200,await service.setActive(token,activeMutation[1],await readJson(req)));
      if(invitation)return send(201,{invitation:await service.inviteUser(token,await readJson(req))});
      if(sites)return req.method==='GET'?send(200,await service.sites(token)):send(201,await service.addSite(token,await readJson(req)));
      if(integrations)return send(200,await service.integrationReadiness(token));
      if(managedFeeds)return req.method==='GET'?send(200,await service.managedFeeds(token)):send(201,{feed:await service.issueManagedFeed(token,await readJson(req))});
      if(revokeFeed)return send(200,await service.revokeManagedFeed(token,revokeFeed[1],await readJson(req)));
      if(siteRevoke)return send(200,await service.revokeSite(token,siteRevoke[1],await readJson(req)));
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
