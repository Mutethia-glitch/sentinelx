const { isIP } = require('node:net');
const { timestamp } = require('./model');
const { AuthError } = require('../auth/errors');
const TEXT = ['source', 'type', 'status', 'host', 'user', 'action'];
function eventQuery(params) {
  const bad = () => { throw new AuthError(400, 'Invalid event filters.'); };
  const allowed = ['q', ...TEXT, 'severity', 'sourceIp', 'destinationIp', 'from', 'to', 'page'];
  if (params.toString().length > 4096) bad();
  const result = { page: 1 };
  for (const [key, value] of params) {
    if (!allowed.includes(key) || params.getAll(key).length !== 1 || !value.trim() || value.includes('\0')) bad();
    if (key === 'page') {
      if (!/^[1-9]\d{0,3}$/.test(value) || Number(value) > 2000) bad();
      result.page = Number(value);
    } else if (key === 'from' || key === 'to') {
      try { result[key] = timestamp(value); } catch { bad(); }
    } else {
      if (value.length > (key === 'q' ? 200 : 500)) bad();
      result[key] = value.trim();
      if (key === 'severity' && !['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNKNOWN'].includes(result[key])) bad();
      if (['sourceIp', 'destinationIp'].includes(key) && !isIP(result[key])) bad();
    }
  }
  if (result.from && result.to && result.from > result.to) bad();
  return result;
}
module.exports = { eventQuery };
