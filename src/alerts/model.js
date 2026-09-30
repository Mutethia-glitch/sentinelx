const ALERT_STATUS = 'NEW';
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

module.exports = { ALERT_STATUS, ENTITY_FIELDS, affectedEntities, generatedAlert };
