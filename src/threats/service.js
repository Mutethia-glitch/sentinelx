const { requirePermission } = require('../access/policy');
const { categoryCode, categoryUpdateInput } = require('./taxonomy');
const { AuthError } = require('../auth/errors');
function categoryService(repository, access) {
  async function authorize(token, permission) {
    const identity = await access.me(token); requirePermission(identity.roles, permission); return identity.user;
  }
  return {
    async list(token, params) {
      await authorize(token, 'categories.read');
      for (const [key, value] of params) if (key !== 'selectable' || params.getAll(key).length !== 1 || !['true', 'false'].includes(value)) throw new AuthError(400, 'Invalid category filters.');
      return repository.list(params.get('selectable') === 'true');
    },
    async update(token, code, input) {
      const actor = await authorize(token, 'categories.manage'); categoryCode(code); const data = categoryUpdateInput(input);
      return repository.update(actor.id, code, data);
    },
    async authorizeUpdate(token) { await authorize(token, 'categories.manage'); },
  };
}
module.exports = { categoryService };
