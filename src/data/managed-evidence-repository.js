'use strict';
const {createHash}=require('node:crypto');
const {isIP}=require('node:net');
const {transaction}=require('./auth-repository');
const {requirePermission}=require('../access/policy');
const {AuthError}=require('../auth/errors');
const {ISSUERS}=require('../integrations/evidence-catalog');
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const NAME=/^[a-z][a-z0-9-]{2,49}$/;
const HOST=/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const digest=key=>createHash('sha256').update(key).digest('hex');
async function administrator(db,actor){
 const roles=await db.query(`SELECT r.name FROM user_roles ur JOIN roles r ON r.id=ur.role_id
  JOIN users u ON u.id=ur.user_id WHERE ur.user_id=$1 AND u.active`,[actor]);
 requirePermission(roles.rows.map(row=>row.name),'users.manage');
}
function managedEvidenceRepository(pool,tenantId){
 if(!UUID.test(tenantId||''))throw new Error('Managed feed requires verified tenant identity.');
 return{
  async list(){
   const r=await pool.query(`SELECT id,name,issuer,host,status,created_at,last_event_at,revoked_at
    FROM managed_evidence_feeds ORDER BY created_at DESC,id DESC LIMIT 32`);
   return r.rows.map(row=>({id:row.id,name:row.name,issuer:row.issuer,host:row.host,status:row.status,
    createdAt:row.created_at.toISOString(),lastEventAt:row.last_event_at?.toISOString()||null,
    revokedAt:row.revoked_at?.toISOString()||null}));
  },
  async issue(actor,id,body,key){
   if(!UUID.test(id)||!body||typeof body!=='object'||Array.isArray(body)||
      Object.keys(body).sort().join(',')!=='host,issuer,name'||
      !NAME.test(body.name)||!ISSUERS.includes(body.issuer)||
      typeof body.host!=='string'||body.host.length>253||!HOST.test(body.host)||
      isIP(body.host)||body.host==='localhost'||/\\.(?:local|localhost|internal|invalid|test)$/.test(body.host)||
      !/^[0-9a-f]{64}$/.test(key))throw new AuthError(400,'Invalid provider feed details.');
   return transaction(pool,async db=>{
    await db.query('SELECT pg_advisory_xact_lock($1)',[73482176]);
    await administrator(db,actor);
    const prior=(await db.query('SELECT id FROM managed_evidence_feeds WHERE name=$1',[body.name])).rows[0];
    if(prior)throw new AuthError(409,'Provider feed name already exists. Revoke it and use a new name for rotation.');
    const count=(await db.query("SELECT count(*)::int AS total FROM managed_evidence_feeds WHERE status<>'REVOKED'")).rows[0].total;
    if(count>=12)throw new AuthError(409,'Company trusted feed limit reached.');
    const row=(await db.query(`INSERT INTO managed_evidence_feeds(id,name,issuer,host,token_hash,status,created_by)
       VALUES($1,$2,$3,$4,$5,'ISSUED',$6) RETURNING id,name,issuer,host,status`,
      [id,body.name,body.issuer,body.host,digest(key),actor])).rows[0];
    await db.query(`INSERT INTO audit_logs(actor_id,actor_context,action,target_type,target_id,context)
      VALUES($1,'authenticated company Administrator','MANAGED_EVIDENCE_ISSUED','managed_evidence_feed',$2,$3::jsonb)`,
      [actor,id,JSON.stringify({name:row.name,issuer:row.issuer,host:row.host,providerIdentity:'administrator_declared_not_independently_verified'})]);
    return row;
   });
  },
  async revoke(actor,id,reason){
   if(!UUID.test(id)||typeof reason!=='string'||!reason.trim()||reason.length>500||reason.includes('\0'))
    throw new AuthError(400,'Provide a valid feed and revocation reason.');
   return transaction(pool,async db=>{
    await db.query('SELECT pg_advisory_xact_lock($1)',[73482176]);
    await administrator(db,actor);
    const row=(await db.query(`UPDATE managed_evidence_feeds SET status='REVOKED',revoked_at=clock_timestamp()
      WHERE id=$1 AND status<>'REVOKED' RETURNING name,issuer,host`,[id])).rows[0];
    if(!row)throw new AuthError(404,'Active evidence feed not found.');
    await db.query(`INSERT INTO audit_logs(actor_id,actor_context,action,target_type,target_id,context)
      VALUES($1,'authenticated company Administrator','MANAGED_EVIDENCE_REVOKED','managed_evidence_feed',$2,$3::jsonb)`,
     [actor,id,JSON.stringify({...row,reason:reason.trim()})]);
    return{id,status:'REVOKED'};
   });
  },
  async byToken(token){
   if(typeof token!=='string'||!/^[0-9a-f]{64}$/.test(token))return null;
   const row=(await pool.query(`SELECT id,name,issuer,host FROM managed_evidence_feeds
      WHERE token_hash=$1 AND status IN ('ISSUED','REPORTING') LIMIT 1`,[digest(token)])).rows[0];
   return row?{registryId:row.id,tenantId,source:'evidence.'+row.name,issuer:row.issuer,host:row.host}:null;
  },
  async markReporting(db,id){
   const r=await db.query(`UPDATE managed_evidence_feeds SET status='REPORTING',last_event_at=clock_timestamp()
    WHERE id=$1 AND status IN ('ISSUED','REPORTING') RETURNING id`,[id]);
   if(r.rowCount!==1)throw new AuthError(401,'Provider feed is inactive.');
  }
 };
}
module.exports={managedEvidenceRepository,NAME,HOST};
