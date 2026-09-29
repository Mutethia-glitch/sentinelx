const { ROLE_NAMES, ROLE_PERMISSIONS, accessForRoles, requirePermission, roleUpdateInput, validateUserId } = require('./policy');
function accessService(repository, authentication) {
  async function authorize(token, permission) {
    const user = await authentication.currentUser(token);
    const names = await repository.rolesForUser(user.id);
    requirePermission(names, permission);
    return user;
  }
  return {
    async me(token) {
      const user = await authentication.currentUser(token);
      return { user, ...accessForRoles(await repository.rolesForUser(user.id)) };
    },
    async roles(token) {
      await authorize(token, 'users.roles.manage');
      return ROLE_NAMES.map(name => ({ name, permissions: [...ROLE_PERMISSIONS[name]].sort() }));
    },
    async users(token) {
      await authorize(token, 'users.read');
      return repository.listUsers();
    },
    async setRoles(token, userId, body) {
      const actor = await authorize(token, 'users.roles.manage');
      validateUserId(userId);
      const { roles, reason } = roleUpdateInput(body);
      return repository.setRoles(actor.id, userId, roles, reason);
    },
  };
}
module.exports = { accessService };
