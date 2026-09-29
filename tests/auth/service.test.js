const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { hashPassword } = require('../../src/auth/passwords');
const { authService, hashToken } = require('../../src/auth/service');
const { configFromEnv } = require('../../src/auth/config');
test('generic failures, independent fresh tokens, hashed persistence, safe identity and revocation', async () => {
  const password = 'Synthetic test passphrase only';
  const user = { id: 'synthetic-id', email: 'synthetic@example.invalid', display_name: 'Tester', active: true, password_hash: await hashPassword(password) };
  const sessions = new Map();
  let failures = 0;
  const repository = {
    async findUser(email) { return email === user.email ? user : null; },
    async failedLogin() { failures++; },
    async createSession(current, digest) { sessions.set(digest, current); return current; },
    async authenticate(digest) { return sessions.get(digest); },
    async logout(digest) { return sessions.delete(digest); },
  };
  const service = authService(repository, configFromEnv({}));
  for (const input of [{ email: 'unknown@example.invalid', password }, { email: user.email, password: 'wrong' }]) {
    await assert.rejects(service.login(input), { status: 401, message: 'Invalid email or password.' });
  }
  user.active = false;
  await assert.rejects(service.login({ email: user.email, password }), { status: 401, message: 'Invalid email or password.' });
  user.active = true;
  assert.equal(failures, 3);
  const first = await service.login({ email: user.email, password });
  const second = await service.login({ email: user.email, password });
  assert.notEqual(first.token, second.token);
  assert.equal(sessions.has(first.token), false);
  assert.equal(sessions.has(hashToken(first.token)), true);
  assert.deepEqual(first.user, { id: user.id, email: user.email, displayName: user.display_name });
  assert.deepEqual(await service.currentUser(first.token), first.user);
  await service.logout(first.token);
  await assert.rejects(service.currentUser(first.token), { status: 401 });
  await assert.rejects(service.logout(first.token), { status: 401 });
  await assert.rejects(service.currentUser(randomBytes(32).toString('base64url')), { status: 401 });
  await assert.rejects(service.currentUser('malformed'), { status: 401 });
  assert.deepEqual(await service.currentUser(second.token), second.user);
});
