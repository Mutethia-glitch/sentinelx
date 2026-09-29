const { AuthError } = require('../auth/errors');
const { cookieToken, readJson, sessionCookie } = require('./auth-handler');
function ruleHandler(service, config) {
  return async (req, res) => {
    res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('Content-Type','application/json; charset=utf-8');
    const send = (status, body) => { res.statusCode=status; res.end(JSON.stringify(body)); };
    try {
      const url = new URL(req.url, 'http://localhost'); const detail = /^\/api\/rules\/([0-9a-f-]+)$/i.exec(url.pathname);
      const base = url.pathname === '/api/rules', validate = url.pathname === '/api/rules/validate', mitre = url.pathname === '/api/rules/mitre-mappings';
      if (!base && !detail && !validate && !mitre) { req.resume(); return send(404,{error:'Not found.'}); }
      const allowed = base ? ['GET','POST'] : detail ? ['GET','PUT'] : validate ? ['POST'] : ['GET'];
      if (!allowed.includes(req.method)) { req.resume(); res.setHeader('Allow',allowed.join(', ')); return send(405,{error:'Method not allowed.'}); }
      const token = cookieToken(req.headers.cookie,config.cookieName);
      if (req.method === 'GET') {
        if (base) return send(200,await service.list(token,url.searchParams));
        if (url.search) throw new AuthError(400,'Invalid rule filters.');
        return mitre ? send(200,{mappings:await service.mitre(token)}) : send(200,{rule:await service.get(token,detail[1])});
      }
      if (req.headers.origin !== config.origin) { req.resume(); throw new AuthError(403,'Request origin rejected.'); }
      await service.authorizeWrite(token);
      if (url.search) throw new AuthError(400,'Invalid rule filters.');
      const body = await readJson(req);
      if (validate) return send(200,await service.validate(token,body));
      return base ? send(201,{rule:await service.create(token,body)}) : send(200,{rule:await service.update(token,detail[1],body)});
    } catch (error) {
      req.resume(); const expected = error instanceof AuthError; const status = expected ? error.status : 503;
      if (status === 401) res.setHeader('Set-Cookie',sessionCookie('',config,true));
      return send(status,{error:expected ? error.message : 'Rule management temporarily unavailable.'});
    }
  };
}
module.exports = { ruleHandler };
