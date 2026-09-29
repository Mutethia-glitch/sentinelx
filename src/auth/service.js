const { randomBytes, createHash } = require('node:crypto');
const { verifyPassword } = require('./passwords');
const { AuthError } = require('./errors');
const { loginInput, safeUser } = require('./validation');
const hashToken = token => createHash('sha256').update(token).digest('hex');
function validToken(token) { return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token); }
function authService(repository, config) {
  return {
    async login(body) {
      const { email, password } = loginInput(body);
      const user = await repository.findUser(email);
      const matches = await verifyPassword(password, user?.password_hash);
      if (!user || !matches || !user.active) {
        await repository.failedLogin();
        throw new AuthError(401, 'Invalid email or password.');
      }
      const token = randomBytes(32).toString('base64url');
      const current = await repository.createSession(user, hashToken(token), config.sessionSeconds);
      if (!current) {
        await repository.failedLogin();
        throw new AuthError(401, 'Invalid email or password.');
      }
      return { user: safeUser(current), token };
    },
    async currentUser(token) {
      if (!validToken(token)) throw new AuthError(401, 'Authentication required.');
      const user = await repository.authenticate(hashToken(token), config.idleSeconds);
      if (!user) throw new AuthError(401, 'Authentication required.');
      return safeUser(user);
    },
    async logout(token) {
      if (!validToken(token) || !await repository.logout(hashToken(token), config.idleSeconds)) {
        throw new AuthError(401, 'Authentication required.');
      }
    },
  };
}
module.exports = { authService, hashToken };
