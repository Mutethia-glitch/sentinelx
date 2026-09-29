const test = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, verifyPassword } = require('../../src/auth/passwords');
const { loginInput, validatePassword } = require('../../src/auth/validation');
const { configFromEnv } = require('../../src/auth/config');
const { loginLimiter } = require('../../src/auth/rate-limit');
const { cookieToken, sessionCookie } = require('../../src/api/auth-handler');

test('salted scrypt hashes verify exact Unicode/whitespace passwords and reject mismatches', async () => {
  const password = ' synthetic passphrase 🔐 ';
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.match(first, /^scrypt\$131072\$8\$1\$/);
  assert.equal(first.includes(password), false);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword(password.trim(), first), false);
  assert.equal(await verifyPassword(password, 'corrupt hash'), false);
  assert.equal(await verifyPassword(password, null), false);
  const concurrent = await Promise.allSettled([verifyPassword(password, first), verifyPassword(password, first), verifyPassword(password, first)]);
  assert.equal(concurrent.filter(result => result.status === 'fulfilled').length, 2);
  assert.equal(concurrent.find(result => result.status === 'rejected').reason.status, 503);
});
test('input rejects objects, unknown fields, overlong passwords and unsafe email shapes', () => {
  const valid = { email: ' Tester@Example.invalid ', password: 'synthetic passphrase' };
  assert.equal(loginInput(valid).email, 'tester@example.invalid');
  for (const input of [null, [], {}, { ...valid, role: 'Administrator' }, { ...valid, password: {} }, { ...valid, email: 'invalid' }]) {
    assert.throws(() => loginInput(input), { status: 400 });
  }
  assert.throws(() => validatePassword('short', true));
  assert.throws(() => validatePassword('a'.repeat(1025)));
  assert.doesNotThrow(() => validatePassword(' '.repeat(15), true));
});
test('production requires HTTPS origin and local HTTP is development-only', () => {
  assert.throws(() => configFromEnv({ NODE_ENV: 'production' }));
  assert.throws(() => configFromEnv({ NODE_ENV: 'production', APP_ORIGIN: 'http://localhost:3000' }));
  assert.throws(() => configFromEnv({ APP_ORIGIN: 'http://example.invalid' }));
  assert.throws(() => configFromEnv({ PORT: '-1' }));
  assert.throws(() => configFromEnv({ APP_ORIGIN: 'https://example.invalid/path' }));
  const config = configFromEnv({ NODE_ENV: 'production', APP_ORIGIN: 'https://sentinel.example.invalid' });
  assert.match(sessionCookie('token', config), /__Host-sentinelx_session=token; Path=\/; HttpOnly; SameSite=Strict; Max-Age=28800; Secure/);
  assert.match(sessionCookie('', config, true), /Max-Age=0; Secure$/);
});
test('duplicate cookies fail closed and query/bearer values are not cookie tokens', () => {
  assert.equal(cookieToken('a=1; sentinelx_session=abc', 'sentinelx_session'), 'abc');
  assert.equal(cookieToken('sentinelx_session=a; sentinelx_session=b', 'sentinelx_session'), null);
  assert.equal(cookieToken('a=1', 'sentinelx_session'), null);
});
test('per-IP and per-account throttling expire and bounded maps fail closed', () => {
  let time = 0;
  const limiter = loginLimiter({ now: () => time });
  for (let count = 0; count < 10; count++) limiter.account('synthetic@example.invalid');
  assert.throws(() => limiter.account('synthetic@example.invalid'), { status: 429 });
  for (let count = 0; count < 20; count++) limiter.ip('127.0.0.1');
  assert.throws(() => limiter.ip('127.0.0.1'), { status: 429 });
  time = 15 * 60 * 1000;
  assert.doesNotThrow(() => limiter.account('synthetic@example.invalid'));
  const bounded = loginLimiter({ maxKeys: 1 });
  bounded.ip('one');
  assert.throws(() => bounded.ip('two'), { status: 429 });
});
