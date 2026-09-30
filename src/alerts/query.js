const { AuthError } = require('../auth/errors');
const { CATEGORY_CODES } = require('../threats/taxonomy');
const { ALERT_STATUSES } = require('./model');
const { timestamp } = require('../events/model');

function alertQuery(params) {
  const bad = () => { throw new AuthError(400, 'Invalid alert filters.'); };
  const allowed = ['q', 'status', 'severity', 'categoryCode', 'source', 'ruleId', 'from', 'to', 'page'];
  if (params.toString().length > 4096) bad();
  const result = { page: 1 };
  for (const [key, value] of params) {
    if (!allowed.includes(key) || params.getAll(key).length !== 1 || !value.trim() || value.includes('\0')) bad();
    if (key === 'page') {
      if (!/^[1-9]\d{0,3}$/.test(value) || Number(value) > 2000) bad();
      result.page = Number(value);
    } else if (key === 'from' || key === 'to') {
      try { result[key] = timestamp(value); } catch { bad(); }
    } else if (key === 'ruleId') {
      if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) bad();
      result.ruleId = value;
    } else {
      const maximum = key === 'q' ? 200 : 500;
      if (value.length > maximum) bad();
      result[key] = value.trim();
      if (key === 'status' && !ALERT_STATUSES.includes(result[key])) bad();
      if (key === 'severity' && !['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(result[key])) bad();
      if (key === 'categoryCode' && !CATEGORY_CODES.includes(result[key])) bad();
    }
  }
  if (result.from && result.to && result.from > result.to) bad();
  return result;
}
module.exports = { alertQuery };
