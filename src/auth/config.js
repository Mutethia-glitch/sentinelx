function configFromEnv(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT.');
  const originValue = env.APP_ORIGIN || (production ? '' : `http://localhost:${port}`);
  let url;
  try { url = new URL(originValue); } catch { throw new Error('Set a valid APP_ORIGIN.'); }
  if (url.origin !== originValue || !['http:', 'https:'].includes(url.protocol) ||
      (production && url.protocol !== 'https:') ||
      (!production && url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
    throw new Error('APP_ORIGIN must be an exact HTTPS origin or a local development HTTP origin.');
  }
  return { port, origin: url.origin, secureCookie: url.protocol === 'https:',
    cookieName: url.protocol === 'https:' ? '__Host-sentinelx_session' : 'sentinelx_session',
    sessionSeconds: 8 * 60 * 60, idleSeconds: 30 * 60 };
}
module.exports = { configFromEnv };
