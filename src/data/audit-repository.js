class AuditPersistenceError extends Error{constructor(){super('Audit trail temporarily unavailable.');this.name='AuditPersistenceError';}}
function view(row){return{id:row.id,actor:row.actor_id?{id:row.actor_id,displayName:row.actor_name??null}:null,actorContext:row.actor_context,action:row.action,target:{type:row.target_type,id:row.target_id??null},context:row.context||{},occurredAt:row.occurred_at.toISOString()};}
function auditRepository(pool){return{async list(filters){try{
 const values=[],where=[],add=v=>{values.push(v);return '$'+values.length;};
 if(filters.actorId)where.push('a.actor_id='+add(filters.actorId)+'::uuid');
 // Literal case-insensitive substring matching: user input cannot act as LIKE
 // wildcards, and filtering happens in PostgreSQL BEFORE pagination and CSV export.
 if(filters.q){
   const p=add(filters.q);
   where.push(`(POSITION(LOWER(${p}) IN LOWER(a.action))>0
     OR POSITION(LOWER(${p}) IN LOWER(a.target_type))>0
     OR POSITION(LOWER(${p}) IN LOWER(COALESCE(u.display_name,a.actor_context,'')))>0)`);
 }
 if(filters.action)where.push('POSITION(LOWER('+add(filters.action)+') IN LOWER(a.action))>0');
 if(filters.targetType)where.push('POSITION(LOWER('+add(filters.targetType)+') IN LOWER(a.target_type))>0');
 if(filters.targetId)where.push('a.target_id='+add(filters.targetId)+'::uuid');
 if(filters.from)where.push('a.occurred_at>='+add(filters.from)+'::timestamptz');
 if(filters.to)where.push('a.occurred_at<='+add(filters.to)+'::timestamptz');
 const offset=add((filters.page-1)*50);
 const result=await pool.query(`SELECT a.*,u.display_name actor_name FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id
   ${where.length?'WHERE '+where.join(' AND '):''}
   ORDER BY a.occurred_at DESC,a.id DESC LIMIT 51 OFFSET ${offset}`,values);
 return{entries:result.rows.slice(0,50).map(view),page:filters.page,pageSize:50,hasMore:result.rows.length>50&&filters.page<2000};
 }catch{throw new AuditPersistenceError();}}};}
module.exports={auditRepository,AuditPersistenceError,view};
