const { createPool } = require('../src/data/pool');
const { authRepository } = require('../src/data/auth-repository');
const { normalizeEmail, validatePassword } = require('../src/auth/validation');
const { hashPassword } = require('../src/auth/passwords');
const os = require('node:os');
async function main() {
  let pool;
  try {
    const email = normalizeEmail(process.env.AUTH_USER_EMAIL);
    const password = validatePassword(process.env.AUTH_USER_PASSWORD, true);
    const name = process.env.AUTH_USER_NAME;
    delete process.env.AUTH_USER_PASSWORD;
    if (typeof name !== 'string' || !name.trim() || name.length > 100) throw new Error('Invalid name.');
    const hash = await hashPassword(password);
    pool = createPool();
    const operator = `local operator ${os.userInfo().username}@${os.hostname()}`;
    await authRepository(pool).createUser(email, name.trim(), hash, operator);
    console.log('SentinelX user provisioned. No role permissions assigned.');
  } catch {
    console.error('User provisioning failed. Check input, uniqueness, database access and migrations locally.');
    process.exitCode = 1;
  } finally {
    delete process.env.AUTH_USER_PASSWORD;
    if (pool) await pool.end();
  }
}
if (require.main === module) main();
module.exports = { main };
