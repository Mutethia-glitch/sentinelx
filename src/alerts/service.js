const { requirePermission } = require('../access/policy');
const { AuthError } = require('../auth/errors');
const { alertQuery } = require('./query');
const { alertId, statusUpdateInput } = require('./model');

function alertService(repository, access) {
  async function authorize(token, permission) {
    const identity = await access.me(token);
    requirePermission(identity.roles, permission);
    return identity.user;
  }
  return {
    async authorizeWrite(token) { return authorize(token, 'alerts.manage'); },
    async list(token, params) {
      await authorize(token, 'alerts.read');
      return repository.list(alertQuery(params));
    },
    async inspect(token, id) {
      await authorize(token, 'alerts.read');
      const alert = await repository.get(alertId(id));
      if (!alert) throw new AuthError(404, 'Alert not found.');
      return alert;
    },
    async updateStatus(token, id, body) {
      const actor = await authorize(token, 'alerts.manage');
      return repository.updateStatus(actor.id, alertId(id), statusUpdateInput(body));
    },
  };
}
module.exports = { alertService };
