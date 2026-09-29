const { AuthError } = require('./errors');

function normalizeEmail(email) {
  if (typeof email !== 'string' || email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw new AuthError(400, 'Invalid authentication input.');
  }
  return email.trim().toLowerCase();
}
function validatePassword(password, provisioning = false) {
  if (typeof password !== 'string' || password.length === 0 ||
      Buffer.byteLength(password, 'utf8') > 1024 ||
      (provisioning && [...password].length < 15)) {
    throw new AuthError(400, 'Invalid authentication input.');
  }
  return password; // Do not trim, truncate or silently alter passwords.
}
function loginInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).sort().join(',') !== 'email,password') {
    throw new AuthError(400, 'Invalid authentication input.');
  }
  return { email: normalizeEmail(body.email), password: validatePassword(body.password) };
}
function safeUser(user) {
  return { id: user.id, email: user.email, displayName: user.display_name };
}
module.exports = { normalizeEmail, validatePassword, loginInput, safeUser };
