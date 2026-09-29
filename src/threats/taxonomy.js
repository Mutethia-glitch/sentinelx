const { AuthError } = require('../auth/errors');
const CATEGORY_CODES = Object.freeze(['BRUTE_FORCE', 'CREDENTIAL_ATTACK', 'PRIVILEGE_ESCALATION', 'SUSPICIOUS_ACCOUNT_ACTIVITY', 'UNAUTHORIZED_ACCESS', 'RECONNAISSANCE', 'SUSPICIOUS_NETWORK_ACTIVITY', 'PHISHING_SOCIAL_ENGINEERING', 'MALWARE', 'RANSOMWARE', 'DENIAL_OF_SERVICE', 'DATA_EXFILTRATION', 'WEB_APPLICATION_ATTACK', 'INSIDER_THREAT', 'SUPPLY_CHAIN_COMPROMISE']);
function categoryCode(code) {
  if (!CATEGORY_CODES.includes(code)) throw new AuthError(400, 'Unknown threat category.');
  return code;
}
function categoryUpdateInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).sort().join(',') !== 'description,enabled,name,reason' || typeof body.enabled !== 'boolean') throw new AuthError(400, 'Invalid threat category configuration.');
  for (const [key, maximum, required] of [['name', 100, true], ['description', 1000, false], ['reason', 500, true]]) {
    if (typeof body[key] !== 'string' || body[key].length > maximum || body[key].includes('\0') || (required && !body[key].trim())) throw new AuthError(400, 'Invalid threat category configuration.');
  }
  return { name: body.name.trim(), description: body.description.trim(), enabled: body.enabled, reason: body.reason.trim() };
}
module.exports = { CATEGORY_CODES, categoryCode, categoryUpdateInput };
