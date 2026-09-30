const { transaction } = require('./auth-repository');
const { requirePermission } = require('../access/policy');
const { AuthError } = require('../auth/errors');
const SELECT = `SELECT r.*,
  ARRAY(SELECT m.technique_id FROM rule_mitre_mappings rm JOIN mitre_mappings m ON m.id=rm.mapping_id WHERE rm.rule_id=r.id ORDER BY m.technique_id) AS mitre_ids,
  COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'techniqueId',m.technique_id,'techniqueName',m.technique_name,
    'tactics',COALESCE((SELECT jsonb_agg(jsonb_build_object('tacticId',t.tactic_id,'tacticName',t.tactic_name) ORDER BY t.tactic_id)
      FROM mitre_mapping_tactics mt JOIN mitre_tactics t ON t.tactic_id=mt.tactic_id
      WHERE mt.mapping_id=m.id),'[]'::jsonb)
  ) ORDER BY m.technique_id)
  FROM rule_mitre_mappings rm JOIN mitre_mappings m ON m.id=rm.mapping_id
  WHERE rm.rule_id=r.id),'[]'::jsonb) AS mitre_details
  FROM detection_rules r`;
const view = row => ({ id: row.id, name: row.name, description: row.description, enabled: row.enabled, severity: row.threat_level, categoryCode: row.category_code, definition: row.definition, mitreTechniqueIds: row.mitre_ids || [], mitreMappings: row.mitre_details || [], version: row.version, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() });
class RulePersistenceError extends Error { constructor() { super('Detection rule persistence unavailable.'); } }
function ruleRepository(pool) {
  function failure(error) {
    if (error instanceof AuthError) throw error;
    if (error.code === '23505') throw new AuthError(409, 'A rule with that name already exists.');
    if (error.code === '23514' || error.code === '23503') throw new AuthError(400, 'Invalid rule references or configuration.');
    throw new RulePersistenceError();
  }
  async function references(client, data, previous = null) {
    if (!previous || previous.category_code !== data.categoryCode || (!previous.enabled && data.enabled)) {
      const result = await client.query('SELECT enabled FROM threat_categories WHERE code=$1 FOR SHARE', [data.categoryCode]);
      if (!result.rows[0]?.enabled) throw new AuthError(400, 'Threat category is not selectable.');
    }
    const mitre = await client.query('SELECT id, technique_id FROM mitre_mappings WHERE technique_id = ANY($1::text[]) FOR SHARE', [data.mitreTechniqueIds]);
    if (mitre.rows.length !== data.mitreTechniqueIds.length) throw new AuthError(400, 'Select known MITRE technique identifiers.');
    return mitre.rows;
  }
  async function actor(client, actorId) {
    const user = await client.query('SELECT active FROM users WHERE id=$1 FOR SHARE', [actorId]);
    if (!user.rows[0]?.active) throw new AuthError(403, 'Permission denied.');
    const roles = await client.query('SELECT r.name FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1', [actorId]);
    requirePermission(roles.rows.map(row => row.name), 'rules.manage');
  }
  async function mappings(client, id, rows) {
    await client.query('DELETE FROM rule_mitre_mappings WHERE rule_id=$1', [id]);
    for (const row of rows) await client.query('INSERT INTO rule_mitre_mappings(rule_id, mapping_id) VALUES ($1,$2)', [id, row.id]);
  }
  async function audit(client, actorId, id, action, previous, next, reason) {
    await client.query(`INSERT INTO audit_logs(actor_id, actor_context, action, target_type, target_id, context) VALUES ($1,'authenticated rule manager',$2,'detection_rule',$3,$4::jsonb)`, [actorId, action, id, JSON.stringify({ previous, next, reason })]);
  }
  return {
    async list(page) {
      try { const result = await pool.query(`${SELECT} ORDER BY r.created_at DESC, r.id DESC LIMIT 51 OFFSET $1`, [(page - 1) * 50]); return { rules: result.rows.slice(0, 50).map(view), page, pageSize: 50, hasMore: result.rows.length > 50 && page < 1000 }; }
      catch (error) { failure(error); }
    },
    async get(id) {
      try { const row = (await pool.query(`${SELECT} WHERE r.id=$1`, [id])).rows[0]; return row ? view(row) : null; }
      catch (error) { failure(error); }
    },
    async mitre() {
      try {
        const rows=(await pool.query(`SELECT m.technique_id,m.technique_name,t.tactic_id,t.tactic_name
          FROM mitre_mappings m
          LEFT JOIN mitre_mapping_tactics mt ON mt.mapping_id=m.id
          LEFT JOIN mitre_tactics t ON t.tactic_id=mt.tactic_id
          ORDER BY m.technique_id,t.tactic_id LIMIT 2000`)).rows;
        const map=new Map();
        for(const row of rows){
          if(!map.has(row.technique_id))map.set(row.technique_id,{
            techniqueId:row.technique_id,techniqueName:row.technique_name,tactics:[],
          });
          if(row.tactic_id)map.get(row.technique_id).tactics.push({
            tacticId:row.tactic_id,tacticName:row.tactic_name,
          });
        }
        return [...map.values()];
      } catch (error) { failure(error); }
    },
    async validate(data) {
      try { return await transaction(pool, async client => { await references(client, data); return data; }); }
      catch (error) { failure(error); }
    },
    async create(actorId, data) {
      try {
        return await transaction(pool, async client => {
          await actor(client, actorId); const refs = await references(client, data);
          const id = (await client.query(`INSERT INTO detection_rules(name, description, enabled, definition, threat_level, category_code, created_by) VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7) RETURNING id`, [data.name, data.description, data.enabled, JSON.stringify(data.definition), data.severity, data.categoryCode, actorId])).rows[0].id;
          await mappings(client, id, refs); const next = view((await client.query(`${SELECT} WHERE r.id=$1`, [id])).rows[0]);
          await audit(client, actorId, id, 'RULE_CREATED', null, next, data.reason); return next;
        });
      } catch (error) { failure(error); }
    },
    async update(actorId, id, data) {
      try {
        return await transaction(pool, async client => {
          await actor(client, actorId);
          await client.query('SELECT id FROM detection_rules WHERE id=$1 FOR UPDATE', [id]);
          const previous = (await client.query(`${SELECT} WHERE r.id=$1`, [id])).rows[0];
          if (!previous) throw new AuthError(404, 'Rule not found.');
          if (previous.version !== data.version) throw new AuthError(409, 'Rule changed. Reload it before saving.');
          const refs = await references(client, data, previous);
          await client.query(`UPDATE detection_rules SET name=$2, description=$3, enabled=$4, definition=$5::jsonb, threat_level=$6, category_code=$7, version=version+1, updated_at=now() WHERE id=$1`, [id, data.name, data.description, data.enabled, JSON.stringify(data.definition), data.severity, data.categoryCode]);
          await mappings(client, id, refs); const next = view((await client.query(`${SELECT} WHERE r.id=$1`, [id])).rows[0]);
          await audit(client, actorId, id, 'RULE_UPDATED', view(previous), next, data.reason); return next;
        });
      } catch (error) { failure(error); }
    },
  };
}
module.exports = { ruleRepository, RulePersistenceError };
