const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { createServer } = require('../../src/api/server');
const { configFromEnv } = require('../../src/auth/config');
const { AuthError } = require('../../src/auth/errors');
test('HTTP boundary rejects invalid requests and exposes no secrets or backend errors', async t => {
  const config = configFromEnv({});
  const token = randomBytes(32).toString('base64url');
  const user = { id: 'synthetic', email: 'synthetic@example.invalid', displayName: 'Tester' };
  let broken = false;
  const service = {
    async login() { if (broken) throw new Error('postgres://private:secret@example.invalid/db'); return { user, token }; },
    async currentUser(value) { if (value !== token) throw new AuthError(401, 'Authentication required.'); return user; },
    async logout(value) { if (value !== token) throw new AuthError(401, 'Authentication required.'); },
  };
  const server = createServer(service, config);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const options = { method: 'POST', headers: { Origin: config.origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email, password: 'synthetic password only' }) };
  let response = await fetch(`${base}/api/auth/login`, options);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(response.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  assert.deepEqual(await response.json(), { user });
  const cookie = `sentinelx_session=${token}`;
  assert.equal((await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } })).status, 200);
  assert.equal((await fetch(`${base}/api/auth/me`)).status, 401);
  assert.equal((await fetch(`${base}/api/auth/me?token=${token}`)).status, 404);
  assert.equal((await fetch(`${base}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })).status, 401);
  assert.equal((await fetch(`${base}/api/auth/me`, { headers: { Cookie: `${cookie}; ${cookie}` } })).status, 401);
  for (const origin of [undefined, 'null', 'https://attacker.invalid']) {
    const headers = { 'Content-Type': 'application/json' };
    if (origin) headers.Origin = origin;
    assert.equal((await fetch(`${base}/api/auth/login`, { ...options, headers })).status, 403);
    assert.equal((await fetch(`${base}/api/auth/logout`, { ...options, body: '{}', headers: { ...headers, Cookie: cookie } })).status, 403);
  }
  assert.equal((await fetch(`${base}/api/auth/login`, { ...options, body: '{' })).status, 400);
  assert.equal((await fetch(`${base}/api/auth/login`, { ...options, body: '[]' })).status, 400);
  assert.equal((await fetch(`${base}/api/auth/login`, { ...options, headers: { Origin: config.origin, 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await fetch(`${base}/api/auth/login`, { ...options, body: 'a'.repeat(9000) })).status, 413);
  assert.equal((await fetch(`${base}/api/auth/login`)).status, 405);
  assert.equal((await fetch(`${base}/api/auth/logout`, { ...options, body: '{}', headers: { ...options.headers, Cookie: cookie } })).status, 204);
  broken = true;
  response = await fetch(`${base}/api/auth/login`, options);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'Authentication temporarily unavailable.' });
});
