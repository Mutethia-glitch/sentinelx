const {randomUUID,randomBytes}=require('node:crypto');
const {websiteOrigin}=require('../platform/website');
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
    async sites(token){
      await authorize(token,'users.manage');
      if(!options.websites)throw new AuthError(503,'Website connection management unavailable.');
      return options.websites.list();
    },
    async integrationReadiness(token){
      await authorize(token,'users.manage');
      if(!options.integrationCoverage)throw new AuthError(503,'Integration readiness unavailable.');
      return options.integrationCoverage.list();
    },
    async managedFeeds(token){
      await authorize(token,'users.manage');
      if(!options.managedEvidence)throw new AuthError(503,'Managed evidence feeds are not enabled.');
      return{feeds:await options.managedEvidence.list()};
    },
    async issueManagedFeed(token,body){
      const actor=await authorize(token,'users.manage');
      if(!options.managedEvidence)throw new AuthError(503,'Managed evidence feeds are not enabled.');
      const id=randomUUID(),key=randomBytes(32).toString('hex');
      const feed=await options.managedEvidence.issue(actor.id,id,body,key);
      return{...feed,endpoint:'/api/connectors/evidence',token:key,shownOnce:true,
       providerIdentityVerified:false,sourceAttestation:'administrator-declared'};
    },
    async revokeManagedFeed(token,id,body){
      const actor=await authorize(token,'users.manage');
      if(!options.managedEvidence)throw new AuthError(503,'Managed evidence feeds are not enabled.');
      if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).join(',')!=='reason')
       throw new AuthError(400,'A reason is required to revoke the provider feed.');
      return options.managedEvidence.revoke(actor.id,id,body.reason);
    },
    async addSite(token,body){
      const actor=await authorize(token,'users.manage');
      if(!options.websites)throw new AuthError(503,'Website connection management unavailable.');
      if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).join(',')!=='origin')
        throw new AuthError(400,'Provide the website HTTPS origin.');
      const origin=websiteOrigin(body.origin,false),secret=randomBytes(32).toString('hex');
      const row=await options.websites.register(actor.id,randomUUID(),origin,secret);
      return{id:row.id,origin:row.origin,host:row.host,status:row.status,
        token:secret,endpoint:'/api/connectors/site-events',shownOnce:true,domainOwnershipVerified:false};
    },
    async revokeSite(token,id,body){
      const actor=await authorize(token,'users.manage');
      if(!options.websites)throw new AuthError(503,'Website connection management unavailable.');
      if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).join(',')!=='reason')
        throw new AuthError(400,'A reason is required to revoke this website connector.');
      return options.websites.revoke(actor.id,id,body.reason);
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
