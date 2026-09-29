const { isIP } = require('node:net');
class EventValidationError extends Error {
  constructor() { super('Invalid security event.'); this.name = 'EventValidationError'; }
}
const fail = () => { throw new EventValidationError(); };
function text(value, required = false) {
  if (value === undefined || value === null) { if (required) fail(); return null; }
  if (typeof value !== 'string' || !value.trim() || value.length > 500 || value.includes('\0')) fail();
  return value.trim();
}
function jsonObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
  // Accept JSON values only; reject silent JSON.stringify coercion or lost evidence.
  function check(item, depth = 0) {
    if (depth > 32) fail();
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return;
    if (typeof item === 'number' && Number.isFinite(item)) return;
    if (!item || typeof item !== 'object' || (!Array.isArray(item) && Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null)) fail();
    for (const child of Object.values(item)) check(child, depth + 1);
  }
  check(value);
  const encoded = JSON.stringify(value);
  if (Buffer.byteLength(encoded) > 262144 || encoded.includes('\\u0000')) fail();
  return JSON.parse(encoded);
}
function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) fail();
  const [hour, minute, second] = value.slice(11, 19).split(':').map(Number);
  if (hour > 23 || minute > 59 || second > 59) fail();
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate() || !Number.isFinite(Date.parse(value))) fail();
  return new Date(value).toISOString();
}
const fields = ['timestamp', 'source', 'type', 'sourceIp', 'destinationIp', 'user', 'host', 'action', 'status', 'severity', 'rawData', 'metadata'];
function securityEvent(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !fields.includes(key))) fail();
  const result = { timestamp: timestamp(input.timestamp), source: text(input.source, true), type: text(input.type, true) };
  for (const field of ['sourceIp', 'destinationIp']) {
    result[field] = text(input[field]);
    if (result[field] !== null && !isIP(result[field])) fail();
  }
  for (const field of ['user', 'host', 'action', 'status']) result[field] = text(input[field]);
  result.severity = input.severity ?? null;
  if (result.severity !== null && !['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(result.severity)) fail();
  result.rawData = jsonObject(input.rawData);
  result.metadata = jsonObject(input.metadata ?? {});
  return result;
}
module.exports = { securityEvent, jsonObject, timestamp, EventValidationError };
