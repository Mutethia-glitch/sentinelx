const { transaction } = require('./auth-repository');
const { accessForRoles, requirePermission } = require('../access/policy');
const { AuthError } = require('../auth/errors');
const { mlEvidenceView } = require('../ml/integration');

class IncidentPersistenceError extends Error {
  constructor() { super('Incident persistence unavailable.'); this.name = 'IncidentPersistenceError'; }
}
const SEVERITY_RANK = Object.freeze({ LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 });
const TERMINAL = new Set(['RESOLVED', 'DISMISSED']);
const TRANSITIONS = Object.freeze({
  NEW: Object.freeze(['INVESTIGATING', 'RESOLVED', 'DISMISSED']),
  INVESTIGATING: Object.freeze(['RESOLVED', 'DISMISSED']),
  CONTAINED: Object.freeze(['INVESTIGATING', 'RESOLVED', 'DISMISSED']),
  RESOLVED: Object.freeze([]),
  DISMISSED: Object.freeze([]),
});
function summary(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    severity: row.threat_level,
    categoryCode: row.category_code ?? null,
    assignedTo: row.assigned_to ? { id: row.assigned_to, displayName: row.assigned_name ?? null } : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: (row.updated_at ?? row.created_at).toISOString(),
    assignmentUpdatedAt: row.assignment_updated_at?.toISOString() ?? null,
    assignmentUpdatedBy: row.assignment_updated_by ?? null,
    statusUpdatedAt: row.status_updated_at?.toISOString() ?? null,
    statusUpdatedBy: row.status_updated_by ?? null,
    assessmentUpdatedAt: row.assessment_updated_at?.toISOString() ?? null,
    assessmentUpdatedBy: row.assessment_updated_by ?? null,
    risk: row.risk_score === undefined ? null : {
      score: Number(row.risk_score),
      eventCount: Number(row.risk_event_count),
      formulaVersion: Number(row.risk_formula_version),
      calculatedAt: row.risk_calculated_at.toISOString(),
    },
    resolutionNote: row.resolution_note ?? null,
    resolutionAt: row.resolution_at?.toISOString() ?? null,
    resolutionBy: row.resolution_by ?? null,
  };
}
async function rolesFor(client, userId) {
  const result = await client.query(`SELECT r.name FROM user_roles ur JOIN roles r ON r.id=ur.role_id
    JOIN users u ON u.id=ur.user_id WHERE u.id=$1 AND u.active ORDER BY r.name`, [userId]);
  return result.rows.map(row => row.name);
}
async function actor(client, actorId) {
  const result = await client.query('SELECT id FROM users WHERE id=$1 AND active FOR SHARE', [actorId]);
  if (!result.rows[0]) throw new AuthError(403, 'Permission denied.');
  requirePermission(await rolesFor(client, actorId), 'incidents.manage');
}
async function assignee(client, userId) {
  if (userId === null) return null;
  const result = await client.query('SELECT id,display_name FROM users WHERE id=$1 AND active FOR SHARE', [userId]);
  if (!result.rows[0]) throw new AuthError(400, 'Assignee must be an active incident manager.');
  const access = accessForRoles(await rolesFor(client, userId));
  if (!access.permissions.includes('incidents.manage')) throw new AuthError(400, 'Assignee must be an active incident manager.');
  return result.rows[0];
}
function highestSeverity(rows) {
  return rows.reduce((best, row) => SEVERITY_RANK[row.threat_level] > SEVERITY_RANK[best] ? row.threat_level : best, 'LOW');
}
function commonCategory(rows) {
  const values = [...new Set(rows.map(row => row.category_code).filter(Boolean))];
  return values.length === 1 && rows.every(row => row.category_code === values[0]) ? values[0] : null;
}
function incidentRepository(pool) {
  const SELECT = `SELECT i.*,u.display_name AS assigned_name FROM incidents i LEFT JOIN users u ON u.id=i.assigned_to`;
  function failure(error) {
    if (error instanceof AuthError) throw error;
    if (error?.code === '23503' || error?.code === '23514' || error?.code === '22P02') throw new AuthError(400, 'Invalid incident references or state.');
    throw new IncidentPersistenceError();
  }
  async function read(client, id) {
    const row = (await client.query(`${SELECT} WHERE i.id=$1`, [id])).rows[0];
    return row ? summary(row) : null;
  }
  async function refreshRisk(client, id) {
    const count = (await client.query(`SELECT count(DISTINCT ae.event_id)::integer AS event_count
      FROM incident_alerts ia JOIN alert_events ae ON ae.alert_id=ia.alert_id WHERE ia.incident_id=$1`, [id])).rows[0].event_count;
    await client.query('UPDATE incidents SET risk_event_count=$2 WHERE id=$1', [id, count]);
  }
  return {
    async list(filters) {
      const values = [], conditions = [];
      const add = value => { values.push(value); return '$' + values.length; };
      if (filters.status) conditions.push(`i.status=${add(filters.status)}::incident_status`);
      if (filters.severity) conditions.push(`i.threat_level=${add(filters.severity)}::threat_level`);
      if(filters.categoryCode==='UNCLASSIFIED')conditions.push('i.category_code IS NULL');
      else if(filters.categoryCode)conditions.push('i.category_code='+add(filters.categoryCode));
      if (filters.assignedTo === 'UNASSIGNED') conditions.push('i.assigned_to IS NULL');
      else if (filters.assignedTo) conditions.push(`i.assigned_to=${add(filters.assignedTo)}::uuid`);
      if (filters.from) conditions.push(`i.created_at>=${add(filters.from)}::timestamptz`);
      if (filters.to) conditions.push(`i.created_at<=${add(filters.to)}::timestamptz`);
      const evidence=[];
      if(filters.source)evidence.push('a.source='+add(filters.source));
      if(filters.ruleId)evidence.push('a.rule_id='+add(filters.ruleId)+'::uuid');
      if(filters.mitreTechniqueId)evidence.push(
        'EXISTS (SELECT 1 FROM rule_mitre_mappings rmm JOIN mitre_mappings m ON m.id=rmm.mapping_id '+
        'WHERE rmm.rule_id=a.rule_id AND m.technique_id='+add(filters.mitreTechniqueId)+')');
      for(const field of ['sourceIp','destinationIp','user','host']){
        if(filters[field])evidence.push("e.normalized_data->>'"+field+"'="+add(filters[field]));
      }
      if(evidence.length)conditions.push(
        'EXISTS (SELECT 1 FROM incident_alerts ia JOIN alerts a ON a.id=ia.alert_id '+
        'JOIN alert_events ae ON ae.alert_id=a.id JOIN security_events e ON e.id=ae.event_id '+
        'WHERE ia.incident_id=i.id AND '+evidence.join(' AND ')+')');
      if (filters.q) {
        const escaped = filters.q.replace(/[\\%_]/g, char => `\\${char}`), pattern = add(`%${escaped}%`);
        conditions.push(`(i.title ILIKE ${pattern} ESCAPE '\\' OR i.description ILIKE ${pattern} ESCAPE '\\' OR coalesce(i.category_code,'') ILIKE ${pattern} ESCAPE '\\' OR coalesce(u.display_name,'') ILIKE ${pattern} ESCAPE '\\')`);
      }
      const offset = add((filters.page - 1) * 50);
      try {
        const result = await pool.query(`${SELECT} ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
          ORDER BY i.created_at DESC,i.id DESC LIMIT 51 OFFSET ${offset}`, values);
        return { incidents: result.rows.slice(0, 50).map(summary), page: filters.page, pageSize: 50, hasMore: result.rows.length > 50 && filters.page < 2000 };
      } catch (error) { failure(error); }
    },
    async get(id) {
      try {
        const incident = await read(pool, id);
        if (!incident) return null;
        const alerts = (await pool.query(`SELECT a.id,a.category_code,a.threat_level,a.source,a.created_at,a.status,a.match_evidence,r.name AS rule_name
          FROM incident_alerts ia JOIN alerts a ON a.id=ia.alert_id JOIN detection_rules r ON r.id=a.rule_id
          WHERE ia.incident_id=$1 ORDER BY a.created_at ASC,a.id ASC`, [id])).rows.map(row => ({
            id: row.id, threat: row.category_code, severity: row.threat_level, source: row.source,
            timestamp: row.created_at.toISOString(), status: row.status, ruleName: row.rule_name,
            mlEvidence: mlEvidenceView(row.match_evidence),
          }));
        return { ...incident, alerts };
      } catch (error) { failure(error); }
    },
    async create(actorId, data) {
      try {
        return await transaction(pool, async client => {
          await actor(client, actorId);
          await assignee(client, data.assignedTo);
          const alerts = (await client.query(`SELECT id,threat_level,category_code FROM alerts
            WHERE id=ANY($1::uuid[]) ORDER BY id FOR SHARE`, [data.alertIds])).rows;
          if (alerts.length !== data.alertIds.length) throw new AuthError(400, 'Select existing alerts.');
          const severity = highestSeverity(alerts);
          let categoryCode = commonCategory(alerts);
          if (categoryCode) {
            const selectable = await client.query('SELECT enabled FROM threat_categories WHERE code=$1 FOR SHARE', [categoryCode]);
            if (!selectable.rows[0]?.enabled) categoryCode = null;
          }
          const row = (await client.query(`INSERT INTO incidents(title,description,status,threat_level,category_code,assigned_to,
            assignment_updated_at,assignment_updated_by,updated_at)
            VALUES($1,$2,'NEW',$3,$4,$5,CASE WHEN $5::uuid IS NULL THEN NULL ELSE clock_timestamp() END,
              CASE WHEN $5::uuid IS NULL THEN NULL ELSE $6::uuid END,clock_timestamp()) RETURNING id`,
          [data.title, data.description, severity, categoryCode, data.assignedTo, actorId])).rows[0];
          for (const alertId of data.alertIds) await client.query('INSERT INTO incident_alerts(incident_id,alert_id) VALUES($1,$2)', [row.id, alertId]);
          await refreshRisk(client, row.id);
          await client.query(`INSERT INTO audit_logs(actor_id,actor_context,action,target_type,target_id,context)
            VALUES($1,'authenticated incident manager','INCIDENT_CREATED','incident',$2,$3::jsonb)`,
          [actorId, row.id, JSON.stringify({ alertIds: data.alertIds, severity, categoryCode, assignedTo: data.assignedTo, reason: data.reason })]);
          return read(client, row.id);
        });
      } catch (error) { failure(error); }
    },
    async updateAssignment(actorId, id, input) {
      try {
        return await transaction(pool, async client => {
          await actor(client, actorId);
          await assignee(client, input.assignedTo);
          const current = (await client.query(`${SELECT} WHERE i.id=$1 FOR UPDATE OF i`, [id])).rows[0];
          if (!current) throw new AuthError(404, 'Incident not found.');
          if (TERMINAL.has(current.status)) throw new AuthError(409, 'Terminal incident cannot be reassigned.');
          if ((current.assigned_to ?? null) === input.assignedTo) return { ...summary(current), changed: false };
          await client.query(`UPDATE incidents SET assigned_to=$2,assignment_updated_at=clock_timestamp(),assignment_updated_by=$3,updated_at=clock_timestamp() WHERE id=$1`, [id, input.assignedTo, actorId]);
          await client.query(`INSERT INTO audit_logs(actor_id,actor_context,action,target_type,target_id,context)
            VALUES($1,'authenticated incident manager','INCIDENT_ASSIGNMENT_CHANGED','incident',$2,$3::jsonb)`,
          [actorId, id, JSON.stringify({ previousAssignedTo: current.assigned_to ?? null, assignedTo: input.assignedTo, reason: input.reason })]);
          return { ...(await read(client, id)), changed: true };
        });
      } catch (error) { failure(error); }
    },
    async updateAssessment(actorId, id, input) {
      try {
        return await transaction(pool, async client => {
          await actor(client, actorId);
          const current = (await client.query(`${SELECT} WHERE i.id=$1 FOR UPDATE OF i`, [id])).rows[0];
          if (!current) throw new AuthError(404, 'Incident not found.');
          const previousCategoryCode = current.category_code ?? null;
          if (input.categoryCode !== previousCategoryCode && input.categoryCode !== null) {
            const selected = await client.query('SELECT code FROM threat_categories WHERE code=$1 AND enabled FOR SHARE', [input.categoryCode]);
            if (!selected.rows[0]) throw new AuthError(400, 'Threat category is not selectable.');
          }
          if (previousCategoryCode === input.categoryCode && current.threat_level === input.severity) {
            return { ...summary(current), changed: false };
          }
          await client.query(`UPDATE incidents SET category_code=$2,threat_level=$3,
            assessment_updated_at=clock_timestamp(),assessment_updated_by=$4,updated_at=clock_timestamp()
            WHERE id=$1`, [id, input.categoryCode, input.severity, actorId]);
          await client.query(`INSERT INTO audit_logs(actor_id,actor_context,action,target_type,target_id,context)
            VALUES($1,'authenticated incident manager','INCIDENT_ASSESSMENT_CHANGED','incident',$2,$3::jsonb)`,
          [actorId, id, JSON.stringify({
            previousCategoryCode, categoryCode: input.categoryCode,
            previousSeverity: current.threat_level, severity: input.severity, reason: input.reason,
          })]);
          return { ...(await read(client, id)), changed: true };
        });
      } catch (error) { failure(error); }
    },
    async updateStatus(actorId, id, input) {
      try {
        return await transaction(pool, async client => {
          await actor(client, actorId);
          const current = (await client.query(`${SELECT} WHERE i.id=$1 FOR UPDATE OF i`, [id])).rows[0];
          if (!current) throw new AuthError(404, 'Incident not found.');
          if (current.status === input.status) return { ...summary(current), changed: false };
          if (!TRANSITIONS[current.status]?.includes(input.status)) throw new AuthError(409, 'Incident status transition is not permitted.');
          const terminal = TERMINAL.has(input.status);
          await client.query(`UPDATE incidents SET status=$2,status_updated_at=clock_timestamp(),status_updated_by=$3,updated_at=clock_timestamp(),
            resolution_note=CASE WHEN $4 THEN $5 ELSE resolution_note END,
            resolution_at=CASE WHEN $4 THEN clock_timestamp() ELSE resolution_at END,
            resolution_by=CASE WHEN $4 THEN $3::uuid ELSE resolution_by END WHERE id=$1`,
          [id, input.status, actorId, terminal, input.resolutionNote]);
          await client.query(`INSERT INTO audit_logs(actor_id,actor_context,action,target_type,target_id,context)
            VALUES($1,'authenticated incident manager','INCIDENT_STATUS_CHANGED','incident',$2,$3::jsonb)`,
          [actorId, id, JSON.stringify({ previousStatus: current.status, status: input.status, reason: input.reason, resolutionNote: terminal ? input.resolutionNote : null })]);
          return { ...(await read(client, id)), changed: true };
        });
      } catch (error) { failure(error); }
    },
  };
}
module.exports = { incidentRepository, IncidentPersistenceError, SEVERITY_RANK, TRANSITIONS, highestSeverity, commonCategory };
