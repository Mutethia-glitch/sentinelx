const { AuthError } = require('../auth/errors');
const { EventValidationError } = require('../events/model');
const { cookieToken, readJson, sessionCookie } = require('./auth-handler');
function ingestionHandler(service, config) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const send = (status, body) => { res.statusCode = status; res.end(JSON.stringify(body)); };
    try {
      if (req.url !== '/api/events') { req.resume(); return send(404, { error: 'Not found.' }); }
      if (req.method !== 'POST') { req.resume(); res.setHeader('Allow', 'POST'); return send(405, { error: 'Method not allowed.' }); }
      if (req.headers.origin !== config.origin) { req.resume(); throw new AuthError(403, 'Request origin rejected.'); }
      const token = cookieToken(req.headers.cookie, config.cookieName);
      await service.authorize(token);
      return send(201, { event: await service.ingest(token, await readJson(req)) });
    } catch (error) {
      req.resume();
      const status = error instanceof AuthError ? error.status : error instanceof EventValidationError ? 400 : 503;
      if (status === 401) res.setHeader('Set-Cookie', sessionCookie('', config, true));
      return send(status, { error: error instanceof AuthError || error instanceof EventValidationError ? error.message : 'Event ingestion temporarily unavailable.' });
    }
  };
}
module.exports = { ingestionHandler };
