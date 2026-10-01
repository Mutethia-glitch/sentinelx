const { transaction } = require('./auth-repository');
const { requirePermission } = require('../access/policy');
const { AuthError } = require('../auth/errors');
const { securityEvent, EventValidationError } = require('../events/model');
class EventPersistenceError extends Error {
  constructor() { super('Security event persistence unavailable.'); this.name = 'EventPersistenceError'; }
}
function eventRepository(pool) {
  function stored(row) {
    if (!row) return null;
    return {
      id: row.id, source: row.source, type: row.event_type, timestamp: row.occurred_at.toISOString(), receivedAt: row.received_at.toISOString(),
      normalizedAt: row.normalized_at?.toISOString() ?? null,
      event: row.normalized_data ? securityEvent({ ...row.normalized_data, timestamp: row.occurred_at.toISOString(), source: row.source, type: row.event_type, rawData: row.raw_data }) : null,
      rawData: row.raw_data,
    };
  }
  return {
    async create(input, actorId = null, afterPersist = null, connector = null) {
      const event = securityEvent(input);
      const { rawData, ...normalized } = event;
      try {
        const work = async client => {
          if (connector) {
            await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 73482144))', [connector.source + ':' + connector.externalId]);
            const existing = await client.query('SELECT e.* FROM connector_receipts c JOIN security_events e ON e.id=c.event_id WHERE c.source=$1 AND c.external_id=$2', [connector.source, connector.externalId]);
            if (existing.rows[0]) return stored(existing.rows[0]);
          }
          if (actorId) {
            const actor = await client.query('SELECT active FROM users WHERE id = $1 FOR SHARE', [actorId]);
            if (!actor.rows[0]?.active) throw new AuthError(403, 'Permission denied.');
            const roles = await client.query('SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1', [actorId]);
            requirePermission(roles.rows.map(row => row.name), 'events.ingest');
          }
          const result = await client.query(`INSERT INTO security_events
            (source, event_type, occurred_at, raw_data, normalized_data, normalized_at)
            VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, now()) RETURNING *`,
          [event.source, event.type, event.timestamp, JSON.stringify(rawData), JSON.stringify(normalized)]);
          const saved = stored(result.rows[0]);
          if (connector) {
            await client.query('INSERT INTO connector_receipts(source,external_id,event_id) VALUES ($1,$2,$3)', [connector.source,connector.externalId,saved.id]);
            await client.query("INSERT INTO audit_logs(actor_context,action,target_type,target_id,context) VALUES ('authenticated company connector','CONNECTOR_EVENT_INGESTED','security_event',$1,$2::jsonb)", [saved.id,JSON.stringify({source:connector.source,externalId:connector.externalId})]);
          }
          if (actorId) await client.query(`INSERT INTO audit_logs(actor_id, actor_context, action, target_type, target_id, context) VALUES ($1, 'authenticated event submitter', 'EVENT_INGESTED', 'security_event', $2, $3::jsonb)`, [actorId, saved.id, JSON.stringify({ source: event.source, type: event.type })]);
          if (afterPersist) await afterPersist(saved, client);
          return saved;
        };
        return actorId || afterPersist || connector ? await transaction(pool, work) : await work(pool);
      } catch (error) { if (error instanceof AuthError) throw error; throw new EventPersistenceError(); }
    },
    async list(filters) {
      const values=[],conditions=[];
      const add=value=>{values.push(value);return '$'+values.length;};
      const columns={source:'e.source',type:'e.event_type',action:"e.normalized_data->>'action'",
        status:"e.normalized_data->>'status'",host:"e.normalized_data->>'host'",
        user:"e.normalized_data->>'user'",sourceIp:"e.normalized_data->>'sourceIp'",
        destinationIp:"e.normalized_data->>'destinationIp'"};
      for(const [field,column] of Object.entries(columns)){
        if(filters[field])conditions.push(column+'='+add(filters[field]));
      }
      if(filters.severity==='UNKNOWN')conditions.push("e.normalized_data->>'severity' IS NULL");
      else if(filters.severity)conditions.push("e.normalized_data->>'severity'="+add(filters.severity));
      if(filters.from)conditions.push('e.occurred_at>='+add(filters.from)+'::timestamptz');
      if(filters.to)conditions.push('e.occurred_at<='+add(filters.to)+'::timestamptz');
      if(filters.categoryCode||filters.ruleId||filters.mitreTechniqueId){
        const linked=[];
        if(filters.categoryCode)linked.push('a.category_code='+add(filters.categoryCode));
        if(filters.ruleId)linked.push('a.rule_id='+add(filters.ruleId)+'::uuid');
        if(filters.mitreTechniqueId)linked.push(
          'EXISTS (SELECT 1 FROM rule_mitre_mappings rmm JOIN mitre_mappings m ON m.id=rmm.mapping_id '+
          'WHERE rmm.rule_id=a.rule_id AND m.technique_id='+add(filters.mitreTechniqueId)+')');
        conditions.push('EXISTS (SELECT 1 FROM alert_events ae JOIN alerts a ON a.id=ae.alert_id '+
          'WHERE ae.event_id=e.id AND '+linked.join(' AND ')+')');
      }
      if(filters.q){
        const escaped=filters.q.replace(/[\\%_]/g,char=>'\\'+char);
        const pattern=add('%'+escaped+'%');
        conditions.push('('+Object.values(columns).map(column=>column+" ILIKE "+pattern+" ESCAPE '\\'").join(' OR ')+')');
      }
      const offset=add((filters.page-1)*50);
      try{
        const sql="SELECT e.id,e.source,e.event_type,e.occurred_at,e.received_at,e.normalized_at,"+
          "jsonb_build_object('severity',e.normalized_data->'severity','user',e.normalized_data->'user',"+
          "'host',e.normalized_data->'host','action',e.normalized_data->'action',"+
          "'status',e.normalized_data->'status','sourceIp',e.normalized_data->'sourceIp',"+
          "'destinationIp',e.normalized_data->'destinationIp') AS normalized_data FROM security_events e "+
          (conditions.length?'WHERE '+conditions.join(' AND '):'')+
          ' ORDER BY e.occurred_at DESC,e.id DESC LIMIT 51 OFFSET '+offset;
        const result=await pool.query(sql,values);
        const rows=result.rows.slice(0,50).map(row=>({
          id:row.id,timestamp:row.occurred_at.toISOString(),source:row.source,type:row.event_type,
          receivedAt:row.received_at.toISOString(),normalized:Boolean(row.normalized_at),
          severity:row.normalized_data?.severity??null,user:row.normalized_data?.user??null,
          host:row.normalized_data?.host??null,action:row.normalized_data?.action??null,
          status:row.normalized_data?.status??null,sourceIp:row.normalized_data?.sourceIp??null,
          destinationIp:row.normalized_data?.destinationIp??null,
        }));
        return {events:rows,page:filters.page,pageSize:50,hasMore:result.rows.length>50&&filters.page<2000};
      }catch{throw new EventPersistenceError();}
    },
    async getById(id) {
      if (typeof id !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) throw new EventValidationError();
      try {
        const result = await pool.query('SELECT * FROM security_events WHERE id = $1', [id]);
        return stored(result.rows[0]);
      } catch { throw new EventPersistenceError(); }
    },
  };
}
module.exports = { eventRepository, EventPersistenceError };
