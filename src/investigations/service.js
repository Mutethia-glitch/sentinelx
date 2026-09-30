const { requirePermission } = require('../access/policy');
const { AuthError } = require('../auth/errors');
const { incidentId } = require('../incidents/model');
const { noteInput } = require('./model');

function investigationService(repository, access) {
  async function authorize(token, permission) {
    const identity = await access.me(token);
    requirePermission(identity.roles, permission);
    return identity.user;
  }
  return {
    async authorizeWrite(token) {
      return authorize(token, 'investigations.write');
    },
    async workspace(token, id) {
      await authorize(token, 'investigations.read');
      const workspace = await repository.get(incidentId(id));
      if (!workspace) throw new AuthError(404, 'Incident not found.');
      return workspace;
    },
    async addNote(token, id, body) {
      const actor = await authorize(token, 'investigations.write');
      return repository.addNote(actor.id, incidentId(id), noteInput(body));
    },
  };
}

module.exports = { investigationService };
