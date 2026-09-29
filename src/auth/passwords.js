const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const { AuthError } = require('./errors');
const { validatePassword } = require('./validation');
const derive = promisify(scrypt);
const OPTIONS = { N: 131072, r: 8, p: 1, maxmem: 160 * 1024 * 1024 };
let active = 0;
async function key(password, salt) {
  // Bound memory use; no unbounded queue of password hashes.
  if (active >= 2) throw new AuthError(503, 'Authentication temporarily unavailable.');
  active += 1;
  try { return await derive(password, salt, 64, OPTIONS); }
  finally { active -= 1; }
}
async function hashPassword(password) {
  validatePassword(password, true);
  const salt = randomBytes(16);
  const hash = await key(password, salt);
  return `scrypt$131072$8$1$${salt.toString('hex')}$${hash.toString('hex')}`;
}
const DUMMY_SALT = randomBytes(16);
async function verifyPassword(password, stored) {
  validatePassword(password);
  const match = typeof stored === 'string' &&
    /^scrypt\$131072\$8\$1\$([0-9a-f]{32})\$([0-9a-f]{128})$/.exec(stored);
  const actual = await key(password, match ? Buffer.from(match[1], 'hex') : DUMMY_SALT);
  // Unknown users and unsupported/corrupt stored hashes still incur scrypt work.
  const expected = match ? Buffer.from(match[2], 'hex') : Buffer.alloc(64);
  return timingSafeEqual(actual, expected) && Boolean(match);
}
module.exports = { hashPassword, verifyPassword };
