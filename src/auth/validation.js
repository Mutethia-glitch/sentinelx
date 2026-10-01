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
  return password;
}
function exact(body,keys,message='Invalid authentication input.'){
  if(!body||typeof body!=='object'||Array.isArray(body)||
    Object.keys(body).sort().join(',')!==[...keys].sort().join(','))throw new AuthError(400,message);
}
function loginInput(body) {
  exact(body,['email','password']);
  return { email: normalizeEmail(body.email), password: validatePassword(body.password) };
}
function twoFactorInput(body){
  exact(body,['code'],'Invalid verification input.');
  if(typeof body.code!=='string'||!/^\d{6}$/.test(body.code))throw new AuthError(400,'Enter the 6-digit verification code.');
  return{code:body.code};
}
function activationInput(body){
  exact(body,['email','code','password'],'Invalid activation input.');
  if(typeof body.code!=='string'||!/^\d{6}$/.test(body.code))throw new AuthError(400,'Invalid activation input.');
  return{email:normalizeEmail(body.email),code:body.code,password:validatePassword(body.password,true)};
}
function safeUser(user) {
  return { id: user.id, email: user.email, displayName: user.display_name };
}
module.exports = { normalizeEmail, validatePassword, loginInput, twoFactorInput, activationInput, safeUser };
