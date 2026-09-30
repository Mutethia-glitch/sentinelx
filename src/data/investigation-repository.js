const { transaction } = require('./auth-repository');
const { requirePermission } = require('../access/policy');
const { AuthError } = require('../auth/errors');

class InvestigationPersistenceError extends Error {
  constructor() {
    super('Investigation persistence unavailable.');
    this.name = 'InvestigationPersistenceError';
  }
}

const ENTITY_FIELDS = Object.freeze(['user', 'host', 'sourceIp', 'destinationIp']);

function noteView(row) {
  return {
    id: row.id,
    incidentId: row.incident_id,
    author: { id: row.author_id, displayName: row.author_name ?? null },
    content: row.content,
    evidence: row.evidence || { alertIds: [], eventIds: [] },
    createdAt: row.created_at.toISOString(),
  };
}

function affectedEntities(alerts, events) {
  const values = Object.fromEntries(ENTITY_FIELDS.map(field => [field, new Set()]));
  for (const alert of alerts) {
    for (const field of ENTITY_FIELDS) {
      const value = alert.affectedEntities?.[field];
      if (value !== null && value !== undefined && value !== '') values[field].add(value);
    }
  }
  for (const event of events) {
    for (const field of ENTITY_FIELDS) {
      const value = event[field];
      if (value !== null && value !== undefined && value !== '') values[field].add(value);
    }
  }
  return Object.fromEntries(ENTITY_FIELDS.map(field => [field, [...values[field]].sort()]));
}

function historySummary(entry) {
  const action = entry.action;
  const context = entry.context || {};
  if (action === 'RESPONSE_ACTION_RECORDED') return `Manual ${context.action ?? 'response'} recorded (${context.succeeded ? 'reported success' : 'reported failure'}).`;
  if (action === 'INCIDENT_ASSIGNMENT_CHANGED') return 'Incident assignment changed.';
  if (action === 'INCIDENT_STATUS_CHANGED') return `Incident status changed to ${context.status ?? 'another state'}.`;
  if (action === 'INCIDENT_ASSESSMENT_CHANGED') return `Incident assessment changed to ${context.severity ?? 'updated severity'} / ${context.categoryCode ?? 'unclassified'}.`;
  return action.replaceAll('_', ' ').toLowerCase().replace(/^./, character => character.toUpperCase()) + '.';
}

function buildTimeline(incident, alerts, events, notes, history) {
  const items = [{
    type: 'INCIDENT_CREATED',
    timestamp: incident.createdAt,
    id: incident.id,
    summary: 'Incident created.',
    details: {},
  }];
  for (const event of events) items.push({
    type: 'SECURITY_EVENT', timestamp: event.timestamp, id: event.id,
    summary: `${event.source} / ${event.type}`,
    details: { severity: event.severity, user: event.user, host: event.host, action: event.action, status: event.status },
  });
  for (const alert of alerts) items.push({
    type: 'ALERT', timestamp: alert.timestamp, id: alert.id,
    summary: `${alert.severity} ${alert.threat} alert`,
    details: { ruleName: alert.ruleName, status: alert.status, source: alert.source },
  });
  for (const entry of history) {
    if (entry.action === 'INCIDENT_CREATED' || entry.action === 'INVESTIGATION_NOTE_ADDED') continue;
    items.push({
      type: 'INCIDENT_HISTORY', timestamp: entry.timestamp, id: entry.id,
      summary: historySummary(entry),
      details: { action: entry.action, actor: entry.actor, context: entry.context },
    });
  }
  for (const note of notes) items.push({
    type: 'INVESTIGATION_NOTE', timestamp: note.createdAt, id: note.id,
    summary: `Finding recorded by ${note.author.displayName ?? 'analyst'}.`,
    details: { content: note.content, evidence: note.evidence, author: note.author },
  });
  const order = { SECURITY_EVENT: 1, ALERT: 2, INCIDENT_CREATED: 3, INCIDENT_HISTORY: 4, INVESTIGATION_NOTE: 5 };
  return items.sort((left, right) =>
    left.timestamp.localeCompare(right.timestamp) ||
    (order[left.type] - order[right.type]) ||
    left.id.localeCompare(right.id));
}

async function rolesFor(client, userId) {
  const result = await client.query(`SELECT r.name FROM user_roles ur
    JOIN roles r ON r.id=ur.role_id JOIN users u ON u.id=ur.user_id
    WHERE u.id=$1 AND u.active ORDER BY r.name`, [userId]);
  return result.rows.map(row => row.name);
}

function investigationRepository(pool) {
  function failure(error) {
    if (error instanceof AuthError) throw error;
    if (['23503', '23514', '22P02'].includes(error?.code)) throw new AuthError(400, 'Invalid investigation evidence.');
    throw new InvestigationPersistenceError();
  }

  async function incidentRow(client, id) {
    return (await client.query(`SELECT i.*,u.display_name AS assigned_name
      FROM incidents i LEFT JOIN users u ON u.id=i.assigned_to WHERE i.id=$1`, [id])).rows[0] || null;
  }

  async function readAlerts(client, id) {
    return (await client.query(`SELECT a.id,a.category_code,a.threat_level,a.source,a.affected_entities,
      a.status,a.created_at,a.match_reason,r.name AS rule_name
      FROM incident_alerts ia JOIN alerts a ON a.id=ia.alert_id
      JOIN detection_rules r ON r.id=a.rule_id
      WHERE ia.incident_id=$1 ORDER BY a.created_at ASC,a.id ASC`, [id])).rows.map(row => ({
        id: row.id,
        threat: row.category_code,
        severity: row.threat_level,
        source: row.source,
        affectedEntities: row.affected_entities || {},
        status: row.status,
        timestamp: row.created_at.toISOString(),
        matchReason: row.match_reason,
        ruleName: row.rule_name,
      }));
  }

  async function readEvents(client, id) {
    return (await client.query(`SELECT DISTINCT e.id,e.source,e.event_type,e.occurred_at,e.received_at,
      e.normalized_data->>'severity' AS severity,e.normalized_data->>'user' AS "user",
      e.normalized_data->>'host' AS host,e.normalized_data->>'sourceIp' AS "sourceIp",
      e.normalized_data->>'destinationIp' AS "destinationIp",
      e.normalized_data->>'action' AS action,e.normalized_data->>'status' AS status
      FROM incident_alerts ia JOIN alert_events ae ON ae.alert_id=ia.alert_id
      JOIN security_events e ON e.id=ae.event_id
      WHERE ia.incident_id=$1 ORDER BY e.occurred_at ASC,e.id ASC`, [id])).rows.map(row => ({
        id: row.id,
        source: row.source,
        type: row.event_type,
        timestamp: row.occurred_at.toISOString(),
        receivedAt: row.received_at.toISOString(),
        severity: row.severity ?? null,
        user: row.user ?? null,
        host: row.host ?? null,
        sourceIp: row.sourceIp ?? null,
        destinationIp: row.destinationIp ?? null,
        action: row.action ?? null,
        status: row.status ?? null,
      }));
  }

  async function readNotes(client, id) {
    return (await client.query(`SELECT n.*,u.display_name AS author_name
      FROM investigation_notes n JOIN users u ON u.id=n.author_id
      WHERE n.incident_id=$1 ORDER BY n.created_at ASC,n.id ASC`, [id])).rows.map(noteView);
  }

  async function readHistory(client, id) {
    return (await client.query(`SELECT a.id,a.action,a.context,a.occurred_at,a.actor_id,u.display_name AS actor_name
      FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id
      WHERE a.target_type='incident' AND a.target_id=$1
      ORDER BY a.occurred_at ASC,a.id ASC`, [id])).rows.map(row => ({
        id: row.id,
        action: row.action,
        context: row.context || {},
        timestamp: row.occurred_at.toISOString(),
        actor: row.actor_id ? { id: row.actor_id, displayName: row.actor_name ?? null } : null,
      }));
  }

  return {
    async get(id) {
      try {
        const incident = await incidentRow(pool, id);
        if (!incident) return null;
        const [alerts, events, notes, history] = await Promise.all([
          readAlerts(pool, id), readEvents(pool, id), readNotes(pool, id), readHistory(pool, id),
        ]);
        const view = {
          id: incident.id,
          title: incident.title,
          status: incident.status,
          severity: incident.threat_level,
          categoryCode: incident.category_code ?? null,
          createdAt: incident.created_at.toISOString(),
          updatedAt: incident.updated_at.toISOString(),
          assignedTo: incident.assigned_to ? { id: incident.assigned_to, displayName: incident.assigned_name ?? null } : null,
          risk: {
            score: Number(incident.risk_score),
            eventCount: Number(incident.risk_event_count),
            formulaVersion: Number(incident.risk_formula_version),
            calculatedAt: incident.risk_calculated_at.toISOString(),
          },
        };
        return {
          incident: view,
          affectedEntities: affectedEntities(alerts, events),
          alerts,
          events,
          notes,
          timeline: buildTimeline(view, alerts, events, notes, history),
        };
      } catch (error) { failure(error); }
    },

    async addNote(actorId, incidentId, input) {
      try {
        return await transaction(pool, async client => {
          const actor = (await client.query('SELECT id,display_name FROM users WHERE id=$1 AND active FOR SHARE', [actorId])).rows[0];
          if (!actor) throw new AuthError(403, 'Permission denied.');
          requirePermission(await rolesFor(client, actorId), 'investigations.write');
          const incident = await client.query('SELECT id FROM incidents WHERE id=$1 FOR SHARE', [incidentId]);
          if (!incident.rows[0]) throw new AuthError(404, 'Incident not found.');

          if (input.alertIds.length) {
            const linked = await client.query(`SELECT alert_id FROM incident_alerts
              WHERE incident_id=$1 AND alert_id=ANY($2::uuid[])`, [incidentId, input.alertIds]);
            if (linked.rows.length !== input.alertIds.length) throw new AuthError(400, 'Investigation note references an unrelated alert.');
          }
          if (input.eventIds.length) {
            const linked = await client.query(`SELECT DISTINCT ae.event_id FROM incident_alerts ia
              JOIN alert_events ae ON ae.alert_id=ia.alert_id
              WHERE ia.incident_id=$1 AND ae.event_id=ANY($2::uuid[])`, [incidentId, input.eventIds]);
            if (linked.rows.length !== input.eventIds.length) throw new AuthError(400, 'Investigation note references an unrelated event.');
          }

          const evidence = { alertIds: input.alertIds, eventIds: input.eventIds };
          const row = (await client.query(`INSERT INTO investigation_notes(incident_id,author_id,content,evidence)
            VALUES($1,$2,$3,$4::jsonb) RETURNING *`,
          [incidentId, actorId, input.content, JSON.stringify(evidence)])).rows[0];
          row.author_name = actor.display_name;

          await client.query(`INSERT INTO audit_logs(actor_id,actor_context,action,target_type,target_id,context)
            VALUES($1,'authenticated investigator','INVESTIGATION_NOTE_ADDED','incident',$2,$3::jsonb)`,
          [actorId, incidentId, JSON.stringify({ noteId: row.id, evidence })]);

          return noteView(row);
        });
      } catch (error) { failure(error); }
    },
  };
}

module.exports = {
  investigationRepository,
  InvestigationPersistenceError,
  ENTITY_FIELDS,
  affectedEntities,
  buildTimeline,
};
