const { createHash } = require('node:crypto');

class DetectionPersistenceError extends Error {
  constructor() { super('Detection persistence unavailable.'); this.name = 'DetectionPersistenceError'; }
}
const FIELD_SQL = Object.freeze({
  source: 'source', type: 'event_type', sourceIp: "normalized_data->>'sourceIp'",
  destinationIp: "normalized_data->>'destinationIp'", user: "normalized_data->>'user'",
  host: "normalized_data->>'host'", action: "normalized_data->>'action'",
  status: "normalized_data->>'status'", severity: "normalized_data->>'severity'",
});
function deterministicAlertId(ruleId, triggerEventId) {
  const bytes = createHash('sha256').update(`sentinelx:detection-alert:${ruleId}:${triggerEventId}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
function detectionRepository(pool) {
  async function enabledRules(db = pool) {
    try {
      const result = await db.query(`SELECT id, name, threat_level, category_code, definition
        FROM detection_rules WHERE enabled=true ORDER BY id`);
      return result.rows.map(row => ({ id: row.id, name: row.name, severity: row.threat_level, categoryCode: row.category_code, definition: row.definition }));
    } catch { throw new DetectionPersistenceError(); }
  }
  async function matchingEvents(definition, event, groupValues, db = pool) {
    try {
      const values = [event.timestamp, definition.windowSeconds];
      const clauses = ['normalized_at IS NOT NULL', 'occurred_at <= $1::timestamptz', "occurred_at >= $1::timestamptz - ($2::text || ' seconds')::interval"];
      const add = value => { values.push(value); return '$' + values.length; };
      for (const condition of definition.conditions) {
        const column = FIELD_SQL[condition.field];
        if (!column) throw new DetectionPersistenceError();
        if (condition.operator === 'equals') clauses.push(condition.value === null ? `${column} IS NULL` : `${column} = ${add(condition.value)}`);
        else if (condition.operator === 'notEquals') clauses.push(condition.value === null ? `${column} IS NOT NULL` : `${column} IS DISTINCT FROM ${add(condition.value)}`);
        else if (condition.operator === 'in') {
          const nonNull = condition.value.filter(value => value !== null);
          const parts = nonNull.length ? [`${column} = ANY(${add(nonNull)}::text[])`] : [];
          if (condition.value.includes(null)) parts.push(`${column} IS NULL`);
          clauses.push('(' + parts.join(' OR ') + ')');
        } else if (condition.operator === 'exists') clauses.push(`${column} IS ${condition.value ? 'NOT ' : ''}NULL`);
        else throw new DetectionPersistenceError();
      }
      definition.groupBy.forEach((field, index) => {
        const column = FIELD_SQL[field];
        if (!column) throw new DetectionPersistenceError();
        const value = groupValues[index];
        clauses.push(value === null ? `${column} IS NULL` : `${column} = ${add(value)}`);
      });
      const result = await db.query(`SELECT id, occurred_at FROM security_events WHERE ${clauses.join(' AND ')}
        ORDER BY occurred_at ASC, id ASC LIMIT 10000`, values);
      return result.rows.map(row => ({ id: row.id, timestamp: row.occurred_at.toISOString() }));
    } catch (error) { if (error instanceof DetectionPersistenceError) throw error; throw new DetectionPersistenceError(); }
  }
  async function insertAlert(client, rule, events, evidence) {
    const id = deterministicAlertId(rule.id, evidence.triggerEventId);
    const reason = `${rule.name} matched ${events.length} event(s) within ${evidence.windowSeconds} seconds.`;
    const created = await client.query(`INSERT INTO alerts(id, rule_id, threat_level, match_reason, match_evidence)
      VALUES ($1,$2,$3,$4,$5::jsonb) ON CONFLICT (id) DO NOTHING RETURNING id, created_at`,
    [id, rule.id, rule.severity, reason, JSON.stringify({ categoryCode: rule.categoryCode, ...evidence, eventIds: events.map(item => item.id) })]);
    const alert = created.rows[0];
    if (!alert) return null;
    for (const item of events) await client.query('INSERT INTO alert_events(alert_id,event_id) VALUES ($1,$2)', [alert.id, item.id]);
    return { id: alert.id, ruleId: rule.id, severity: rule.severity, eventIds: events.map(item => item.id), createdAt: alert.created_at.toISOString() };
  }
  async function createAlert(rule, events, evidence, transactionClient = null) {
    if (transactionClient) {
      try { return await insertAlert(transactionClient, rule, events, evidence); }
      catch (error) { if (error instanceof DetectionPersistenceError) throw error; throw new DetectionPersistenceError(); }
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await insertAlert(client, rule, events, evidence);
      await client.query('COMMIT');
      return result;
    } catch {
      try { await client.query('ROLLBACK'); } catch {}
      throw new DetectionPersistenceError();
    } finally { client.release(); }
  }
  return { enabledRules, matchingEvents, createAlert };
}
module.exports = { detectionRepository, deterministicAlertId, DetectionPersistenceError };
