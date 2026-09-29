const { AuthError } = require('../auth/errors');
const { EventValidationError } = require('../events/model');
const { cookieToken, sessionCookie } = require('./auth-handler');
function eventViewHandler(service, config) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const send = (status, body) => { res.statusCode = status; res.end(JSON.stringify(body)); };
    try {
      const url = new URL(req.url, 'http://localhost');
      const detail = /^\/api\/events\/([0-9a-f-]+)$/i.exec(url.pathname);
      if (url.pathname !== '/api/events' && !detail) return send(404, { error: 'Not found.' });
      if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return send(405, { error: 'Method not allowed.' }); }
      const token = cookieToken(req.headers.cookie, config.cookieName);
      if (detail) {
        if (url.search) throw new AuthError(400, 'Invalid event filters.');
        return send(200, { event: await service.inspect(token, detail[1]) });
      }
      return send(200, await service.list(token, url.searchParams));
    } catch (error) {
      const status = error instanceof AuthError ? error.status : error instanceof EventValidationError ? 400 : 503;
      if (status === 401) res.setHeader('Set-Cookie', sessionCookie('', config, true));
      return send(status, { error: error instanceof AuthError || error instanceof EventValidationError ? error.message : 'Event viewing temporarily unavailable.' });
    }
  };
}
module.exports = { eventViewHandler };
