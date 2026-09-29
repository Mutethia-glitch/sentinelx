const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createPool } = require('../../src/data/pool');
const { authRepository } = require('../../src/data/auth-repository');
const { accessRepository } = require('../../src/data/access-repository');
const { authService, hashToken } = require('../../src/auth/service');
const { accessService } = require('../../src/access/service');
const { hashPassword } = require('../../src/auth/passwords');
const { configFromEnv } = require('../../src/auth/config');
const { createServer } = require('../../src/api/server');
const { migrationSql } = require('../../scripts/migrate');
const { executeSql } = require('../../src/data/postgres');
test('PostgreSQL RBAC denies escalation, serializes admin changes, revokes sessions and audits atomically', async t => {
  assert.equal(process.env.SENTINELX_TEST_DATABASE, '1', 'Choose a disposable database and set SENTINELX_TEST_DATABASE=1.');
  executeSql(migrationSql());
  executeSql(migrationSql());
  const pool = createPool();
  const users = [];
  let server;
  let customRole;
  t.after(async () => {
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    const ids = users.map(user => user.id);
    await pool.query('DELETE FROM audit_logs WHERE actor_id = ANY($1::uuid[]) OR target_id = ANY($1::uuid[])', [ids]);
    await pool.query('DELETE FROM auth_sessions WHERE user_id = ANY($1::uuid[])', [ids]);
    await pool.query('DELETE FROM user_roles WHERE user_id = ANY($1::uuid[])', [ids]);
    await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [ids]);
    if (customRole) await pool.query('DELETE FROM roles WHERE id = $1', [customRole]);
    await pool.end();
  });
  const authRepo = authRepository(pool);
  const repository = accessRepository(pool);
  const config = configFromEnv({});
  const authentication = authService(authRepo, config);
  const access = accessService(repository, authentication);
  const password = 'Synthetic RBAC passphrase only';
  const passwordHash = await hashPassword(password);
  for (let count = 0; count < 5; count++) {
    const email = `rbac-${randomUUID()}@example.invalid`;
    const id = await authRepo.createUser(email, `Synthetic role tester ${count}`, passwordHash, 'synthetic test operator');
    users.push({ id, email });
  }
  const login = user => authentication.login({ email: user.email, password });
  const early = await login(users[0]);
  const bootstrap = await Promise.allSettled(users.slice(0, 2).map(user => repository.bootstrapAdministrator(user.email, 'synthetic test operator')));
  assert.equal(bootstrap.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(bootstrap.find(result => result.status === 'rejected').reason.status, 409);
  const primary = (await repository.rolesForUser(users[0].id)).includes('Administrator') ? users[0] : users[1];
  const secondary = primary.id === users[0].id ? users[1] : users[0];
  if (primary.id === users[0].id) await assert.rejects(authentication.currentUser(early.token), { status: 401 });
  await assert.rejects(repository.bootstrapAdministrator(primary.email, 'synthetic test operator'), { status: 409 });
  const administrator = await login(primary);
  await access.setRoles(administrator.token, secondary.id, { roles: ['Administrator'], reason: 'Add second test Administrator' });
  await access.setRoles(administrator.token, users[2].id, { roles: ['Security Analyst'], reason: 'Assign test analyst' });
  await access.setRoles(administrator.token, users[3].id, { roles: ['Viewer/Management'], reason: 'Assign test viewer' });
  const analyst = await login(users[2]);
  const viewer = await login(users[3]);
  const noRole = await login(users[4]);
  server = createServer(authentication, config, access);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = token => ({ Cookie: `${config.cookieName}=${token}` });
  const put = (token, id, body) => fetch(`${base}/api/access/users/${id}/roles`, {
    method: 'PUT', headers: { ...headers(token), Origin: config.origin, 'Content-Type': 'application/json', 'X-Role': 'Administrator' },
    body: JSON.stringify(body),
  });
  assert.equal((await fetch(`${base}/api/access/users`)).status, 401);
  for (const session of [analyst, viewer, noRole]) {
    assert.equal((await fetch(`${base}/api/access/users`, { headers: { ...headers(session.token), 'X-Role': 'Administrator' } })).status, 403);
    assert.equal((await fetch(`${base}/api/access/roles`, { headers: headers(session.token) })).status, 403);
    assert.equal((await put(session.token, users[4].id, { roles: ['Administrator'], reason: 'Attempt escalation' })).status, 403);
  }
  const noAccess = await access.me(noRole.token);
  assert.deepEqual(noAccess.roles, []);
  assert.deepEqual(noAccess.permissions, []);
  let response = await fetch(`${base}/api/access/users`, { headers: headers(administrator.token) });
  assert.equal(response.status, 200);
  const list = await response.json();
  assert.equal(list.users.length, 5);
  assert.deepEqual(Object.keys(list.users[0]).sort(), ['active', 'displayName', 'email', 'id', 'roles']);
  assert.equal(JSON.stringify(list).includes(passwordHash), false);
  assert.equal((await put(administrator.token, users[4].id, { roles: ['Owner'], reason: 'Unapproved role' })).status, 400);
  assert.equal((await put(administrator.token, randomUUID(), { roles: [], reason: 'Missing user' })).status, 404);
  const noop = await access.setRoles(administrator.token, primary.id, { roles: ['Administrator'], reason: 'Unchanged access' });
  assert.equal(noop.changed, false);
  assert.equal((await authentication.currentUser(administrator.token)).id, primary.id);
  await access.setRoles(administrator.token, users[3].id, { roles: ['Security Analyst'], reason: 'Change viewer to analyst' });
  await assert.rejects(authentication.currentUser(viewer.token), { status: 401 });
  const upgraded = await login(users[3]);
  assert.ok((await access.me(upgraded.token)).permissions.includes('incidents.manage'));
  await access.setRoles(administrator.token, users[3].id, { roles: ['Viewer/Management'], reason: 'Restore viewer' });
  await assert.rejects(access.users(upgraded.token), { status: 401 });
  customRole = (await pool.query('INSERT INTO roles(name) VALUES ($1) RETURNING id', [`Unapproved-${randomUUID()}`])).rows[0].id;
  await pool.query('INSERT INTO user_roles(user_id, role_id) VALUES ($1, $2)', [users[4].id, customRole]);
  assert.deepEqual((await access.me(noRole.token)).permissions, []);
  // Competing self-demotions cannot remove both active Administrators.
  const removals = await Promise.allSettled([primary, secondary].map(user => repository.setRoles(user.id, user.id, [], 'Synthetic simultaneous demotion')));
  assert.equal(removals.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(removals.find(result => result.status === 'rejected').reason.status, 409);
  const retained = (await repository.rolesForUser(primary.id)).includes('Administrator') ? primary : secondary;
  const demoted = retained.id === primary.id ? secondary : primary;
  const remainingAdmin = await login(retained);
  await assert.rejects(repository.setRoles(demoted.id, users[4].id, ['Administrator'], 'Stale actor escalation'), { status: 403 });
  await assert.rejects(access.setRoles(remainingAdmin.token, retained.id, { roles: ['Viewer/Management'], reason: 'Remove last Administrator' }), { status: 409 });
  const snapshot = await repository.rolesForUser(users[2].id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('ALTER TABLE audit_logs RENAME TO audit_logs_temporarily_unavailable');
    const scoped = accessRepository({ connect: async () => ({ query: (sql, params) => client.query(sql === 'BEGIN' ? 'SAVEPOINT role_change' : sql === 'COMMIT' ? 'RELEASE SAVEPOINT role_change' : sql === 'ROLLBACK' ? 'ROLLBACK TO SAVEPOINT role_change' : sql, params), release() {} }) });
    await assert.rejects(scoped.setRoles(retained.id, users[2].id, [], 'Audit failure rollback'));
    const session = await client.query('SELECT revoked_at FROM auth_sessions WHERE token_hash = $1', [hashToken(analyst.token)]);
    assert.equal(session.rows[0].revoked_at, null);
    await client.query('ROLLBACK');
  } finally { client.release(); }
  assert.deepEqual(await repository.rolesForUser(users[2].id), snapshot);
  const audit = await pool.query("SELECT actor_id, context FROM audit_logs WHERE action = 'RBAC_ROLES_CHANGED' AND target_id = $1 ORDER BY occurred_at", [users[3].id]);
  assert.ok(audit.rows.some(row => row.actor_id === primary.id && row.context.reason === 'Change viewer to analyst' && row.context.previousRoles.includes('Viewer/Management')));
  const invalid = await pool.query("SELECT id FROM audit_logs WHERE context->>'reason' = 'Audit failure rollback'");
  assert.equal(invalid.rowCount, 0);
});
