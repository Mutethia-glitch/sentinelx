const http = require('node:http');
const { configFromEnv } = require('../auth/config');
const { createPool } = require('../data/pool');
const { authRepository } = require('../data/auth-repository');
const { authService } = require('../auth/service');
const { authHandler } = require('./auth-handler');
const { accessRepository } = require('../data/access-repository');
const { accessService } = require('../access/service');
const { accessHandler } = require('./access-handler');
const { accessPage } = require('./access-page');
function createServer(service, config, access = null) {
  const authentication = authHandler(service, config);
  const authorization = access ? accessHandler(access, config) : null;
  const server = http.createServer({ maxHeaderSize: 16384 }, (req, res) => {
    if (accessPage(req, res)) return;
    if (authorization && req.url.startsWith('/api/access/')) return authorization(req, res);
    return authentication(req, res);
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  server.timeout = 15000;
  server.keepAliveTimeout = 5000;
  return server;
}
async function main() {
  let pool;
  try {
    const config = configFromEnv();
    pool = createPool();
    await pool.query('SELECT token_hash FROM auth_sessions LIMIT 0');
    const service = authService(authRepository(pool), config);
    const access = accessService(accessRepository(pool), service);
    const server = createServer(service, config, access);
    server.on('error', () => { console.error('Authentication server could not start.'); process.exitCode = 1; pool.end(); });
    server.listen(config.port, '127.0.0.1', () => console.log(`SentinelX authentication API listening on loopback port ${config.port}.`));
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
      server.close(() => pool.end());
    });
  } catch {
    console.error('Authentication server could not start. Check configuration, database access and migrations locally.');
    if (pool) await pool.end();
    process.exitCode = 1;
  }
}
if (require.main === module) main();
module.exports = { createServer };
