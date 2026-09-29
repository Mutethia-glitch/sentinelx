const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../../src/api/server');
const { configFromEnv } = require('../../src/auth/config');
const { accessService } = require('../../src/access/service');
const { AuthError } = require('../../src/auth/errors');
test('actual HTTP routes enforce backend identity and roles despite forged client state', async t => {
  const config = configFromEnv({});
  let roles = ['Viewer/Management'];
  let mutations = 0;
  const user = { id: '11111111-1111-4111-8111-111111111111', email: 'synthetic@example.invalid', displayName: 'Tester' };
  const authentication = { async currentUser(token) {
    if (token !== 'synthetic-token') throw new AuthError(401, 'Authentication required.');
    return user;
  } };
  const repository = {
    async rolesForUser() { return roles; },
    async listUsers() { return [user]; },
    async setRoles() { mutations++; return { changed: true }; },
  };
  const server = createServer(authentication, config, accessService(repository, authentication));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { Cookie: 'sentinelx_session=synthetic-token' };
  const update = { method: 'PUT', headers: { ...headers, Origin: config.origin, 'Content-Type': 'application/json', 'X-Role': 'Administrator' }, body: JSON.stringify({ roles: ['Administrator'], reason: 'Synthetic assignment' }) };
  assert.equal((await fetch(`${base}/api/access/users`)).status, 401);
  assert.equal((await fetch(`${base}/api/access/users/${user.id}/roles`, { ...update, headers: { Origin: config.origin, 'Content-Type': 'application/json' } })).status, 401);
  for (const assigned of [['Viewer/Management'], ['Security Analyst'], [], ['Owner']]) {
    roles = assigned;
    assert.equal((await fetch(`${base}/api/access/users`, { headers: { ...headers, 'X-Role': 'Administrator' } })).status, 403);
    assert.equal((await fetch(`${base}/api/access/roles`, { headers })).status, 403);
    assert.equal((await fetch(`${base}/api/access/users/${user.id}/roles`, update)).status, 403);
  }
  assert.equal(mutations, 0);
  roles = ['Administrator'];
  assert.equal((await fetch(`${base}/api/access/users`, { headers })).status, 200);
  assert.equal((await fetch(`${base}/api/access/roles`, { headers })).status, 200);
  assert.equal((await fetch(`${base}/api/access/users/${user.id}/roles`, update)).status, 200);
  assert.equal(mutations, 1);
  for (const origin of [undefined, 'null', 'https://attacker.invalid']) {
    const badHeaders = { ...headers, 'Content-Type': 'application/json' };
    if (origin) badHeaders.Origin = origin;
    assert.equal((await fetch(`${base}/api/access/users/${user.id}/roles`, { ...update, headers: badHeaders })).status, 403);
  }
  assert.equal((await fetch(`${base}/api/access/users/${user.id}/roles`, { ...update, body: '{' })).status, 400);
  assert.equal((await fetch(`${base}/api/access/users/${user.id}/roles`, { ...update, body: JSON.stringify({ roles: ['Owner'], reason: 'unapproved' }) })).status, 400);
  assert.equal((await fetch(`${base}/api/access/users/invalid/roles`, update)).status, 400);
  assert.equal((await fetch(`${base}/api/access/users`, { method: 'POST', headers })).status, 405);
  assert.equal((await fetch(`${base}/api/access/users?role=Administrator`, { headers })).status, 404);
  roles = ['Viewer/Management'];
  assert.equal((await fetch(`${base}/api/access/users`, { headers })).status, 403);
  const self = await (await fetch(`${base}/api/access/me`, { headers })).json();
  assert.deepEqual(self.roles, ['Viewer/Management']);
  assert.equal(self.permissions.includes('users.roles.manage'), false);
  repository.rolesForUser = async () => { throw new Error('postgres://private:secret@internal/db'); };
  const failed = await fetch(`${base}/api/access/me`, { headers });
  assert.equal(failed.status, 503);
  assert.deepEqual(await failed.json(), { error: 'Access management temporarily unavailable.' });
  const page = await fetch(`${base}/access`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.match(await page.text(), /id="users-panel" hidden/);
  assert.equal((await fetch(`${base}/access/access.js`)).status, 200);
  assert.equal((await fetch(`${base}/access/access.css`)).status, 200);
  assert.equal((await fetch(`${base}/access/.env`)).status, 404);
});
