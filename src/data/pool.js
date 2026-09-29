const { Pool } = require('pg');
function createPool(env = process.env) {
  if (!env.DATABASE_URL && !env.PGDATABASE) throw new Error('Set DATABASE_URL or PG* database environment variables.');
  if (env.DATABASE_URL) {
    let url;
    try { url = new URL(env.DATABASE_URL); } catch { throw new Error('Invalid database configuration.'); }
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('PostgreSQL URL required.');
  }
  const pool = new Pool({
    ...(env.DATABASE_URL ? { connectionString: env.DATABASE_URL } : {
      host: env.PGHOST || 'localhost', port: Number(env.PGPORT || 5432),
      user: env.PGUSER, password: env.PGPASSWORD, database: env.PGDATABASE,
    }),
    max: 5, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000,
    statement_timeout: 5000, query_timeout: 6000,
  });
  // pg emits idle connection errors; never log driver messages or credentials.
  pool.on('error', () => console.error('Database connection unavailable.'));
  return pool;
}
module.exports = { createPool };
