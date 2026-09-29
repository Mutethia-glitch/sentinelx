const { AuthError } = require('../auth/errors');
const { cookieToken, readJson, sessionCookie } = require('./auth-handler');
function categoryHandler(service, config) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const send = (status, body) => { res.statusCode = status; res.end(JSON.stringify(body)); };
    try {
      const url = new URL(req.url, 'http://localhost'); const detail = /^\/api\/threat-categories\/([A-Z_]+)$/.exec(url.pathname);
      if (url.pathname !== '/api/threat-categories' && !detail) { req.resume(); return send(404, { error: 'Not found.' }); }
      const method = detail ? 'PATCH' : 'GET';
      if (req.method !== method) { req.resume(); res.setHeader('Allow', method); return send(405, { error: 'Method not allowed.' }); }
      const token = cookieToken(req.headers.cookie, config.cookieName);
      if (!detail) return send(200, { categories: await service.list(token, url.searchParams) });
      if (req.headers.origin !== config.origin) { req.resume(); throw new AuthError(403, 'Request origin rejected.'); }
      await service.authorizeUpdate(token);
      if (url.search) throw new AuthError(400, 'Invalid category filters.');
      return send(200, { category: await service.update(token, detail[1], await readJson(req)) });
    } catch (error) {
      req.resume(); const expected = error instanceof AuthError; const status = expected ? error.status : 503;
      if (status === 401) res.setHeader('Set-Cookie', sessionCookie('', config, true));
      return send(status, { error: expected ? error.message : 'Threat categories temporarily unavailable.' });
    }
  };
}
module.exports = { categoryHandler };
