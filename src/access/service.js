const {randomUUID}=require('node:crypto');
const { ROLE_NAMES, ROLE_PERMISSIONS, accessForRoles, requirePermission, roleUpdateInput,invitationInput,activeInput,validateUserId } = require('./policy');
const {generateCode,digestCode}=require('../auth/otp');
const {AuthError}=require('../auth/errors');
function accessService(repository, authentication, options={}) {
  async function authorize(token, permission) {
    const user = await authentication.currentUser(token);
    const names = await repository.rolesForUser(user.id);
    requirePermission(names, permission);
    return user;
  }
  return {
    async me(token) {
      const user = await authentication.currentUser(token);
      return { user, ...accessForRoles(await repository.rolesForUser(user.id)),tenant:options.tenant||null };
    },
    async roles(token) {
      await authorize(token, 'users.roles.manage');
      return ROLE_NAMES.map(name => ({ name, permissions: [...ROLE_PERMISSIONS[name]].sort() }));
    },
    async users(token) {
      await authorize(token, 'users.read');
      return repository.listUsers();
    },
    async inviteUser(token,body){
      const actor=await authorize(token,'users.manage'),input=invitationInput(body);
      if(!options.mailer||!options.otpSecret)throw new AuthError(503,'Email invitations are not configured.');
      const id=randomUUID(),code=generateCode();
      const invitation=await repository.createInvitation(actor.id,{...input,id,
        codeDigest:digestCode(options.otpSecret,'INVITATION',id,code),expiresInSeconds:options.otpSeconds||600});
      try{await options.mailer.sendCode({to:input.email,code,purpose:'USER_INVITATION',companyName:options.tenant?.name||'SentinelX'});}
      catch(error){await repository.cancelInvitation(id);throw error;}
      return invitation;
    },
    async setActive(token,userId,body){
      const actor=await authorize(token,'users.manage');validateUserId(userId);
      return repository.setActive(actor.id,userId,activeInput(body));
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
