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
    async create(input) {
      const event = securityEvent(input);
      const { rawData, ...normalized } = event;
      try {
        const result = await pool.query(`INSERT INTO security_events
          (source, event_type, occurred_at, raw_data, normalized_data, normalized_at)
          VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, now()) RETURNING *`,
        [event.source, event.type, event.timestamp, JSON.stringify(rawData), JSON.stringify(normalized)]);
        return stored(result.rows[0]);
      } catch { throw new EventPersistenceError(); }
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
