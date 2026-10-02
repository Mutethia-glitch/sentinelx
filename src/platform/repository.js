const {Pool}=require('pg');
const {transaction}=require('../data/auth-repository');
function platformPool(config){
  const pool=new Pool({connectionString:config.databaseUrl,max:5,connectionTimeoutMillis:5000,idleTimeoutMillis:30000,statement_timeout:5000,query_timeout:6000});
  pool.on('error',()=>console.error('Platform database connection unavailable.'));return pool;
}
function platformRepository(pool){
  return{
    async create(input){
      return transaction(pool,async client=>{
        await client.query(`INSERT INTO tenants(id,company_name,slug,admin_email,status)
          VALUES($1,$2,$3,$4,'PENDING_EMAIL')`,[input.tenantId,input.companyName,input.slug,input.adminEmail]);
        await client.query(`INSERT INTO company_signups(id,tenant_id,admin_name,admin_password_hash,code_digest,expires_at)
          VALUES($1,$2,$3,$4,$5,clock_timestamp()+$6*interval '1 second')`,
          [input.registrationId,input.tenantId,input.adminName,input.passwordHash,input.codeDigest,input.expiresInSeconds]);
        return{registrationId:input.registrationId,tenantId:input.tenantId,slug:input.slug};
      });
    },
    async findActiveCompanies(key){
      const rows=await pool.query(`SELECT company_name,slug,origin FROM tenants
        WHERE status='ACTIVE' AND origin IS NOT NULL
          AND (slug=$1 OR lower(btrim(company_name))=$1)
        ORDER BY CASE WHEN slug=$1 THEN 0 ELSE 1 END,slug
        LIMIT 20`,[key]);
      return rows.rows;
    },
    async registration(id){
      const row=(await pool.query(`SELECT s.*,t.company_name,t.slug,t.admin_email,t.status,t.origin,t.verified_at
        FROM company_signups s JOIN tenants t ON t.id=s.tenant_id WHERE s.id=$1`,[id])).rows[0];
      return row||null;
    },
    async failCode(id,maxAttempts){
      await transaction(pool,async client=>{
        const row=(await client.query('SELECT attempts FROM company_signups WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!row)return;
        const attempts=Math.min(maxAttempts,Number(row.attempts)+1);
        await client.query('UPDATE company_signups SET attempts=$2 WHERE id=$1',[id,attempts]);
      });
    },
    async markVerified(id,maxAttempts){
      return transaction(pool,async client=>{
        const row=(await client.query(`SELECT s.*,t.company_name,t.slug,t.admin_email,t.status,t.origin,t.verified_at
          FROM company_signups s JOIN tenants t ON t.id=s.tenant_id WHERE s.id=$1 FOR UPDATE OF s,t`,[id])).rows[0];
        if(!row||row.attempts>=maxAttempts||row.expires_at<=new Date()||!['PENDING_EMAIL','VERIFIED'].includes(row.status))return null;
        if(row.status==='PENDING_EMAIL'){
          await client.query("UPDATE tenants SET status='VERIFIED',verified_at=clock_timestamp() WHERE id=$1",[row.tenant_id]);
          row.status='VERIFIED';row.verified_at=new Date();
        }
        return row;
      });
    },
    async replaceCode(id,digest,seconds,cooldown){
      return transaction(pool,async client=>{
        const row=(await client.query(`SELECT s.sent_at,s.attempts,t.admin_email,t.company_name,t.status
          FROM company_signups s JOIN tenants t ON t.id=s.tenant_id WHERE s.id=$1 FOR UPDATE OF s`,[id])).rows[0];
        if(!row||!['PENDING_EMAIL','VERIFIED'].includes(row.status))return null;
        const allowed=(await client.query("SELECT $1::timestamptz <= clock_timestamp()-$2*interval '1 second' ok",[row.sent_at,cooldown])).rows[0].ok;
        if(!allowed)return{cooldown:true};
        await client.query(`UPDATE company_signups SET code_digest=$2,sent_at=clock_timestamp(),
          expires_at=clock_timestamp()+$3*interval '1 second' WHERE id=$1`,[id,digest,seconds]);
        return{email:row.admin_email,companyName:row.company_name};
      });
    },
    async activate(id,origin){
      return transaction(pool,async client=>{
        const row=(await client.query(`SELECT s.tenant_id,t.status FROM company_signups s JOIN tenants t ON t.id=s.tenant_id
          WHERE s.id=$1 FOR UPDATE OF s,t`,[id])).rows[0];
        if(!row||row.status!=='VERIFIED')return null;
        await client.query("UPDATE tenants SET status='ACTIVE',origin=$2,activated_at=clock_timestamp() WHERE id=$1",[row.tenant_id,origin]);
        await client.query('UPDATE company_signups SET admin_password_hash=NULL,code_digest=NULL,attempts=0 WHERE id=$1',[id]);
        return{tenantId:row.tenant_id,origin};
      });
    },
    async markFailed(id){
      await transaction(pool,async client=>{
        await client.query(`UPDATE tenants t SET status='FAILED' FROM company_signups s WHERE s.id=$1 AND t.id=s.tenant_id AND t.status<>'ACTIVE'`,[id]);
        await client.query('UPDATE company_signups SET admin_password_hash=NULL,code_digest=NULL WHERE id=$1',[id]);
      });
    },
  };
}
module.exports={platformPool,platformRepository};
