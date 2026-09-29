const { ruleInput, ruleId } = require('./model');
const { requirePermission } = require('../access/policy');
const { AuthError } = require('../auth/errors');
function ruleService(repository, access) {
  async function authorize(token, permission) { const identity = await access.me(token); requirePermission(identity.roles, permission); return identity.user; }
  return {
    async authorizeWrite(token) { return authorize(token, 'rules.manage'); },
    async list(token, params) {
      await authorize(token, 'rules.read');
      for (const [key, value] of params) if (key !== 'page' || params.getAll(key).length !== 1 || !/^[1-9]\d{0,3}$/.test(value) || Number(value) > 1000) throw new AuthError(400, 'Invalid rule filters.');
      return repository.list(Number(params.get('page') || 1));
    },
    async get(token, id) { await authorize(token, 'rules.read'); const rule = await repository.get(ruleId(id)); if (!rule) throw new AuthError(404, 'Rule not found.'); return rule; },
    async mitre(token) { await authorize(token, 'rules.read'); return repository.mitre(); },
    async validate(token, body) { await authorize(token, 'rules.manage'); const data = ruleInput(body); await repository.validate(data); return { valid: true, definition: data.definition, executionImplemented: false }; },
    async create(token, body) { const actor = await authorize(token, 'rules.manage'); return repository.create(actor.id, ruleInput(body)); },
    async update(token, id, body) { const actor = await authorize(token, 'rules.manage'); return repository.update(actor.id, ruleId(id), ruleInput(body, true)); },
  };
}
module.exports = { ruleService };
