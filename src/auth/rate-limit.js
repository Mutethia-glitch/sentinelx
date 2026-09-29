const { createHash } = require('node:crypto');
const { AuthError } = require('./errors');
function loginLimiter({ now = Date.now, windowMs = 15 * 60 * 1000, maxKeys = 10000 } = {}) {
  const buckets = new Map();
  let nextSweep = 0;
  function take(key, limit) {
    const time = now();
    if (time >= nextSweep) {
      for (const [name, bucket] of buckets) if (bucket.expires <= time) buckets.delete(name);
      nextSweep = time + 60000;
    }
    let bucket = buckets.get(key);
    if (!bucket || bucket.expires <= time) {
      if (!bucket && buckets.size >= maxKeys) throw new AuthError(429, 'Too many login attempts. Try again later.');
      bucket = { count: 0, expires: time + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > limit) throw new AuthError(429, 'Too many login attempts. Try again later.');
  }
  return {
    ip(address) { take(`ip:${address}`, 20); },
    account(email) {
      const digest = createHash('sha256').update(email).digest('hex');
      take(`account:${digest}`, 10);
    },
  };
}
module.exports = { loginLimiter };
