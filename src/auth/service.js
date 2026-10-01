const { randomBytes, randomUUID } = require('node:crypto');
const { verifyPassword, hashPassword } = require('./passwords');
const { AuthError } = require('./errors');
const { loginInput, twoFactorInput, activationInput, safeUser } = require('./validation');
const {generateCode,digestCode,equalDigest}=require('./otp');
const hashToken = token => require('node:crypto').createHash('sha256').update(token).digest('hex');
function validToken(token) { return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token); }
function validChallenge(id){return typeof id==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id);}
function authService(repository, config, mailer = null) {
  async function deliver(user,challengeId,code,purpose='LOGIN'){
    if(!mailer)throw new AuthError(503,'Verification email could not be sent. Try again later.');
    await mailer.sendCode({to:user.email,code,purpose,companyName:config.tenant?.name||'SentinelX'});
  }
  return {
    async login(body) {
      const { email, password } = loginInput(body);
      const user = await repository.findUser(email);
      const matches = await verifyPassword(password, user?.password_hash);
      if (!user || !matches || !user.active) {
        await repository.failedLogin();
        throw new AuthError(401, 'Invalid email or password.');
      }
      if(config.requireEmail2fa){
        const challengeId=randomUUID(),code=generateCode();
        const digest=digestCode(config.otpSecret,'LOGIN',challengeId,code);
        const current=await repository.createLoginChallenge(user,challengeId,digest,config.otpSeconds);
        if(!current){await repository.failedLogin();throw new AuthError(401,'Invalid email or password.');}
        try{await deliver(current,challengeId,code);}
        catch(error){await repository.cancelLoginChallenge(challengeId);throw error;}
        return{user:safeUser(current),requiresTwoFactor:true,challengeId,expiresInSeconds:config.otpSeconds};
      }
      const token = randomBytes(32).toString('base64url');
      const current = await repository.createSession(user, hashToken(token), config.sessionSeconds);
      if (!current) {
        await repository.failedLogin();
        throw new AuthError(401, 'Invalid email or password.');
      }
      return { user: safeUser(current), token,requiresTwoFactor:false };
    },
    async verifyTwoFactor(challengeId,body){
      if(!validChallenge(challengeId))throw new AuthError(401,'Verification required.');
      const {code}=twoFactorInput(body),token=randomBytes(32).toString('base64url');
      const digest=digestCode(config.otpSecret,'LOGIN',challengeId,code);
      const user=await repository.completeLoginChallenge(challengeId,digest,hashToken(token),config.sessionSeconds,config.otpMaxAttempts);
      if(!user)throw new AuthError(401,'Invalid or expired verification code.');
      return{user:safeUser(user),token};
    },
    async resendTwoFactor(challengeId){
      if(!validChallenge(challengeId))throw new AuthError(401,'Verification required.');
      const code=generateCode(),digest=digestCode(config.otpSecret,'LOGIN',challengeId,code);
      const user=await repository.resendLoginChallenge(challengeId,digest,config.otpSeconds,config.otpResendSeconds);
      if(!user)throw new AuthError(401,'Verification required.');
      if(user.cooldown)throw new AuthError(429,'Wait before requesting another verification code.');
      try{await deliver(user,challengeId,code);}
      catch(error){await repository.cancelLoginChallenge(challengeId);throw error;}
      return{expiresInSeconds:config.otpSeconds};
    },
    async activate(body){
      const input=activationInput(body);
      const invite=await repository.findInvitation(input.email);
      if(!invite||Number(invite.attempts)>=config.otpMaxAttempts||invite.expires_at<=new Date())throw new AuthError(400,'Invalid or expired activation code.');
      const digest=digestCode(config.otpSecret,'INVITATION',invite.id,input.code);
      if(!equalDigest(invite.code_digest,digest)){await repository.failInvitation(invite.id,config.otpMaxAttempts);throw new AuthError(400,'Invalid or expired activation code.');}
      const passwordHash=await hashPassword(input.password);
      const user=await repository.activateInvitation(invite.id,digest,passwordHash,config.otpMaxAttempts);
      if(!user)throw new AuthError(400,'Invalid or expired activation code.');
      return{user:safeUser(user)};
    },
    async currentUser(token) {
      if (!validToken(token)) throw new AuthError(401, 'Authentication required.');
      const user = await repository.authenticate(hashToken(token), config.idleSeconds);
      if (!user) throw new AuthError(401, 'Authentication required.');
      return safeUser(user);
    },
    async logout(token) {
      if (!validToken(token) || !await repository.logout(hashToken(token), config.idleSeconds)) {
        throw new AuthError(401, 'Authentication required.');
      }
    },
  };
}
module.exports = { authService, hashToken,validChallenge };
