const {spawn}=require('node:child_process');
const path=require('node:path');
async function run(script,env){
 return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[path.join(__dirname,'../../scripts',script)],{env:{...process.env,...env},stdio:'ignore',shell:false});
  const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('Tenant database initialization timed out.'));},60000);
  child.once('error',()=>{clearTimeout(timer);reject(new Error('Tenant database initialization failed.'));});
  child.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(new Error('Tenant database initialization failed.'));});
 });
}
async function initializeDatabase(tenant,databaseUrl){
 const env={DATABASE_URL:databaseUrl,TENANT_ID:tenant.tenantId,TENANT_NAME:tenant.companyName,TENANT_SLUG:tenant.slug,
  TENANT_ADMIN_EMAIL:tenant.admin.email,TENANT_ADMIN_NAME:tenant.admin.name,TENANT_ADMIN_PASSWORD_HASH:tenant.admin.passwordHash};
 await run('migrate.js',env);await run('bootstrap-tenant.js',env);
}
module.exports={initializeDatabase};
