const { transaction } = require('./auth-repository');
const { requirePermission } = require('../access/policy');
const { categoryCode, categoryUpdateInput } = require('../threats/taxonomy');
const { AuthError } = require('../auth/errors');
const view = row => ({ code: row.code, name: row.name, description: row.description, enabled: row.enabled, updatedAt: row.updated_at.toISOString() });
class CategoryPersistenceError extends Error { constructor() { super('Threat category persistence unavailable.'); } }
function categoryRepository(pool) {
  return {
    async list(selectable = false) {
      try { return (await pool.query(`SELECT * FROM threat_categories ${selectable ? 'WHERE enabled' : ''} ORDER BY code`)).rows.map(view); }
      catch { throw new CategoryPersistenceError(); }
    },
    async requireSelectable(code) {
      categoryCode(code);
      try {
        const result = await pool.query('SELECT * FROM threat_categories WHERE code=$1 AND enabled', [code]);
        if (!result.rows[0]) throw new AuthError(400, 'Threat category is not selectable.');
        return view(result.rows[0]);
      } catch (error) { if (error instanceof AuthError) throw error; throw new CategoryPersistenceError(); }
    },
    async update(actorId, code, input) {
      categoryCode(code); const data = categoryUpdateInput(input);
      try {
        return await transaction(pool, async client => {
          const actor = await client.query('SELECT active FROM users WHERE id=$1 FOR SHARE', [actorId]);
          if (!actor.rows[0]?.active) throw new AuthError(403, 'Permission denied.');
          const roles = await client.query('SELECT r.name FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1', [actorId]);
          requirePermission(roles.rows.map(row => row.name), 'categories.manage');
          const previous = (await client.query('SELECT * FROM threat_categories WHERE code=$1 FOR UPDATE', [code])).rows[0];
          if (!previous) throw new AuthError(404, 'Threat category not found.');
          const row = (await client.query('UPDATE threat_categories SET name=$2, description=$3, enabled=$4, updated_at=now() WHERE code=$1 RETURNING *', [code, data.name, data.description, data.enabled])).rows[0];
          await client.query(`INSERT INTO audit_logs(actor_id, actor_context, action, target_type, context) VALUES ($1, 'authenticated Administrator', 'THREAT_CATEGORY_UPDATED', 'threat_category', $2::jsonb)`, [actorId, JSON.stringify({ code, previous: view(previous), next: view(row), reason: data.reason })]);
          return view(row);
        });
      } catch (error) { if (error instanceof AuthError) throw error; throw new CategoryPersistenceError(); }
    },
  };
}
module.exports = { categoryRepository, CategoryPersistenceError };
