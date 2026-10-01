const { isIP } = require('node:net');
const { AuthError } = require('../auth/errors');
function canonicalIp(ip) {
  if(isIP(ip)===4) return ip;
  const normalized=new URL(`http://[${ip}]/`).hostname.slice(1,-1);
  const mapped=/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(normalized);
  if(!mapped)return normalized;
  const a=parseInt(mapped[1],16),b=parseInt(mapped[2],16);
  return [a>>8,a&255,b>>8,b&255].join('.');
}
function loginScope(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).sort().join(',') !== 'sourceIp,subject' ||
      typeof input.sourceIp !== 'string' || !isIP(input.sourceIp) || input.sourceIp.includes('%') ||
      typeof input.subject !== 'string' || !/^[0-9a-f]{64}$/.test(input.subject)) throw new AuthError(400,'Invalid login scope.');
  return {...input,sourceIp:canonicalIp(input.sourceIp)};
}
function loginContainmentRepository(pool) {
  return {
    async check(config, input) {
      const scope = loginScope(input);
      if (!config.containLogin) return {blocked:false,policyEnabled:false};
      const rows = (await pool.query(`SELECT trigger_event_id, blocked_until,
        LEAST(300,CEIL(EXTRACT(EPOCH FROM (blocked_until-clock_timestamp()))))::int AS retry_after
        FROM connector_login_blocks WHERE source=$1 AND source_ip=$2::inet AND subject=$3
        AND blocked_until>clock_timestamp()`,[config.source,scope.sourceIp,scope.subject])).rows;
      const row = rows[0];
      return row ? {blocked:true,policyEnabled:true,retryAfter:Math.max(1,row.retry_after),
        containmentId:row.trigger_event_id,blockedUntil:row.blocked_until.toISOString()} : {blocked:false,policyEnabled:true};
    },
    async afterEvent(config, saved, client) {
      if (!config.containLogin) return;
      const event = saved.event, kind = event.rawData.kind;
      if (!event.sourceIp || !event.user || !['login_failed','login_containment_blocked'].includes(kind)) return;
      const scope = [config.source,event.sourceIp,event.user];
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,73482145))',[JSON.stringify(scope)]);
      if (kind === 'login_containment_blocked') {
        const result = await client.query(`UPDATE connector_login_blocks SET last_enforced_event_id=$4
          WHERE source=$1 AND source_ip=$2::inet AND subject=$3 AND trigger_event_id=$5
          AND $6::timestamptz BETWEEN created_at AND blocked_until RETURNING trigger_event_id`,
        [...scope,saved.id,event.metadata.containmentId,event.timestamp]);
        if (!result.rows.length) throw new AuthError(409,'Containment decision could not be verified.');
        await client.query(`INSERT INTO audit_logs(actor_context,action,target_type,target_id,context)
          VALUES ('authenticated company connector','LOGIN_CONTAINMENT_ENFORCED','security_event',$1,$2::jsonb)`,
        [saved.id,JSON.stringify({containmentId:event.metadata.containmentId,source:config.source})]);
        return;
      }
      const count = (await client.query(`SELECT count(*)::int AS failures FROM security_events
        WHERE source=$1 AND received_at>=clock_timestamp()-interval '300 seconds'
        AND normalized_data->>'host'=$4 AND normalized_data->>'type'='authentication'
        AND normalized_data->>'action'='login' AND normalized_data->>'status'='failed'
        AND (CASE WHEN normalized_data->>'sourceIp' !~ '%' THEN normalized_data->>'sourceIp' END)::inet=$2::inet AND normalized_data->>'user'=$3`,
      [...scope,config.host])).rows[0].failures;
      if (count < 5) return;
      const created = await client.query(`INSERT INTO connector_login_blocks(source,source_ip,subject,trigger_event_id,blocked_until)
        VALUES ($1,$2::inet,$3,$4,clock_timestamp()+interval '300 seconds')
        ON CONFLICT(source,source_ip,subject) DO UPDATE SET trigger_event_id=EXCLUDED.trigger_event_id,
        blocked_until=EXCLUDED.blocked_until,created_at=clock_timestamp(),last_enforced_event_id=NULL
        WHERE connector_login_blocks.blocked_until<=clock_timestamp() RETURNING blocked_until`,[...scope,saved.id]);
      if (created.rows.length) await client.query(`INSERT INTO audit_logs(actor_context,action,target_type,target_id,context)
        VALUES ('authorized connector policy','LOGIN_CONTAINMENT_PREPARED','security_event',$1,$2::jsonb)`,
      [saved.id,JSON.stringify({source:config.source,scope:'IP_AND_ACCOUNT',threshold:5,windowSeconds:300,
        durationSeconds:300,blockedUntil:created.rows[0].blocked_until.toISOString(),enforcement:'AWAITING_APPLICATION_CONFIRMATION'})]);
    }
  };
}
module.exports={canonicalIp,loginScope,loginContainmentRepository};
