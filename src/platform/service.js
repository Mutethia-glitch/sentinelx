const {randomUUID,randomBytes}=require('node:crypto');
const {hashPassword}=require('../auth/passwords');
const {generateCode,digestCode,equalDigest}=require('../auth/otp');
const {AuthError}=require('../auth/errors');
const {signupInput,verifyInput,resendInput}=require('./validation');
function slugFor(name){
  const base=name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,48)||'company';
  return(base+'-'+randomBytes(4).toString('hex')).slice(0,63).replace(/-+$/,'');
}
function platformService(repository,config,mailer,provisioner){
 return{
  async signup(body){
    const input=signupInput(body),registrationId=randomUUID(),tenantId=randomUUID(),slug=slugFor(input.companyName),code=generateCode();
    const passwordHash=await hashPassword(input.password);
    await repository.create({...input,registrationId,tenantId,slug,passwordHash,
      codeDigest:digestCode(config.otpSecret,'COMPANY_SIGNUP',registrationId,code),expiresInSeconds:config.otpSeconds});
    try{await mailer.sendCode({to:input.adminEmail,code,purpose:'COMPANY_SIGNUP',companyName:input.companyName});}
    catch(error){await repository.markFailed(registrationId);throw error;}
    return{registrationId,status:'PENDING_EMAIL_VERIFICATION'};
  },
  async verify(body){
    const input=verifyInput(body),row=await repository.registration(input.registrationId);
    if(!row||!['PENDING_EMAIL','VERIFIED'].includes(row.status)||row.attempts>=config.otpMaxAttempts||row.expires_at<=new Date())throw new AuthError(400,'Invalid or expired company verification.');
    const digest=digestCode(config.otpSecret,'COMPANY_SIGNUP',row.id,input.code);
    if(!equalDigest(row.code_digest,digest)){await repository.failCode(row.id,config.otpMaxAttempts);throw new AuthError(400,'Invalid or expired company verification.');}
    const verified=await repository.markVerified(row.id,config.otpMaxAttempts);
    if(!verified)throw new AuthError(400,'Invalid or expired company verification.');
    const expectedOrigin=config.originMode==='render'?null:'https://'+verified.slug+'.'+config.baseDomain;
    let result;
    try{result=await provisioner.provision({tenantId:verified.tenant_id,companyName:verified.company_name,slug:verified.slug,
      origin:expectedOrigin,admin:{email:verified.admin_email,name:verified.admin_name,passwordHash:verified.admin_password_hash}});}
    catch(error){throw error;}
    if(result.status==='PROVISIONING')return{status:'PROVISIONING',retryAfterSeconds:60};
    if(config.originMode==='render'?!/^https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.onrender\.com$/.test(result.origin):result.origin!==expectedOrigin)throw new AuthError(503,'Company provisioning returned an invalid tenant origin.');
    const activated=await repository.activate(row.id,result.origin);
    if(!activated)throw new AuthError(503,'Company provisioning could not be finalized.');
    return{tenant:{id:verified.tenant_id,name:verified.company_name,slug:verified.slug,origin:result.origin,status:'ACTIVE'}};
  },
  async resend(body){
    const input=resendInput(body),row=await repository.registration(input.registrationId);
    if(!row||!['PENDING_EMAIL','VERIFIED'].includes(row.status))throw new AuthError(400,'Invalid resend request.');
    const code=generateCode(),digest=digestCode(config.otpSecret,'COMPANY_SIGNUP',row.id,code);
    const recipient=await repository.replaceCode(row.id,digest,config.otpSeconds,config.otpResendSeconds);
    if(!recipient)throw new AuthError(400,'Invalid resend request.');
    if(recipient.cooldown)throw new AuthError(429,'Wait before requesting another verification code.');
    await mailer.sendCode({to:recipient.email,code,purpose:'COMPANY_SIGNUP',companyName:recipient.companyName});
    return{expiresInSeconds:config.otpSeconds};
  },
 };
}
module.exports={platformService,slugFor};
