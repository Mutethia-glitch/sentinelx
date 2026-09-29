const test = require('node:test');
const assert = require('node:assert/strict');
const { ROLE_NAMES, ROLE_PERMISSIONS, accessForRoles, requirePermission, roleUpdateInput, validateUserId } = require('../../src/access/policy');
test('approved roles implement administrator, analyst and read-only boundaries', () => {
  assert.deepEqual(ROLE_NAMES, ['Administrator', 'Security Analyst', 'Viewer/Management']);
  for (const permission of ['events.read', 'alerts.read', 'incidents.read', 'investigations.read', 'responses.read', 'reports.read', 'dashboard.read']) {
    for (const role of ROLE_NAMES) assert.doesNotThrow(() => requirePermission([role], permission));
  }
  for (const permission of ['rules.manage', 'alerts.manage', 'incidents.manage', 'investigations.write', 'responses.execute']) {
    assert.doesNotThrow(() => requirePermission(['Administrator'], permission));
    assert.doesNotThrow(() => requirePermission(['Security Analyst'], permission));
    assert.throws(() => requirePermission(['Viewer/Management'], permission), { status: 403 });
  }
  for (const permission of ['users.read', 'users.roles.manage']) {
    assert.doesNotThrow(() => requirePermission(['Administrator'], permission));
    assert.throws(() => requirePermission(['Security Analyst'], permission), { status: 403 });
    assert.throws(() => requirePermission(['Viewer/Management'], permission), { status: 403 });
  }
});
test('unknown roles, permissions and malformed role collections deny by default', () => {
  for (const names of [[], undefined, null, 'Administrator', ['administrator'], ['Owner'], ['constructor']]) {
    assert.deepEqual(accessForRoles(names), { roles: [], permissions: [] });
    assert.throws(() => requirePermission(names, 'users.roles.manage'), { status: 403 });
  }
  for (const name of ROLE_NAMES) assert.throws(() => requirePermission([name], 'unknown.permission'), { status: 403 });
  assert.throws(() => requirePermission(['Administrator'], null), { status: 403 });
  const combined = accessForRoles(['Security Analyst', 'Viewer/Management', 'Owner', 'Security Analyst']);
  assert.equal(new Set(combined.permissions).size, combined.permissions.length);
  assert.equal(combined.permissions.includes('users.roles.manage'), false);
  assert.throws(() => { ROLE_PERMISSIONS.Administrator.push('unapproved.permission'); });
});
test('role assignment accepts only canonical unique roles, UUIDs and a bounded reason', () => {
  const good = { roles: ['Security Analyst'], reason: '  Authorized assignment  ' };
  assert.deepEqual(roleUpdateInput(good), { roles: ['Security Analyst'], reason: 'Authorized assignment' });
  assert.deepEqual(roleUpdateInput({ roles: [], reason: 'Revoke access' }).roles, []);
  for (const body of [null, [], {}, { ...good, role: 'Administrator' }, { ...good, roles: ['Owner'] },
    { ...good, roles: ['Administrator', 'Administrator'] }, { ...good, roles: 'Administrator' },
    { ...good, reason: '' }, { ...good, reason: 'a'.repeat(501) }, { ...good, reason: '\u0000' }]) {
    assert.throws(() => roleUpdateInput(body), { status: 400 });
  }
  assert.equal(validateUserId('11111111-1111-4111-8111-111111111111'), '11111111-1111-4111-8111-111111111111');
  for (const id of [null, '', '1 OR 1=1', '11111111-1111-4111-8111-111111111111/roles']) assert.throws(() => validateUserId(id), { status: 400 });
});
