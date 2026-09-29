const { AuthError } = require('../auth/errors');
const { cookieToken, sessionCookie, readJson } = require('./auth-handler');
function accessHandler(service, config) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const send = (status, body) => { res.statusCode = status; res.end(JSON.stringify(body)); };
    try {
      const mutation = /^\/api\/access\/users\/([^/]+)\/roles$/.exec(req.url);
      const read = ['/api/access/me', '/api/access/roles', '/api/access/users'].includes(req.url);
      if (!mutation && !read) return send(404, { error: 'Not found.' });
      if (req.method !== (mutation ? 'PUT' : 'GET')) {
        res.setHeader('Allow', mutation ? 'PUT' : 'GET');
        return send(405, { error: 'Method not allowed.' });
      }
      if (mutation && req.headers.origin !== config.origin) {
        req.resume();
        throw new AuthError(403, 'Request origin rejected.');
      }
      const token = cookieToken(req.headers.cookie, config.cookieName);
      if (mutation) return send(200, await service.setRoles(token, mutation[1], await readJson(req)));
      if (req.url === '/api/access/me') return send(200, await service.me(token));
      if (req.url === '/api/access/roles') return send(200, { roles: await service.roles(token) });
      return send(200, { users: await service.users(token) });
    } catch (error) {
      const expected = error instanceof AuthError;
      const status = expected ? error.status : 503;
      if (status === 401) res.setHeader('Set-Cookie', sessionCookie('', config, true));
      return send(status, { error: expected ? error.message : 'Access management temporarily unavailable.' });
    }
  };
}
module.exports = { accessHandler };
