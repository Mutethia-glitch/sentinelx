const {transaction}=require('./auth-repository');
const {requirePermission}=require('../access/policy');
const {AuthError}=require('../auth/errors');
const {deliveryMessage}=require('../notifications/model');
class NotificationPersistenceError extends Error{
  constructor(){super('Notification storage temporarily unavailable.');this.name='NotificationPersistenceError';}
}
function view(row){
  return {
    id:row.id,incidentId:row.incident_id??null,alertId:row.alert_id??null,
    severity:row.severity??row.display_severity??null,message:row.message,
    deliveredAt:row.created_at.toISOString(),readAt:row.read_at?.toISOString()??null,
    state:row.read_at?'READ':'UNREAD',
  };
}
async function rolesFor(client,id){
  const result=await client.query(`SELECT r.name FROM user_roles ur JOIN roles r ON r.id=ur.role_id
    JOIN users u ON u.id=ur.user_id WHERE u.id=$1 AND u.active ORDER BY r.name`,[id]);
  return result.rows.map(row=>row.name);
}
function notificationRepository(pool){
  function failure(error){
    if(error instanceof AuthError)throw error;
    throw new NotificationPersistenceError();
  }
  async function active(client,id,permission,lock='FOR SHARE'){
    const row=(await client.query(`SELECT id FROM users WHERE id=$1 AND active ${lock}`,[id])).rows[0];
    if(!row)throw new AuthError(403,'Permission denied.');
    requirePermission(await rolesFor(client,id),permission);
  }
  return {
    async list(recipientId,filters){
      try{
        const conditions=['n.recipient_id=$1'];
        if(filters.status==='UNREAD')conditions.push('n.read_at IS NULL');
        if(filters.status==='READ')conditions.push('n.read_at IS NOT NULL');
        const records=await pool.query(`SELECT n.*,COALESCE(n.severity,i.threat_level,a.threat_level) AS display_severity
          FROM notifications n LEFT JOIN incidents i ON i.id=n.incident_id
          LEFT JOIN alerts a ON a.id=n.alert_id
          WHERE ${conditions.join(' AND ')}
          ORDER BY CASE WHEN n.read_at IS NULL THEN 0 ELSE 1 END,
          CASE COALESCE(n.severity,i.threat_level,a.threat_level)
            WHEN 'CRITICAL' THEN 4 WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 1 ELSE 0 END DESC,
          n.created_at DESC,n.id DESC LIMIT 51 OFFSET $2`,[recipientId,(filters.page-1)*50]);
        const count=(await pool.query('SELECT count(*)::integer AS n FROM notifications WHERE recipient_id=$1 AND read_at IS NULL',[recipientId])).rows[0].n;
        return {notifications:records.rows.slice(0,50).map(view),unreadCount:count,page:filters.page,pageSize:50,
          hasMore:records.rows.length>50&&filters.page<2000};
      }catch(error){failure(error);}
    },
    async send(actorId,input){
      try{
        return await transaction(pool,async client=>{
          await active(client,actorId,'notifications.send');
          // Serializes dispatch for one recipient, including concurrent senders.
          const recipient=(await client.query('SELECT id FROM users WHERE id=$1 AND active FOR UPDATE',[input.recipientId])).rows[0];
          if(!recipient)throw new AuthError(400,'Recipient must be an active SentinelX user.');
          requirePermission(await rolesFor(client,input.recipientId),'notifications.read');
          const kind=input.incidentId?'INCIDENT':'ALERT',target=input.incidentId??input.alertId;
          const targetRow=(await client.query(kind==='INCIDENT'
            ?'SELECT id,threat_level FROM incidents WHERE id=$1 FOR SHARE'
            :'SELECT id,threat_level FROM alerts WHERE id=$1 FOR SHARE',[target])).rows[0];
          if(!targetRow)throw new AuthError(404,'Notification source not found.');
          const column=kind==='INCIDENT'?'incident_id':'alert_id';
          const existing=(await client.query(`SELECT n.* FROM notifications n
            WHERE n.recipient_id=$1 AND n.${column}=$2 AND n.read_at IS NULL
            ORDER BY n.created_at DESC,n.id DESC LIMIT 1`,[input.recipientId,target])).rows[0];
          if(existing)return {notification:view(existing),delivered:false,deduplicated:true};
          const message=deliveryMessage(targetRow.threat_level,kind);
          const row=(await client.query(`INSERT INTO notifications(recipient_id,incident_id,alert_id,message,severity)
            VALUES($1,$2,$3,$4,$5) RETURNING *`,
          [input.recipientId,input.incidentId,input.alertId,message,targetRow.threat_level])).rows[0];
          await client.query(`INSERT INTO audit_logs(actor_id,actor_context,action,target_type,target_id,context)
            VALUES($1,'authenticated notification sender','NOTIFICATION_DELIVERED','notification',$2,$3::jsonb)`,
          [actorId,row.id,JSON.stringify({recipientId:input.recipientId,incidentId:input.incidentId,alertId:input.alertId,
            severity:targetRow.threat_level,channel:'IN_APP',reason:input.reason})]);
          return {notification:view(row),delivered:true,deduplicated:false};
        });
      }catch(error){failure(error);}
    },
    async markRead(recipientId,id){
      try{
        return await transaction(pool,async client=>{
          await active(client,recipientId,'notifications.read');
          const row=(await client.query('SELECT * FROM notifications WHERE id=$1 AND recipient_id=$2 FOR UPDATE',[id,recipientId])).rows[0];
          if(!row)throw new AuthError(404,'Notification not found.');
          if(row.read_at)return {notification:view(row),changed:false};
          const updated=(await client.query('UPDATE notifications SET read_at=clock_timestamp() WHERE id=$1 AND recipient_id=$2 RETURNING *',[id,recipientId])).rows[0];
          await client.query(`INSERT INTO audit_logs(actor_id,actor_context,action,target_type,target_id,context)
            VALUES($1,'notification recipient','NOTIFICATION_READ','notification',$2,$3::jsonb)`,
          [recipientId,id,JSON.stringify({recipientId})]);
          return {notification:view(updated),changed:true};
        });
      }catch(error){failure(error);}
    },
  };
}
module.exports={notificationRepository,NotificationPersistenceError,view};
