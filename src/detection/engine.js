const { securityEvent } = require('../events/model');

const SUPPORTED_FIELDS = new Set(['source','type','sourceIp','destinationIp','user','host','action','status','severity']);

function validDefinition(definition) {
  if (!definition || definition.schemaVersion !== 1 || !Array.isArray(definition.conditions) ||
      !Number.isInteger(definition.threshold) || definition.threshold < 1 ||
      !Number.isInteger(definition.windowSeconds) || definition.windowSeconds < 1 ||
      !Array.isArray(definition.groupBy)) return false;
  return definition.conditions.every(c => c && SUPPORTED_FIELDS.has(c.field) &&
    ['equals','notEquals','in','exists'].includes(c.operator)) &&
    definition.groupBy.every(field => SUPPORTED_FIELDS.has(field));
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
    async evaluate(saved) {
      if (!saved?.id || !saved.event) return [];
      const event = securityEvent(saved.event);
      const rules = await repository.enabledRules();
      const alerts = [];
      for (const rule of rules) {
        if (!validDefinition(rule.definition) || !eventMatches(event, rule.definition)) continue;
        const group = groupValues(event, rule.definition.groupBy);
        const matches = await repository.matchingEvents(rule.definition, event, group);
        if (matches.length < rule.definition.threshold) continue;
        const selected = matches.slice(-rule.definition.threshold);
        const alert = await repository.createAlert(rule, selected, {
          triggerEventId: saved.id,
          threshold: rule.definition.threshold,
          windowSeconds: rule.definition.windowSeconds,
          groupBy: rule.definition.groupBy,
          groupValues: group,
        });
        if (alert) alerts.push(alert);
      }
      return alerts;
    },
  };
}
module.exports = { detectionEngine, validDefinition, conditionMatches, eventMatches, groupValues };
