function provisioningRepository(pool){
 return{
  async withTenant(tenantId,work){
   const client=await pool.connect();let locked=false;
   try{
    locked=(await client.query('SELECT pg_try_advisory_lock(hashtextextended($1,73482143)) AS locked',[tenantId])).rows[0].locked;
    if(!locked)return{status:'PROVISIONING'};
    const registration=(await client.query(`SELECT t.*,s.admin_name,s.admin_password_hash FROM tenants t JOIN company_signups s ON s.tenant_id=t.id WHERE t.id=$1`,[tenantId])).rows[0];
    const repository={
     registration,
     async get(){const r=(await client.query('SELECT * FROM tenant_provisioning WHERE tenant_id=$1',[tenantId])).rows[0];return r?{stage:r.stage,fingerprint:r.fingerprint,projectId:r.project_id,branchId:r.branch_id,serviceId:r.service_id,renderUrl:r.render_url}:null;},
     async create(fingerprint){await client.query("INSERT INTO tenant_provisioning(tenant_id,fingerprint,stage) VALUES($1,$2,'NEW')",[tenantId,fingerprint]);},
     async save(job){await client.query('UPDATE tenant_provisioning SET stage=$2,project_id=$3,branch_id=$4,service_id=$5,render_url=$6,updated_at=clock_timestamp() WHERE tenant_id=$1',[tenantId,job.stage,job.projectId||null,job.branchId||null,job.serviceId||null,job.renderUrl||null]);},
    };
    return await work(repository);
   }finally{if(locked)await client.query('SELECT pg_advisory_unlock(hashtextextended($1,73482143))',[tenantId]).catch(()=>{});client.release();}
  },
 };
}
module.exports={provisioningRepository};
