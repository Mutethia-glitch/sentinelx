const {createHmac,timingSafeEqual}=require('node:crypto');
const {AuthError}=require('../auth/errors');
function validTenant(body,config){
 const t=body?.tenant;
 if(body?.schemaVersion!==1||body.type!=='sentinelx.tenant.provision'||!t||
  typeof t.tenantId!=='string'||!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(t.tenantId)||
  typeof t.slug!=='string'||!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(t.slug)||
  typeof t.companyName!=='string'||!t.companyName.trim()||t.companyName.length>120||
  typeof t.admin?.name!=='string'||!t.admin.name.trim()||t.admin.name.length>120||
  typeof t.admin?.email!=='string'||!/^\S+@\S+\.\S+$/.test(t.admin.email)||t.admin.email.length>254||
  typeof t.admin?.passwordHash!=='string'||!/^scrypt\$131072\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$/.test(t.admin.passwordHash)||
  t.origin!==null)throw new AuthError(400,'Invalid provisioning request.');
 return{tenantId:t.tenantId,slug:t.slug,companyName:t.companyName,origin:t.origin,admin:{name:t.admin.name,email:t.admin.email,passwordHash:t.admin.passwordHash}};
}
function authorized(header,token){const supplied=Buffer.from(header||''),expected=Buffer.from('Bearer '+token);return supplied.length===expected.length&&timingSafeEqual(supplied,expected);}
function provisioningService(repository,providers,initialize,config){
 return{async provision(body){
  const tenant=validTenant(body,config);
  const fingerprint=createHmac('sha256',config.token).update(JSON.stringify(tenant)).digest('hex');
  return repository.withTenant(tenant.tenantId,async repo=>{
   const registration=repo.registration;
   if(!registration||!['VERIFIED','ACTIVE'].includes(registration.status)||registration.slug!==tenant.slug||registration.company_name!==tenant.companyName||registration.admin_email!==tenant.admin.email||registration.admin_name!==tenant.admin.name||
     (registration.status==='VERIFIED'&&registration.admin_password_hash!==tenant.admin.passwordHash))throw new AuthError(403,'Company is not verified for provisioning.');
   let job=await repo.get();
   if(!job){if(registration.status==='ACTIVE')throw new AuthError(409,'Active company has no provisioning record.');await repo.create(fingerprint);job={stage:'NEW',fingerprint};}
   if(job.fingerprint!==fingerprint)throw new AuthError(409,'Provisioning identity does not match the existing request.');
   if(job.stage==='READY')return{origin:job.renderUrl};
   if(['CREATING_DATABASE','CREATING_SERVICE','DEPLOYING','REVIEW_REQUIRED'].includes(job.stage))throw new AuthError(503,'Provisioning requires operator review before retry.');
   const save=async(stage,patch={})=>{job={...job,...patch,stage};await repo.save(job);};
   if(job.stage==='NEW'){
    await save('CREATING_DATABASE');
    try{const result=await providers.createProject(tenant);await save('DATABASE_CREATED',result);}catch{await save('REVIEW_REQUIRED');throw new AuthError(503,'Database creation requires operator review.');}
   }else if(job.stage==='DATABASE_CREATED'){
    const url=await providers.databaseUrl(job);await initialize(tenant,url);await save('DATABASE_READY');
   }else if(job.stage==='DATABASE_READY'){
    const databaseUrl=await providers.databaseUrl(job);
    const env={NODE_ENV:'production',BIND_HOST:'0.0.0.0',DATABASE_URL:databaseUrl,APP_ORIGIN:'https://unconfigured.invalid',TENANT_ID:tenant.tenantId,TENANT_NAME:tenant.companyName,TENANT_SLUG:tenant.slug,AUTH_EMAIL_2FA:'1',
     AUTH_OTP_SECRET:createHmac('sha256',config.otpKey).update('sentinelx-tenant-otp:'+tenant.tenantId).digest('hex'),
     EMAIL_DELIVERY_URL:config.email.url,EMAIL_DELIVERY_TOKEN:config.email.token,EMAIL_FROM:config.email.from,...(config.signupUrl?{COMPANY_SIGNUP_URL:config.signupUrl}:{})};
    await save('CREATING_SERVICE');
    try{const result=await providers.createService(tenant,env);await save('SERVICE_CREATED',result);}catch{await save('REVIEW_REQUIRED');throw new AuthError(503,'Service creation requires operator review.');}
   }else if(job.stage==='SERVICE_CREATED'){
    await providers.configureOrigin(job);await save('DEPLOYING');
    try{await providers.deploy(job);await save('WAITING_HTTPS');}catch{await save('REVIEW_REQUIRED');throw new AuthError(503,'Deployment requires operator review.');}
   }else if(job.stage==='WAITING_HTTPS'){
    if(await providers.ready(job.renderUrl,tenant.tenantId)){await save('READY');return{origin:job.renderUrl};}
   }
   return{status:'PROVISIONING',retryAfterSeconds:60};
  });
 }};
}
module.exports={validTenant,authorized,provisioningService};
