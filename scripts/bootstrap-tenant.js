const {createPool}=require('../src/data/pool');
const {transaction}=require('../src/data/auth-repository');
const {normalizeEmail}=require('../src/auth/validation');
const {websiteOrigin}=require('../src/platform/website');

function required(name,value,max=null){
  if(typeof value!=='string'||!value.trim()||(max&&value.length>max))throw new Error('Set '+name+'.');
  return value.trim();
}
async function main(){
  let pool;
  try{
    const tenantId=required('TENANT_ID',process.env.TENANT_ID);
    const companyName=required('TENANT_NAME',process.env.TENANT_NAME,120);
    const slug=required('TENANT_SLUG',process.env.TENANT_SLUG,63);
    const adminEmail=normalizeEmail(process.env.TENANT_ADMIN_EMAIL);
    const adminName=required('TENANT_ADMIN_NAME',process.env.TENANT_ADMIN_NAME,120);
    const passwordHash=required('TENANT_ADMIN_PASSWORD_HASH',process.env.TENANT_ADMIN_PASSWORD_HASH);
    const requestedWebsite=websiteOrigin(process.env.TENANT_WEBSITE_ORIGIN);
    if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(tenantId)||
       !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)||
       !/^scrypt\$131072\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$/.test(passwordHash))throw new Error('Invalid tenant bootstrap input.');
    pool=createPool();
    await transaction(pool,async client=>{
      await client.query('SELECT pg_advisory_xact_lock($1)',[73482142]);
      const profiles=(await client.query('SELECT tenant_id,company_name,slug,requested_website_origin FROM tenant_profile FOR UPDATE')).rows;
      if(profiles.length>1)throw new Error('Invalid tenant profile state.');
      if(profiles.length===1){
        const p=profiles[0];
        if(p.tenant_id!==tenantId||p.company_name!==companyName||p.slug!==slug||p.requested_website_origin!==requestedWebsite)throw new Error('Tenant profile mismatch.');
      }else{
        await client.query('INSERT INTO tenant_profile(singleton,tenant_id,company_name,slug,requested_website_origin) VALUES(true,$1,$2,$3,$4)',[tenantId,companyName,slug,requestedWebsite]);
      }
      let user=(await client.query('SELECT id,active,password_hash FROM users WHERE lower(email)=$1 FOR UPDATE',[adminEmail])).rows[0];
      if(!user){
        user=(await client.query('INSERT INTO users(email,display_name,password_hash,active) VALUES($1,$2,$3,true) RETURNING id,active',[adminEmail,adminName,passwordHash])).rows[0];
      }else if(!user.active||user.password_hash!==passwordHash)throw new Error('Configured tenant Administrator does not match bootstrap identity.');
      const role=(await client.query("SELECT id FROM roles WHERE name='Administrator'")).rows[0];
      if(!role)throw new Error('Administrator role is not migrated.');
      const admins=(await client.query("SELECT count(*)::int n FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN users u ON u.id=ur.user_id WHERE r.name='Administrator' AND u.active")).rows[0].n;
      if(admins===0)await client.query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[user.id,role.id]);
      const assigned=(await client.query("SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1 AND r.name='Administrator'",[user.id])).rows[0];
      if(!assigned)throw new Error('Tenant already has another Administrator; bootstrap refused.');
      await client.query("INSERT INTO audit_logs(actor_context,action,target_type,target_id,context) VALUES('trusted tenant provisioner','TENANT_PROVISIONED','tenant',$1,$2::jsonb)",[tenantId,JSON.stringify({tenantId,companyName,slug,administratorUserId:user.id})]);
    });
    console.log('Tenant profile and initial Administrator verified/provisioned.');
  }catch(error){
    console.error(error?.status?error.message:'Tenant bootstrap failed. Check migrations and provisioning configuration.');
    process.exitCode=1;
  }finally{if(pool)await pool.end();}
}
if(require.main===module)main();
module.exports={main};
