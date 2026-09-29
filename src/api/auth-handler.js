const { AuthError } = require('../auth/errors');
const { loginInput } = require('../auth/validation');
const { loginLimiter } = require('../auth/rate-limit');
function cookieToken(header, name) {
  if (!header) return null;
  const matches = header.split(';').map(part => part.trim()).filter(part => part.startsWith(`${name}=`));
  if (matches.length !== 1) return null;
  return matches[0].slice(name.length + 1);
}
function sessionCookie(token, config, clear = false) {
  return `${config.cookieName}=${clear ? '' : token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : config.sessionSeconds}${config.secureCookie ? '; Secure' : ''}`;
}
function readJson(req) {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type'] || '') || req.headers['content-encoding']) {
    req.resume();
    return Promise.reject(new AuthError(415, 'Use application/json.'));
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let rejected = false;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 8192) {
        if (!rejected) { rejected = true; chunks.length = 0; reject(new AuthError(413, 'Request too large.')); }
      } else if (!rejected) chunks.push(chunk);
    });
    req.on('end', () => {
      if (rejected) return;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new AuthError(400, 'Invalid JSON input.')); }
    });
    req.on('error', () => reject(new AuthError(400, 'Invalid request.')));
    req.on('aborted', () => reject(new AuthError(400, 'Invalid request.')));
  });
}
function authHandler(service, config, limiter = loginLimiter()) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const send = (status, body) => { res.statusCode = status; res.end(body ? JSON.stringify(body) : undefined); };
    const path = req.url;
    try {
      if (!['/api/auth/login', '/api/auth/logout', '/api/auth/me'].includes(path)) {
        return send(404, { error: 'Not found.' });
      }
      if ((path === '/api/auth/me' && req.method !== 'GET') ||
          (path !== '/api/auth/me' && req.method !== 'POST')) {
        res.setHeader('Allow', path === '/api/auth/me' ? 'GET' : 'POST');
        return send(405, { error: 'Method not allowed.' });
      }
      // Fail closed for mutation origins, including missing/null origins; no CORS.
      if (req.method === 'POST' && req.headers.origin !== config.origin) {
        req.resume();
        throw new AuthError(403, 'Request origin rejected.');
      }
      const token = cookieToken(req.headers.cookie, config.cookieName);
      if (path === '/api/auth/login') {
        limiter.ip(req.socket.remoteAddress || 'unknown'); // Do not trust forwarding headers.
        const input = loginInput(await readJson(req));
        limiter.account(input.email);
        const login = await service.login(input);
        res.setHeader('Set-Cookie', sessionCookie(login.token, config));
        return send(200, { user: login.user });
      }
      if (path === '/api/auth/me') return send(200, { user: await service.currentUser(token) });
      const body = await readJson(req);
      if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length) {
        throw new AuthError(400, 'Logout requires an empty JSON object.');
      }
      await service.logout(token);
      res.setHeader('Set-Cookie', sessionCookie('', config, true));
      return send(204);
    } catch (error) {
      const expected = error instanceof AuthError;
      const status = expected ? error.status : 503;
      if (status === 401 && path !== '/api/auth/login') res.setHeader('Set-Cookie', sessionCookie('', config, true));
      if (status === 429) res.setHeader('Retry-After', '900');
      return send(status, { error: expected ? error.message : 'Authentication temporarily unavailable.' });
    }
  };
}
module.exports = { authHandler, cookieToken, sessionCookie, readJson };
