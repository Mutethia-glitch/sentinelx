'use strict';
const {createHash}=require('node:crypto');
const {transaction}=require('./auth-repository');
const {requirePermission}=require('../access/policy');
const {AuthError}=require('../auth/errors');
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const digest=secret=>createHash('sha256').update(secret).digest('hex');
async function admin(client,actor){
 const r=await client.query(`SELECT r.name FROM user_roles ur JOIN roles r ON r.id=ur.role_id
 JOIN users u ON u.id=ur.user_id WHERE ur.user_id=$1 AND u.active`,[actor]);
 requirePermission(r.rows.map(x=>x.name),'users.manage');
}
function websiteRepository(pool){
 return{
  async list(){
   const [profile,records]=await Promise.all([
    pool.query('SELECT requested_website_origin FROM tenant_profile LIMIT 1'),
    pool.query(`SELECT id,origin,host,status,created_at,last_event_at,revoked_at
       FROM website_connectors ORDER BY created_at DESC,id DESC LIMIT 16`)
   ]);
   return{requestedWebsite:profile.rows[0]?.requested_website_origin||null,
    sites:records.rows.map(x=>({id:x.id,origin:x.origin,host:x.host,status:x.status,
     createdAt:x.created_at.toISOString(),lastEventAt:x.last_event_at?.toISOString()||null,
     revokedAt:x.revoked_at?.toISOString()||null}))};
  },
  async register(actor,id,origin,token){
   const tokenHash=digest(token),host=new URL(origin).hostname;
   return transaction(pool,async client=>{
    await client.query('SELECT pg_advisory_xact_lock($1)',[73482175]);
    await admin(client,actor);
    const current=(await client.query('SELECT id,status FROM website_connectors WHERE origin=$1 FOR UPDATE',[origin])).rows[0];
    if(current&&current.status!=='REVOKED')throw new AuthError(409,'This website is already registered.');
    if(!current){
     const count=(await client.query("SELECT count(*)::int n FROM website_connectors WHERE status<>'REVOKED'")).rows[0].n;
     if(count>=8)throw new AuthError(409,'Company website connection limit reached.');
    }
    const row=current
     ?(await client.query(`UPDATE website_connectors SET status='ISSUED',token_hash=$2,created_by=$3,
       created_at=clock_timestamp(),last_event_at=NULL,revoked_at=NULL
       WHERE id=$1 RETURNING id,origin,host,status`,[current.id,tokenHash,actor])).rows[0]
     :(await client.query(`INSERT INTO website_connectors(id,origin,host,token_hash,status,created_by)
       VALUES($1,$2,$3,$4,'ISSUED',$5) RETURNING id,origin,host,status`,
       [id,origin,host,tokenHash,actor])).rows[0];
    await client.query(`INSERT INTO audit_logs(actor_id,actor_context,action,target_type,target_id,context)
      VALUES($1,'authenticated company Administrator','WEBSITE_CONNECTOR_ISSUED','website_connector',$2,$3::jsonb)`,
      [actor,row.id,JSON.stringify({origin,mode:'server-to-server',siteOwnership:'not_independently_verified'})]);
    return row;
   });
  },
  async revoke(actor,id,reason){
   if(!UUID.test(id)||typeof reason!=='string'||!reason.trim()||reason.length>500||reason.includes('\0'))
    throw new AuthError(400,'Provide a valid website connection and reason.');
   return transaction(pool,async client=>{
    await client.query('SELECT pg_advisory_xact_lock($1)',[73482175]);
    await admin(client,actor);
    const r=await client.query(`UPDATE website_connectors
      SET status='REVOKED',revoked_at=clock_timestamp() WHERE id=$1 AND status<>'REVOKED'
      RETURNING id,origin`,[id]);
    if(!r.rows[0])throw new AuthError(404,'Active website connection not found.');
    await client.query(`INSERT INTO audit_logs(actor_id,actor_context,action,target_type,target_id,context)
      VALUES($1,'authenticated company Administrator','WEBSITE_CONNECTOR_REVOKED','website_connector',$2,$3::jsonb)`,
      [actor,id,JSON.stringify({origin:r.rows[0].origin,reason:reason.trim()})]);
    return{id,status:'REVOKED'};
   });
  },
  async byToken(token){
   if(typeof token!=='string'||!/^[0-9a-f]{64}$/.test(token))return null;
   const r=await pool.query(`SELECT id,origin,host,status FROM website_connectors
     WHERE token_hash=$1 AND status IN ('ISSUED','REPORTING') LIMIT 1`,[digest(token)]);
   return r.rows[0]||null;
  },
  async markReporting(db,id){
   const r=await db.query(`UPDATE website_connectors SET status='REPORTING',last_event_at=clock_timestamp()
     WHERE id=$1 AND status IN ('ISSUED','REPORTING') RETURNING id`,[id]);
   if(r.rowCount!==1)throw new AuthError(401,'Website connector is inactive.');
  }
 };
}
module.exports={websiteRepository,UUID};
