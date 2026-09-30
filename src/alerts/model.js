const { AuthError } = require('../auth/errors');
const ALERT_STATUS = 'NEW';
const ALERT_STATUSES = Object.freeze(['NEW', 'ACKNOWLEDGED']);
const ENTITY_FIELDS = Object.freeze(['sourceIp', 'destinationIp', 'user', 'host']);

function affectedEntities(event) {
  const entities = {};
  for (const field of ENTITY_FIELDS) {
    const value = event?.[field];
    if (value !== null && value !== undefined) entities[field] = value;
  }
  return entities;
}
function generatedAlert(rule, event, triggerEventId) {
  return {
    ruleId: rule.id,
    triggerEventId,
    threat: rule.categoryCode,
    severity: rule.severity,
    source: event.source,
    affectedEntities: affectedEntities(event),
    status: ALERT_STATUS,
    confidence: null,
  };
}
function alertId(id) {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) {
    throw new AuthError(400, 'Invalid alert identifier.');
  }
  return id;
}
function statusUpdateInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).sort().join(',') !== 'reason,status' ||
      !ALERT_STATUSES.includes(body.status) ||
      typeof body.reason !== 'string' || !body.reason.trim() ||
      body.reason.length > 500 || body.reason.includes('\0')) {
    throw new AuthError(400, 'Provide an approved alert status and reason.');
  }
  return { status: body.status, reason: body.reason.trim() };
}
module.exports = { ALERT_STATUS, ALERT_STATUSES, ENTITY_FIELDS, affectedEntities, generatedAlert, alertId, statusUpdateInput };
