const { transaction } = require('./auth-repository');
const { requirePermission } = require('../access/policy');
const { AuthError } = require('../auth/errors');

class AlertPersistenceError extends Error {
  constructor() { super('Alert persistence unavailable.'); this.name = 'AlertPersistenceError'; }
}
function numberOrNull(value) { return value === null || value === undefined ? null : Number(value); }
function summary(row) {
  return {
    id: row.id,
    rule: { id: row.rule_id, name: row.rule_name },
    triggerEventId: row.trigger_event_id,
    threat: row.category_code,
    severity: row.threat_level,
    source: row.source,
    timestamp: row.created_at.toISOString(),
    affectedEntities: row.affected_entities,
    status: row.status,
    confidence: numberOrNull(row.confidence),
    matchReason: row.match_reason,
    statusUpdatedAt: row.status_updated_at?.toISOString() ?? null,
    statusUpdatedBy: row.status_updated_by ?? null,
  };
}
async function rolesFor(client, userId) {
  const result = await client.query(`SELECT r.name FROM user_roles ur
    JOIN roles r ON r.id=ur.role_id JOIN users u ON u.id=ur.user_id
    WHERE u.id=$1 AND u.active ORDER BY r.name`, [userId]);
  return result.rows.map(row => row.name);
}
function alertRepository(pool) {
  function failure(error) {
    if (error instanceof AuthError) throw error;
    throw new AlertPersistenceError();
  }
  return {
    async list(filters) {
      const values = [];
      const conditions = [];
      const parameter = value => { values.push(value); return '$' + values.length; };
      if (filters.status) conditions.push(`a.status=${parameter(filters.status)}`);
      if (filters.severity) conditions.push(`a.threat_level=${parameter(filters.severity)}::threat_level`);
      if (filters.categoryCode) conditions.push(`a.category_code=${parameter(filters.categoryCode)}`);
      if (filters.source) conditions.push(`a.source=${parameter(filters.source)}`);
      if (filters.ruleId) conditions.push(`a.rule_id=${parameter(filters.ruleId)}::uuid`);
      if (filters.mitreTechniqueId) {
        const technique=parameter(filters.mitreTechniqueId);
        conditions.push('EXISTS (SELECT 1 FROM rule_mitre_mappings rmm JOIN mitre_mappings m '+
          'ON m.id=rmm.mapping_id WHERE rmm.rule_id=a.rule_id AND m.technique_id='+technique+')');
      }
      if (filters.from) conditions.push(`a.created_at>=${parameter(filters.from)}::timestamptz`);
      if (filters.to) conditions.push(`a.created_at<=${parameter(filters.to)}::timestamptz`);
      const entities=[];
      for(const field of ['sourceIp','destinationIp','user','host']){
        if(filters[field])entities.push("e.normalized_data->>'"+field+"'="+parameter(filters[field]));
      }
      if(entities.length){
        conditions.push('EXISTS (SELECT 1 FROM alert_events ae JOIN security_events e ON e.id=ae.event_id '+
          'WHERE ae.alert_id=a.id AND '+entities.join(' AND ')+')');
      }
      if (filters.q) {
        const escaped = filters.q.replace(/[\\%_]/g, char => `\\${char}`);
        const pattern = parameter(`%${escaped}%`);
        conditions.push(`(r.name ILIKE ${pattern} ESCAPE '\\' OR a.source ILIKE ${pattern} ESCAPE '\\'
          OR a.category_code ILIKE ${pattern} ESCAPE '\\' OR a.match_reason ILIKE ${pattern} ESCAPE '\\'
          OR coalesce(a.affected_entities->>'sourceIp','') ILIKE ${pattern} ESCAPE '\\'
          OR coalesce(a.affected_entities->>'destinationIp','') ILIKE ${pattern} ESCAPE '\\'
          OR coalesce(a.affected_entities->>'user','') ILIKE ${pattern} ESCAPE '\\'
          OR coalesce(a.affected_entities->>'host','') ILIKE ${pattern} ESCAPE '\\')`);
      }
      const offset = parameter((filters.page - 1) * 50);
      try {
        const result = await pool.query(`SELECT a.*, r.name AS rule_name FROM alerts a
          JOIN detection_rules r ON r.id=a.rule_id
          ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
          ORDER BY a.created_at DESC, a.id DESC LIMIT 51 OFFSET ${offset}`, values);
        return {
          alerts: result.rows.slice(0, 50).map(summary),
          page: filters.page,
          pageSize: 50,
          hasMore: result.rows.length > 50 && filters.page < 2000,
        };
      } catch (error) { failure(error); }
    },
    async get(id) {
      try {
        const row = (await pool.query(`SELECT a.*, r.name AS rule_name FROM alerts a
          JOIN detection_rules r ON r.id=a.rule_id WHERE a.id=$1`, [id])).rows[0];
        if (!row) return null;
        const events = (await pool.query(`SELECT e.id,e.source,e.event_type,e.occurred_at,
          e.normalized_data->>'severity' AS severity,e.normalized_data->>'user' AS "user",
          e.normalized_data->>'host' AS host,e.normalized_data->>'action' AS action,
          e.normalized_data->>'status' AS status
          FROM alert_events ae JOIN security_events e ON e.id=ae.event_id
          WHERE ae.alert_id=$1 ORDER BY e.occurred_at ASC,e.id ASC`, [id])).rows.map(event => ({
            id: event.id,
            timestamp: event.occurred_at.toISOString(),
            source: event.source,
            type: event.event_type,
            severity: event.severity ?? null,
            user: event.user ?? null,
            host: event.host ?? null,
            action: event.action ?? null,
            status: event.status ?? null,
            trigger: event.id === row.trigger_event_id,
          }));
        return { ...summary(row), matchEvidence: row.match_evidence, events };
      } catch (error) { failure(error); }
    },
    async updateStatus(actorId, id, input) {
      try {
        return await transaction(pool, async client => {
          const actor = await client.query('SELECT id FROM users WHERE id=$1 AND active FOR SHARE', [actorId]);
          if (!actor.rows[0]) throw new AuthError(403, 'Permission denied.');
          requirePermission(await rolesFor(client, actorId), 'alerts.manage');
          const current = (await client.query(`SELECT a.*, r.name AS rule_name FROM alerts a
            JOIN detection_rules r ON r.id=a.rule_id WHERE a.id=$1 FOR UPDATE OF a`, [id])).rows[0];
          if (!current) throw new AuthError(404, 'Alert not found.');
          if (current.status === input.status) return { ...summary(current), changed: false };
          const updated = (await client.query(`UPDATE alerts SET status=$2,status_updated_at=clock_timestamp(),
            status_updated_by=$3 WHERE id=$1 RETURNING *`, [id, input.status, actorId])).rows[0];
          await client.query(`INSERT INTO audit_logs(actor_id,actor_context,action,target_type,target_id,context)
            VALUES($1,'authenticated alert analyst','ALERT_STATUS_CHANGED','alert',$2,$3::jsonb)`,
          [actorId, id, JSON.stringify({ previousStatus: current.status, status: input.status, reason: input.reason })]);
          updated.rule_name = current.rule_name;
          return { ...summary(updated), changed: true };
        });
      } catch (error) { failure(error); }
    },
  };
}
module.exports = { alertRepository, AlertPersistenceError };
