const { AuthError } = require('../auth/errors');
const { cookieToken, readJson, sessionCookie } = require('./auth-handler');

function investigationHandler(service, config) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const send = (status, body) => { res.statusCode = status; res.end(JSON.stringify(body)); };
    try {
      const url = new URL(req.url, 'http://localhost');
      const workspace = /^\/api\/investigations\/([0-9a-f-]+)$/i.exec(url.pathname);
      const notes = /^\/api\/investigations\/([0-9a-f-]+)\/notes$/i.exec(url.pathname);
      if (!workspace && !notes) { req.resume(); return send(404, { error: 'Not found.' }); }
      const allowed = workspace ? ['GET'] : ['POST'];
      if (!allowed.includes(req.method)) {
        req.resume();
        res.setHeader('Allow', allowed.join(', '));
        return send(405, { error: 'Method not allowed.' });
      }
      const token = cookieToken(req.headers.cookie, config.cookieName);
      if (workspace) {
        if (url.search) throw new AuthError(400, 'Invalid investigation request.');
        return send(200, { investigation: await service.workspace(token, workspace[1]) });
      }
      if (req.headers.origin !== config.origin) { req.resume(); throw new AuthError(403, 'Request origin rejected.'); }
      await service.authorizeWrite(token);
      if (url.search) throw new AuthError(400, 'Invalid investigation request.');
      return send(201, { note: await service.addNote(token, notes[1], await readJson(req)) });
    } catch (error) {
      req.resume();
      const expected = error instanceof AuthError;
      const status = expected ? error.status : 503;
      if (status === 401) res.setHeader('Set-Cookie', sessionCookie('', config, true));
      return send(status, { error: expected ? error.message : 'Investigation workspace temporarily unavailable.' });
    }
  };
}

module.exports = { investigationHandler };
