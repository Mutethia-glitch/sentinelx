const { transaction } = require('./auth-repository');
const { requirePermission } = require('../access/policy');
const { AuthError } = require('../auth/errors');
const { securityEvent, EventValidationError } = require('../events/model');
class EventPersistenceError extends Error {
  constructor() { super('Security event persistence unavailable.'); this.name = 'EventPersistenceError'; }
}
function eventRepository(pool) {
  function stored(row) {
    if (!row) return null;
    return {
      id: row.id, receivedAt: row.received_at.toISOString(),
      normalizedAt: row.normalized_at?.toISOString() ?? null,
      event: row.normalized_data ? securityEvent({ ...row.normalized_data, timestamp: row.occurred_at.toISOString(), source: row.source, type: row.event_type, rawData: row.raw_data }) : null,
      rawData: row.raw_data,
    };
  }
  return {
    async create(input, actorId = null) {
      const event = securityEvent(input);
      const { rawData, ...normalized } = event;
      try {
        const work = async client => {
          if (actorId) {
            const actor = await client.query('SELECT active FROM users WHERE id = $1 FOR SHARE', [actorId]);
            if (!actor.rows[0]?.active) throw new AuthError(403, 'Permission denied.');
            const roles = await client.query('SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1', [actorId]);
            requirePermission(roles.rows.map(row => row.name), 'events.ingest');
          }
          const result = await client.query(`INSERT INTO security_events
            (source, event_type, occurred_at, raw_data, normalized_data, normalized_at)
            VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, now()) RETURNING *`,
          [event.source, event.type, event.timestamp, JSON.stringify(rawData), JSON.stringify(normalized)]);
          const saved = stored(result.rows[0]);
          if (actorId) await client.query(`INSERT INTO audit_logs(actor_id, actor_context, action, target_type, target_id, context) VALUES ($1, 'authenticated event submitter', 'EVENT_INGESTED', 'security_event', $2, $3::jsonb)`, [actorId, saved.id, JSON.stringify({ source: event.source, type: event.type })]);
          return saved;
        };
        return actorId ? await transaction(pool, work) : await work(pool);
      } catch (error) { if (error instanceof AuthError) throw error; throw new EventPersistenceError(); }
    },
    async getById(id) {
      if (typeof id !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) throw new EventValidationError();
      try {
        const result = await pool.query('SELECT * FROM security_events WHERE id = $1', [id]);
        return stored(result.rows[0]);
      } catch { throw new EventPersistenceError(); }
    },
  };
}
module.exports = { eventRepository, EventPersistenceError };
