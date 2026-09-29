const { transaction } = require('./auth-repository');
const { ROLE_NAMES, accessForRoles, requirePermission } = require('../access/policy');
const { AuthError } = require('../auth/errors');
// Serializes role mutations and first-admin setup; authority is rechecked inside it.
const ROLE_LOCK = 73482106;
async function rolesFor(client, userId) {
  const result = await client.query(`SELECT r.name FROM roles r
    JOIN user_roles ur ON ur.role_id = r.id JOIN users u ON u.id = ur.user_id
    WHERE u.id = $1 AND u.active AND r.name = ANY($2::text[]) ORDER BY r.name`, [userId, ROLE_NAMES]);
  return result.rows.map(row => row.name);
}
async function adminCount(client) {
  const result = await client.query(`SELECT count(DISTINCT u.id)::int AS count
    FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
    WHERE u.active AND r.name = 'Administrator'`);
  return result.rows[0].count;
}
async function writeRoleChange(client, target, names, actorId, actorContext, reason) {
  const before = await client.query(`SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id = r.id
    WHERE ur.user_id = $1 ORDER BY r.name`, [target.id]);
  const previous = before.rows.map(row => row.name);
  if (JSON.stringify([...previous].sort()) === JSON.stringify([...names].sort())) return false;
  if (target.active && previous.includes('Administrator') && !names.includes('Administrator') && await adminCount(client) <= 1) {
    throw new AuthError(409, 'The last active Administrator cannot be removed.');
  }
  const selected = await client.query('SELECT id FROM roles WHERE name = ANY($1::text[])', [names]);
  if (selected.rows.length !== names.length) throw new Error('Approved roles are not migrated.');
  await client.query('DELETE FROM user_roles WHERE user_id = $1', [target.id]);
  for (const row of selected.rows) await client.query('INSERT INTO user_roles(user_id, role_id) VALUES ($1, $2)', [target.id, row.id]);
  await client.query('UPDATE auth_sessions SET revoked_at = clock_timestamp() WHERE user_id = $1 AND revoked_at IS NULL', [target.id]);
  await client.query(`INSERT INTO audit_logs(actor_id, actor_context, action, target_type, target_id, context)
    VALUES ($1, $2, 'RBAC_ROLES_CHANGED', 'user', $3, $4)`,
  [actorId, actorContext, target.id, { previousRoles: previous, roles: names, reason }]);
  return true;
}
function accessRepository(pool) {
  return {
    async rolesForUser(userId) { return rolesFor(pool, userId); },
    async listUsers() {
      const result = await pool.query(`SELECT u.id, u.email, u.display_name, u.active,
        coalesce(array_agg(r.name ORDER BY r.name) FILTER (WHERE r.name = ANY($1::text[])), ARRAY[]::text[]) AS roles
        FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id LEFT JOIN roles r ON r.id = ur.role_id
        GROUP BY u.id ORDER BY lower(u.email), u.id LIMIT 100`, [ROLE_NAMES]);
      return result.rows.map(row => ({ id: row.id, email: row.email, displayName: row.display_name,
        active: row.active, roles: accessForRoles(row.roles).roles }));
    },
    async setRoles(actorId, userId, roles, reason) {
      return transaction(pool, async client => {
        await client.query('SELECT pg_advisory_xact_lock($1)', [ROLE_LOCK]);
        requirePermission(await rolesFor(client, actorId), 'users.roles.manage');
        const result = await client.query('SELECT id, active FROM users WHERE id = $1 FOR UPDATE', [userId]);
        if (!result.rows[0]) throw new AuthError(404, 'User not found.');
        const changed = await writeRoleChange(client, result.rows[0], roles, actorId, 'authenticated Administrator', reason);
        return { userId, roles, changed };
      });
    },
    async bootstrapAdministrator(email, operatorContext) {
      return transaction(pool, async client => {
        await client.query('SELECT pg_advisory_xact_lock($1)', [ROLE_LOCK]);
        if (await adminCount(client) > 0) throw new AuthError(409, 'An active Administrator is already configured.');
        const result = await client.query('SELECT id, active FROM users WHERE lower(email) = $1 AND active FOR UPDATE', [email]);
        if (!result.rows[0]) throw new AuthError(404, 'Provision an active application user first.');
        await writeRoleChange(client, result.rows[0], ['Administrator'], null, operatorContext, 'First active Administrator configured locally');
      });
    },
  };
}
module.exports = { accessRepository };
