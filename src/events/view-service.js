const { requirePermission } = require('../access/policy');
const { AuthError } = require('../auth/errors');
const { eventQuery } = require('./query');
function eventViewService(repository, access) {
  async function authorize(token) {
    const identity = await access.me(token);
    requirePermission(identity.roles, 'events.read');
  }
  return {
    async list(token, params) { await authorize(token); return repository.list(eventQuery(params)); },
    async inspect(token, id) {
      await authorize(token);
      const result = await repository.getById(id);
      if (!result) throw new AuthError(404, 'Event not found.');
      return result;
    },
  };
}
module.exports = { eventViewService };
