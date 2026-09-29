const os = require('node:os');
const { createPool } = require('../src/data/pool');
const { normalizeEmail } = require('../src/auth/validation');
const { accessRepository } = require('../src/data/access-repository');
const { AuthError } = require('../src/auth/errors');
async function main() {
  let pool;
  try {
    const email = normalizeEmail(process.env.RBAC_BOOTSTRAP_EMAIL);
    pool = createPool();
    await accessRepository(pool).bootstrapAdministrator(email, `local operator ${os.userInfo().username}@${os.hostname()}`);
    console.log('First Administrator assigned. Sign in again to use the new permissions.');
  } catch (error) {
    console.error(error instanceof AuthError ? error.message : 'Administrator setup failed. Check configuration, database access and migrations locally.');
    process.exitCode = 1;
  } finally { if (pool) await pool.end(); }
}
if (require.main === module) main();
module.exports = { main };
