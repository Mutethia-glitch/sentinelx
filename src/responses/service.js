const { requirePermission } = require('../access/policy');
const { AuthError } = require('../auth/errors');
const { incidentId, responseInput, responsePage } = require('./model');

function responseService(repository, access) {
  async function authorize(token, permission) {
    const identity = await access.me(token);
    requirePermission(identity.roles, permission);
    return identity.user;
  }
  return {
    async authorizeWrite(token) { return authorize(token, 'responses.execute'); },
    async list(token, id, params) {
      await authorize(token, 'responses.read');
      return repository.list(incidentId(id), responsePage(params));
    },
    async record(token, id, body) {
      const actor = await authorize(token, 'responses.execute');
      return repository.record(actor.id, incidentId(id), responseInput(body));
    },
  };
}
module.exports = { responseService };
