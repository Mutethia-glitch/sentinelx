const { AuthError } = require('../auth/errors');
const { cookieToken, readJson, sessionCookie } = require('./auth-handler');

function responseHandler(service, config) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const send = (status, body) => { res.statusCode = status; res.end(JSON.stringify(body)); };
    try {
      const url = new URL(req.url, 'http://localhost');
      const history = /^\/api\/responses\/([0-9a-f-]+)$/i.exec(url.pathname);
      const action = /^\/api\/responses\/([0-9a-f-]+)\/actions$/i.exec(url.pathname);
      if (!history && !action) { req.resume(); return send(404, { error: 'Not found.' }); }
      const allowed = history ? 'GET' : 'POST';
      if (req.method !== allowed) {
        req.resume(); res.setHeader('Allow', allowed);
        return send(405, { error: 'Method not allowed.' });
      }
      const token = cookieToken(req.headers.cookie, config.cookieName);
      if (history) return send(200, await service.list(token, history[1], url.searchParams));
      if (req.headers.origin !== config.origin) { req.resume(); throw new AuthError(403, 'Request origin rejected.'); }
      await service.authorizeWrite(token);
      if (url.search) { req.resume(); throw new AuthError(400, 'Invalid response request.'); }
      return send(201, { action: await service.record(token, action[1], await readJson(req)) });
    } catch (error) {
      req.resume();
      const expected = error instanceof AuthError;
      const status = expected ? error.status : 503;
      if (status === 401) res.setHeader('Set-Cookie', sessionCookie('', config, true));
      return send(status, { error: expected ? error.message : 'Response workflow temporarily unavailable.' });
    }
  };
}
module.exports = { responseHandler };
