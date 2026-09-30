const { transaction } = require('./auth-repository');
const CORRELATION_LOCK = 73482117;
class CorrelationPersistenceError extends Error {
  constructor() { super('Alert correlation persistence unavailable.'); this.name = 'CorrelationPersistenceError'; }
}
function snapshot(row) {
  return { id: row.id, threat: row.category_code, timestamp: row.created_at.toISOString(), affectedEntities: row.affected_entities || {} };
}
function pair(alertId, relatedAlertId) {
  return alertId < relatedAlertId ? [alertId, relatedAlertId] : [relatedAlertId, alertId];
}
function correlationRepository(pool) {
  async function candidates(alert, windowSeconds, db = pool) {
    try {
      const entities = alert.affectedEntities || {};
      const result = await db.query(`SELECT id,category_code,created_at,affected_entities FROM alerts
        WHERE id<>$1::uuid
          AND created_at <= $2::timestamptz + ($3::text || ' seconds')::interval
          AND created_at >= $2::timestamptz - ($3::text || ' seconds')::interval
          AND (category_code=$4
            OR ($5::text IS NOT NULL AND affected_entities->>'user'=$5)
            OR ($6::text IS NOT NULL AND affected_entities->>'sourceIp'=$6)
            OR ($7::text IS NOT NULL AND affected_entities->>'host'=$7))
        ORDER BY created_at ASC,id ASC`,
      [alert.id, alert.timestamp, windowSeconds, alert.threat, entities.user ?? null, entities.sourceIp ?? null, entities.host ?? null]);
      return result.rows.map(snapshot);
    } catch { throw new CorrelationPersistenceError(); }
  }
  async function link(alertId, relatedAlertId, evidence, db = pool) {
    try {
      const [left, right] = pair(alertId, relatedAlertId);
      const result = await db.query(`INSERT INTO alert_correlations(alert_id,related_alert_id,relationship)
        VALUES($1,$2,$3::jsonb) ON CONFLICT DO NOTHING RETURNING id`,
      [left, right, JSON.stringify(evidence)]);
      return Boolean(result.rows[0]);
    } catch { throw new CorrelationPersistenceError(); }
  }
  async function group(alertId, db = pool) {
    try {
      const result = await db.query(`WITH RECURSIVE connected(id) AS (
        SELECT $1::uuid
        UNION
        SELECT CASE WHEN c.alert_id=connected.id THEN c.related_alert_id ELSE c.alert_id END
        FROM connected JOIN alert_correlations c
          ON c.alert_id=connected.id OR c.related_alert_id=connected.id
      ) SELECT id FROM connected ORDER BY id`, [alertId]);
      return result.rows.map(row => row.id);
    } catch { throw new CorrelationPersistenceError(); }
  }
  async function withLock(work, db = undefined) {
    const run = async client => {
      // Held until the enclosing ingestion transaction commits or rolls back.
      await client.query('SELECT pg_advisory_xact_lock($1)', [CORRELATION_LOCK]);
      return work(client);
    };
    try { return db ? await run(db) : await transaction(pool, run); }
    catch (error) {
      if (error instanceof CorrelationPersistenceError) throw error;
      throw new CorrelationPersistenceError();
    }
  }
  return { candidates, link, group, withLock };
}
module.exports = { correlationRepository, CorrelationPersistenceError, pair, CORRELATION_LOCK };
