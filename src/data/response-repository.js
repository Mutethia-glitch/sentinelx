const { transaction } = require('./auth-repository');
const { requirePermission } = require('../access/policy');
const { AuthError } = require('../auth/errors');

class ResponsePersistenceError extends Error {
  constructor() { super('Response workflow temporarily unavailable.'); this.name = 'ResponsePersistenceError'; }
}
const TERMINAL = new Set(['RESOLVED', 'DISMISSED']);
const CONTAINABLE = new Set(['NEW', 'INVESTIGATING']);

function responseView(row) {
  return {
    id: row.id,
    incidentId: row.incident_id,
    action: row.action,
    reason: row.reason,
    result: row.result,
    succeeded: row.succeeded,
    performedAt: row.performed_at.toISOString(),
    authorizedBy: { id: row.authorized_by, displayName: row.actor_name ?? null },
  };
}
function responseRepository(pool) {
  function failure(error) {
    if (error instanceof AuthError) throw error;
    throw new ResponsePersistenceError();
  }
  return {
    async list(incidentId, page) {
      try {
        const incident = (await pool.query('SELECT id FROM incidents WHERE id=$1', [incidentId])).rows[0];
        if (!incident) throw new AuthError(404, 'Incident not found.');
        const rows = (await pool.query(`SELECT ra.*,u.display_name AS actor_name FROM response_actions ra
          JOIN users u ON u.id=ra.authorized_by WHERE ra.incident_id=$1
          ORDER BY ra.performed_at DESC,ra.id DESC LIMIT 51 OFFSET $2`,
        [incidentId, (page - 1) * 50])).rows;
        return { actions: rows.slice(0, 50).map(responseView), page, pageSize: 50,
          hasMore: rows.length > 50 && page < 2000 };
      } catch (error) { failure(error); }
    },
    async record(actorId, incidentId, input) {
      try {
        return await transaction(pool, async client => {
          const actor = (await client.query('SELECT id,display_name FROM users WHERE id=$1 AND active FOR SHARE', [actorId])).rows[0];
          if (!actor) throw new AuthError(403, 'Permission denied.');
          const roles = (await client.query(`SELECT r.name FROM user_roles ur JOIN roles r ON r.id=ur.role_id
            JOIN users u ON u.id=ur.user_id WHERE u.id=$1 AND u.active ORDER BY r.name`, [actorId])).rows;
          requirePermission(roles.map(row => row.name), 'responses.execute');
          const current = (await client.query('SELECT id,status FROM incidents WHERE id=$1 FOR UPDATE', [incidentId])).rows[0];
          if (!current) throw new AuthError(404, 'Incident not found.');
          if (TERMINAL.has(current.status)) throw new AuthError(409, 'Terminal incident cannot receive a new response.');
          const contain = input.action === 'CONTAINMENT' && input.succeeded;
          if (contain && !CONTAINABLE.has(current.status)) throw new AuthError(409, 'Incident is already contained.');

          const result = { summary: input.details, mode: 'MANUAL_ATTESTATION', containmentPerformed: input.containmentPerformed };
          const row = (await client.query(`INSERT INTO response_actions
            (incident_id,authorized_by,action,reason,result,succeeded,performed_at)
            VALUES($1,$2,$3,$4,$5::jsonb,$6,clock_timestamp()) RETURNING *`,
          [incidentId, actorId, input.action, input.reason, JSON.stringify(result), input.succeeded])).rows[0];
          row.actor_name = actor.display_name;

          if (contain) {
            await client.query(`UPDATE incidents SET status='CONTAINED',status_updated_at=clock_timestamp(),
              status_updated_by=$2,updated_at=clock_timestamp() WHERE id=$1`, [incidentId, actorId]);
          }
          await client.query(`INSERT INTO audit_logs(actor_id,actor_context,action,target_type,target_id,context)
            VALUES($1,'authenticated responder','RESPONSE_ACTION_RECORDED','incident',$2,$3::jsonb)`,
          [actorId, incidentId, JSON.stringify({ responseActionId: row.id, action: input.action,
            succeeded: input.succeeded, reason: input.reason, result })]);
          if (contain) {
            await client.query(`INSERT INTO audit_logs(actor_id,actor_context,action,target_type,target_id,context)
              VALUES($1,'authenticated responder','INCIDENT_STATUS_CHANGED','incident',$2,$3::jsonb)`,
            [actorId, incidentId, JSON.stringify({ previousStatus: current.status, status: 'CONTAINED',
              reason: input.reason, responseActionId: row.id })]);
          }
          return { ...responseView(row), incidentStatus: contain ? 'CONTAINED' : current.status };
        });
      } catch (error) { failure(error); }
    },
  };
}
module.exports = { responseRepository, responseView, ResponsePersistenceError };
