const { AuthError } = require('../auth/errors');
const ROLE_NAMES = Object.freeze(['Administrator', 'Security Analyst', 'Viewer/Management']);
const READ = ['access.read', 'categories.read', 'dashboard.read', 'events.read', 'alerts.read', 'incidents.read',
  'investigations.read', 'responses.read', 'reports.read'];
const ANALYST = [...READ, 'events.ingest', 'rules.read', 'rules.manage', 'alerts.manage', 'incidents.manage',
  'investigations.write', 'responses.execute', 'audit.read'];
const ROLE_PERMISSIONS = Object.freeze({
  Administrator: Object.freeze([...ANALYST, 'users.read', 'users.roles.manage', 'categories.manage']),
  'Security Analyst': Object.freeze(ANALYST),
  'Viewer/Management': Object.freeze(READ),
});
function accessForRoles(names) {
  const roles = ROLE_NAMES.filter(name => Array.isArray(names) && names.includes(name));
  const permissions = [...new Set(roles.flatMap(name => ROLE_PERMISSIONS[name]))].sort();
  return { roles, permissions };
}
function requirePermission(names, permission) {
  if (typeof permission !== 'string' || !accessForRoles(names).permissions.includes(permission)) {
    throw new AuthError(403, 'Permission denied.');
  }
}
function roleUpdateInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).sort().join(',') !== 'reason,roles' || !Array.isArray(body.roles) ||
      body.roles.length > ROLE_NAMES.length || new Set(body.roles).size !== body.roles.length ||
      body.roles.some(name => !ROLE_NAMES.includes(name)) || typeof body.reason !== 'string' ||
      !body.reason.trim() || body.reason.length > 500 || body.reason.includes('\u0000')) {
    throw new AuthError(400, 'Provide approved roles and a reason (1–500 characters).');
  }
  return { roles: ROLE_NAMES.filter(name => body.roles.includes(name)), reason: body.reason.trim() };
}
function validateUserId(id) {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) {
    throw new AuthError(400, 'Invalid user identifier.');
  }
  return id;
}
module.exports = { ROLE_NAMES, ROLE_PERMISSIONS, accessForRoles, requirePermission, roleUpdateInput, validateUserId };
