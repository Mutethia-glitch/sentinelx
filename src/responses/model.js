const { AuthError } = require('../auth/errors');
const { incidentId } = require('../incidents/model');

const RESPONSE_ACTIONS = Object.freeze(['CONTAINMENT', 'ESCALATION', 'FOLLOW_UP_TASK', 'COMMUNICATION']);
function responseInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).sort().join(',') !== 'action,containmentPerformed,details,reason,succeeded' ||
      !RESPONSE_ACTIONS.includes(body.action) ||
      typeof body.succeeded !== 'boolean' ||
      typeof body.containmentPerformed !== 'boolean' ||
      typeof body.reason !== 'string' || !body.reason.trim() || body.reason.length > 500 || body.reason.includes('\0') ||
      typeof body.details !== 'string' || !body.details.trim() || body.details.length > 2000 || body.details.includes('\0') ||
      (body.containmentPerformed !== (body.action === 'CONTAINMENT' && body.succeeded))) {
    throw new AuthError(400, 'Provide an approved manual response action, outcome, reason, and containment confirmation.');
  }
  return {
    action: body.action,
    reason: body.reason.trim(),
    details: body.details.trim(),
    succeeded: body.succeeded,
    containmentPerformed: body.containmentPerformed,
  };
}
function responsePage(params) {
  if (!(params instanceof URLSearchParams) ||
      [...params.keys()].some(key => key !== 'page') || params.getAll('page').length > 1) {
    throw new AuthError(400, 'Invalid response history filters.');
  }
  const page = params.get('page') ?? '1';
  if (!/^[1-9]\d{0,3}$/.test(page) || Number(page) > 2000) {
    throw new AuthError(400, 'Invalid response history page.');
  }
  return Number(page);
}
module.exports = { RESPONSE_ACTIONS, responseInput, responsePage, incidentId };
