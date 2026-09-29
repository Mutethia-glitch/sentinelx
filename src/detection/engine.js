const { isIP } = require('node:net');
const { securityEvent } = require('../events/model');

const SUPPORTED_FIELDS = new Set(['source','type','sourceIp','destinationIp','user','host','action','status','severity']);
const OPERATORS = new Set(['equals','notEquals','in','exists']);
const SEVERITIES = new Set(['LOW','MEDIUM','HIGH','CRITICAL']);

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).sort().join(',') === [...keys].sort().join(',');
}
function validValue(field, value) {
  if (value === null) return true;
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > 500 || value.includes('\0')) return false;
  if (['sourceIp','destinationIp'].includes(field) && !isIP(value)) return false;
  if (field === 'severity' && !SEVERITIES.has(value)) return false;
  return true;
}
function validDefinition(definition) {
  if (!exactKeys(definition, ['schemaVersion','conditions','threshold','windowSeconds','groupBy']) ||
      definition.schemaVersion !== 1 ||
      !Number.isInteger(definition.threshold) || definition.threshold < 1 || definition.threshold > 10000 ||
      !Number.isInteger(definition.windowSeconds) || definition.windowSeconds < 1 || definition.windowSeconds > 86400 ||
      !Array.isArray(definition.conditions) || definition.conditions.length < 1 || definition.conditions.length > 10 ||
      !Array.isArray(definition.groupBy) || definition.groupBy.length > 3 ||
      new Set(definition.groupBy).size !== definition.groupBy.length ||
      definition.groupBy.some(field => !SUPPORTED_FIELDS.has(field))) return false;
  return definition.conditions.every(condition => {
    if (!exactKeys(condition, ['field','operator','value']) || !SUPPORTED_FIELDS.has(condition.field) || !OPERATORS.has(condition.operator)) return false;
    if (condition.operator === 'exists') return typeof condition.value === 'boolean';
    if (condition.operator === 'in') {
      return Array.isArray(condition.value) && condition.value.length >= 1 && condition.value.length <= 10 &&
        new Set(condition.value).size === condition.value.length &&
        condition.value.every(value => validValue(condition.field, value));
    }
    return validValue(condition.field, condition.value);
  });
}
function conditionMatches(event, condition) {
  const value = event[condition.field] ?? null;
  if (condition.operator === 'equals') return value === condition.value;
  if (condition.operator === 'notEquals') return value !== condition.value;
  if (condition.operator === 'in') return condition.value.includes(value);
  if (condition.operator === 'exists') return (value !== null) === condition.value;
  return false;
}
function eventMatches(event, definition) {
  return validDefinition(definition) && definition.conditions.every(condition => conditionMatches(event, condition));
}
function groupValues(event, fields) { return fields.map(field => event[field] ?? null); }
function detectionEngine(repository) {
  return {
    async evaluate(saved, db = null) {
      if (!saved?.id || !saved.event) return [];
      const event = securityEvent(saved.event);
      const rules = await repository.enabledRules(db);
      const alerts = [];
      for (const rule of rules) {
        if (!validDefinition(rule.definition) || !eventMatches(event, rule.definition)) continue;
        const group = groupValues(event, rule.definition.groupBy);
        const matches = await repository.matchingEvents(rule.definition, event, group, db);
        if (matches.length < rule.definition.threshold) continue;
        const selected = matches.slice(-rule.definition.threshold);
        const alert = await repository.createAlert(rule, selected, {
          triggerEventId: saved.id,
          threshold: rule.definition.threshold,
          windowSeconds: rule.definition.windowSeconds,
          groupBy: rule.definition.groupBy,
          groupValues: group,
        }, db);
        if (alert) alerts.push(alert);
      }
      return alerts;
    },
  };
}
module.exports = { detectionEngine, validDefinition, conditionMatches, eventMatches, groupValues };
