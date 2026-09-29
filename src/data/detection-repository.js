class DetectionPersistenceError extends Error {
  constructor() { super('Detection persistence unavailable.'); this.name = 'DetectionPersistenceError'; }
}
const FIELD_SQL = Object.freeze({
  source: 'source', type: 'event_type', sourceIp: "normalized_data->>'sourceIp'",
  destinationIp: "normalized_data->>'destinationIp'", user: "normalized_data->>'user'",
  host: "normalized_data->>'host'", action: "normalized_data->>'action'",
  status: "normalized_data->>'status'", severity: "normalized_data->>'severity'",
});
function detectionRepository(pool) {
  return {
    async enabledRules() {
      try {
        const result = await pool.query(`SELECT id, name, threat_level, category_code, definition
          FROM detection_rules WHERE enabled=true ORDER BY id`);
        return result.rows.map(row => ({ id: row.id, name: row.name, severity: row.threat_level, categoryCode: row.category_code, definition: row.definition }));
      } catch { throw new DetectionPersistenceError(); }
    },
    async matchingEvents(definition, event, groupValues) {
      try {
        const values = [event.timestamp, definition.windowSeconds];
        const clauses = ['normalized_at IS NOT NULL', 'occurred_at <= $1::timestamptz', "occurred_at >= $1::timestamptz - ($2::text || ' seconds')::interval"];
        const add = value => { values.push(value); return '$' + values.length; };
        for (const condition of definition.conditions) {
          const column = FIELD_SQL[condition.field]; const current = event[condition.field] ?? null;
          if (condition.operator === 'equals') clauses.push(condition.value === null ? `${column} IS NULL` : `${column} = ${add(condition.value)}`);
          else if (condition.operator === 'notEquals') clauses.push(condition.value === null ? `${column} IS NOT NULL` : `${column} IS DISTINCT FROM ${add(condition.value)}`);
          else if (condition.operator === 'in') {
            const nonNull = condition.value.filter(v => v !== null);
            const parts = nonNull.length ? [`${column} = ANY(${add(nonNull)}::text[])`] : [];
            if (condition.value.includes(null)) parts.push(`${column} IS NULL`);
            clauses.push('(' + parts.join(' OR ') + ')');
          } else if (condition.operator === 'exists') clauses.push(`${column} IS ${condition.value ? 'NOT ' : ''}NULL`);
          if (current === undefined) throw new DetectionPersistenceError();
        }
        definition.groupBy.forEach((field, index) => {
          const column = FIELD_SQL[field], value = groupValues[index];
          clauses.push(value === null ? `${column} IS NULL` : `${column} = ${add(value)}`);
        });
        const result = await pool.query(`SELECT id, occurred_at FROM security_events WHERE ${clauses.join(' AND ')}
          ORDER BY occurred_at ASC, id ASC LIMIT 10000`, values);
        return result.rows.map(row => ({ id: row.id, timestamp: row.occurred_at.toISOString() }));
      } catch (error) { if (error instanceof DetectionPersistenceError) throw error; throw new DetectionPersistenceError(); }
    },
    async createAlert(rule, events, evidence) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const trigger = evidence.triggerEventId;
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [rule.id + ':' + trigger]);
        const duplicate = await client.query(`SELECT a.id FROM alerts a
          JOIN alert_events ae ON ae.alert_id=a.id
          WHERE a.rule_id=$1 AND ae.event_id=$2 LIMIT 1 FOR UPDATE`, [rule.id, trigger]);
        if (duplicate.rows.length) { await client.query('ROLLBACK'); return null; }
        const reason = `${rule.name} matched ${events.length} event(s) within ${evidence.windowSeconds} seconds.`;
        const created = await client.query(`INSERT INTO alerts(rule_id, threat_level, match_reason, match_evidence)
          VALUES ($1,$2,$3,$4::jsonb) RETURNING id, created_at`,
        [rule.id, rule.severity, reason, JSON.stringify({ categoryCode: rule.categoryCode, ...evidence, eventIds: events.map(item => item.id) })]);
        const alert = created.rows[0];
        for (const item of events) await client.query('INSERT INTO alert_events(alert_id,event_id) VALUES ($1,$2)', [alert.id, item.id]);
        await client.query('COMMIT');
        return { id: alert.id, ruleId: rule.id, severity: rule.severity, eventIds: events.map(item => item.id), createdAt: alert.created_at.toISOString() };
      } catch { try { await client.query('ROLLBACK'); } catch {} throw new DetectionPersistenceError(); }
      finally { client.release(); }
    },
  };
}
module.exports = { detectionRepository, DetectionPersistenceError };
