const { isIP } = require('node:net');
const { categoryCode } = require('../threats/taxonomy');
const { AuthError } = require('../auth/errors');
const FIELDS = Object.freeze(['source', 'type', 'sourceIp', 'destinationIp', 'user', 'host', 'action', 'status', 'severity']);
const fail = () => { throw new AuthError(400, 'Invalid detection rule configuration.'); };
function exact(object, keys) {
  if (!object || typeof object !== 'object' || Array.isArray(object) || Object.keys(object).sort().join(',') !== [...keys].sort().join(',')) fail();
}
function text(value, maximum, required = true) {
  if (typeof value !== 'string' || value.length > maximum || value.includes('\0') || (required && !value.trim())) fail();
  return value.trim();
}
function conditionValue(field, value) {
  if (value === null) return null;
  const result = text(value, 500);
  if (['sourceIp', 'destinationIp'].includes(field) && !isIP(result)) fail();
  if (field === 'severity' && !['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(result)) fail();
  return result;
}
function ruleInput(body, updating = false) {
  const keys = ['name', 'description', 'enabled', 'severity', 'categoryCode', 'conditions', 'threshold', 'windowSeconds', 'groupBy', 'mitreTechniqueIds', 'reason'];
  exact(body, updating ? [...keys, 'version'] : keys);
  const data = { name: text(body.name, 100), description: text(body.description, 2000, false), enabled: body.enabled, severity: body.severity, categoryCode: categoryCode(body.categoryCode), reason: text(body.reason, 500) };
  if (typeof data.enabled !== 'boolean' || !['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(data.severity)) fail();
  if (!Number.isInteger(body.threshold) || body.threshold < 1 || body.threshold > 10000 || !Number.isInteger(body.windowSeconds) || body.windowSeconds < 1 || body.windowSeconds > 86400) fail();
  if (!Array.isArray(body.conditions) || body.conditions.length < 1 || body.conditions.length > 10) fail();
  const conditions = body.conditions.map(condition => {
    exact(condition, ['field', 'operator', 'value']);
    if (!FIELDS.includes(condition.field) || !['equals', 'notEquals', 'in', 'exists'].includes(condition.operator)) fail();
    let value;
    if (condition.operator === 'exists') { if (typeof condition.value !== 'boolean') fail(); value = condition.value; }
    else if (condition.operator === 'in') {
      if (!Array.isArray(condition.value) || !condition.value.length || condition.value.length > 10) fail();
      value = condition.value.map(item => conditionValue(condition.field, item));
      if (new Set(value).size !== value.length) fail();
    } else value = conditionValue(condition.field, condition.value);
    return { field: condition.field, operator: condition.operator, value };
  });
  if (!Array.isArray(body.groupBy) || body.groupBy.length > 3 || new Set(body.groupBy).size !== body.groupBy.length || body.groupBy.some(field => !FIELDS.includes(field))) fail();
  if (!Array.isArray(body.mitreTechniqueIds) || body.mitreTechniqueIds.length > 5 || new Set(body.mitreTechniqueIds).size !== body.mitreTechniqueIds.length || body.mitreTechniqueIds.some(id => typeof id !== 'string' || !/^T\d{4}(?:\.\d{3})?$/.test(id))) fail();
  data.definition = { schemaVersion: 1, conditions, threshold: body.threshold, windowSeconds: body.windowSeconds, groupBy: [...body.groupBy] };
  data.mitreTechniqueIds = [...body.mitreTechniqueIds].sort();
  if (updating) { if (!Number.isInteger(body.version) || body.version < 1 || body.version >= 2147483647) fail(); data.version = body.version; }
  return data;
}
function ruleId(id) {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) throw new AuthError(400, 'Invalid rule identifier.');
  return id;
}
module.exports = { FIELDS, ruleInput, ruleId };
