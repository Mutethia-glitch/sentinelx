const {AuthError}=require('../auth/errors');
class ReportPersistenceError extends Error{constructor(){super('Reporting temporarily unavailable.');this.name='ReportPersistenceError';}}
function reportRepository(pool){
 async function read(work){
  let client,started=false,failedRollback=false;
  try{
   client=await pool.connect();await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');started=true;
   const asOf=(await client.query('SELECT transaction_timestamp() AS t')).rows[0].t.toISOString();
   const result=await work(client,asOf);
   await client.query('COMMIT');started=false;return result;
  }catch(error){
   if(started)try{await client.query('ROLLBACK');}catch{failedRollback=true;}
   if(error instanceof AuthError)throw error;
   throw new ReportPersistenceError();
  }finally{if(client)client.release(failedRollback?new Error('Discard failed report connection.'):undefined);}
 }
 function bounds(query,column,values){
  const conditions=[];const add=v=>{values.push(v);return '$'+values.length;};
  if(query.from)conditions.push(column+'>='+add(query.from)+'::timestamptz');
  if(query.to)conditions.push(column+'<='+add(query.to)+'::timestamptz');
  return conditions;
 }
 return {
  async security(query){
   return read(async(client,asOf)=>{
    const ev=[],al=[],inc=[],resp=[];
    const where=(parts)=>parts.length?' WHERE '+parts.join(' AND '):'';
    const eWhere=where(bounds(query,'received_at',ev));
    const aWhere=where(bounds(query,'created_at',al));
    const iWhere=where(bounds(query,'created_at',inc));
    const rWhere=where(bounds(query,'performed_at',resp));
    const events=await client.query(`SELECT count(*)::integer total,coalesce(jsonb_object_agg(severity,n) FILTER (WHERE severity IS NOT NULL),'{}'::jsonb) severity FROM (SELECT normalized_data->>'severity' severity,count(*)::integer n FROM security_events${eWhere} GROUP BY 1) x`,ev);
    const alerts=await client.query(`SELECT count(*)::integer total FROM alerts${aWhere}`,al);
    const alertSeverity=await client.query(`SELECT threat_level::text severity,count(*)::integer count FROM alerts${aWhere} GROUP BY threat_level ORDER BY threat_level`,al);
    const incidents=await client.query(`SELECT count(*)::integer total,count(*) FILTER (WHERE status IN ('NEW','INVESTIGATING','CONTAINED'))::integer active,round(avg(risk_score)::numeric,1) average_risk FROM incidents${iWhere}`,inc);
    const incidentSeverity=await client.query(`SELECT threat_level::text severity,count(*)::integer count FROM incidents${iWhere} GROUP BY threat_level ORDER BY threat_level`,inc);
    const categories=await client.query(`SELECT coalesce(category_code,'UNCLASSIFIED') code,count(*)::integer count FROM incidents${iWhere} GROUP BY 1 ORDER BY count DESC,code ASC LIMIT 15`,inc);
    const responses=await client.query(`SELECT count(*)::integer total,count(*) FILTER(WHERE succeeded)::integer reported_successful,count(*) FILTER(WHERE NOT succeeded)::integer reported_failed FROM response_actions${rWhere}`,resp);
    return {type:'SECURITY_SUMMARY',asOf,range:{from:query.from||null,to:query.to||null},
      events:{total:events.rows.reduce((n,r)=>n+Number(r.total||0),0),severity:events.rows[0]?.severity||{}},
      alerts:{total:Number(alerts.rows[0].total),severity:Object.fromEntries(alertSeverity.rows.map(r=>[r.severity,r.count]))},
      incidents:{total:Number(incidents.rows[0].total),active:Number(incidents.rows[0].active),averageRisk:incidents.rows[0].average_risk==null?null:Number(incidents.rows[0].average_risk),severity:Object.fromEntries(incidentSeverity.rows.map(r=>[r.severity,r.count])),categories:categories.rows},
      responses:{total:Number(responses.rows[0].total),reportedSuccessful:Number(responses.rows[0].reported_successful),reportedFailed:Number(responses.rows[0].reported_failed)}};
   });
  },
  async incident(id,query){
   return read(async(client,asOf)=>{
    const row=(await client.query(`SELECT i.*,u.display_name assigned_name FROM incidents i LEFT JOIN users u ON u.id=i.assigned_to WHERE i.id=$1`,[id])).rows[0];
    if(!row)throw new AuthError(404,'Incident not found.');
    const alerts=(await client.query(`SELECT a.id,a.category_code,a.threat_level::text severity,a.status,a.created_at,r.name rule_name,
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'techniqueId',m.technique_id,'techniqueName',m.technique_name,
        'tactics',COALESCE((SELECT jsonb_agg(jsonb_build_object('tacticId',t.tactic_id,'tacticName',t.tactic_name) ORDER BY t.tactic_id)
          FROM mitre_mapping_tactics mt JOIN mitre_tactics t ON t.tactic_id=mt.tactic_id
          WHERE mt.mapping_id=m.id),'[]'::jsonb)
      ) ORDER BY m.technique_id)
      FROM rule_mitre_mappings rm JOIN mitre_mappings m ON m.id=rm.mapping_id
      WHERE rm.rule_id=r.id),'[]'::jsonb) mitre_mappings
      FROM incident_alerts ia JOIN alerts a ON a.id=ia.alert_id JOIN detection_rules r ON r.id=a.rule_id
      WHERE ia.incident_id=$1 ORDER BY a.created_at,a.id`,[id])).rows.map(a=>({...a,mitreMappings:a.mitre_mappings||[]}));
    const notes=(await client.query(`SELECT n.id,n.created_at,n.content,u.display_name author FROM investigation_notes n JOIN users u ON u.id=n.author_id WHERE n.incident_id=$1 ORDER BY n.created_at,n.id`,[id])).rows;
    const responses=(await client.query(`SELECT ra.id,ra.action,ra.reason,ra.result,ra.succeeded,ra.performed_at,u.display_name actor FROM response_actions ra JOIN users u ON u.id=ra.authorized_by WHERE ra.incident_id=$1 ORDER BY ra.performed_at,ra.id`,[id])).rows;
    return {type:'INCIDENT_REPORT',asOf,range:{from:query.from||null,to:query.to||null},incident:{id:row.id,title:row.title,status:row.status,severity:row.threat_level,categoryCode:row.category_code,assignedTo:row.assigned_to?{id:row.assigned_to,displayName:row.assigned_name}:null,riskScore:Number(row.risk_score),createdAt:row.created_at.toISOString(),updatedAt:row.updated_at.toISOString(),resolutionNote:row.resolution_note||null},alerts,investigationNotes:notes,responses};
   });
  },
 };
}
module.exports={reportRepository,ReportPersistenceError};
