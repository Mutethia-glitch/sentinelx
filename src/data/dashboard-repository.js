const {dashboardView}=require('../dashboard/model');
class DashboardPersistenceError extends Error{
  constructor(){super('Dashboard temporarily unavailable.');this.name='DashboardPersistenceError';}
}
const QUERIES=Object.freeze({
  asOf:'SELECT transaction_timestamp() AS as_of',
  totals:`SELECT
    (SELECT count(*)::bigint FROM security_events) AS "eventsTotal",
    (SELECT count(*)::bigint FROM alerts) AS "alertsTotal",
    (SELECT count(*)::bigint FROM incidents) AS "incidentsTotal",
    (SELECT count(*)::bigint FROM incidents WHERE status IN ('NEW','INVESTIGATING','CONTAINED')) AS "activeIncidents",
    (SELECT count(*)::bigint FROM alerts WHERE status='NEW') AS "newAlerts",
    (SELECT count(*)::bigint FROM response_actions) AS "responseActions",
    (SELECT count(*)::bigint FROM response_actions WHERE succeeded) AS "reportedSuccessfulActions",
    (SELECT count(*)::bigint FROM response_actions WHERE NOT succeeded) AS "reportedFailedActions",
    (SELECT count(*)::bigint FROM response_actions WHERE action='CONTAINMENT' AND succeeded) AS "successfulContainments",
    (SELECT round(avg(risk_score)::numeric,1) FROM incidents) AS "averageIncidentRisk"`,
  recent:`SELECT
    (SELECT count(*)::bigint FROM security_events WHERE received_at >= transaction_timestamp()-interval '24 hours' AND received_at<=transaction_timestamp()) AS "eventsReceived",
    (SELECT count(*)::bigint FROM alerts WHERE created_at >= transaction_timestamp()-interval '24 hours' AND created_at<=transaction_timestamp()) AS "alertsCreated",
    (SELECT count(*)::bigint FROM incidents WHERE created_at >= transaction_timestamp()-interval '24 hours' AND created_at<=transaction_timestamp()) AS "incidentsCreated",
    (SELECT count(*)::bigint FROM response_actions WHERE performed_at >= transaction_timestamp()-interval '24 hours' AND performed_at<=transaction_timestamp()) AS "responsesRecorded"`,
  severity:`SELECT 'ALERT' AS kind,threat_level::text AS severity,count(*)::bigint AS n FROM alerts GROUP BY threat_level
    UNION ALL SELECT 'INCIDENT',threat_level::text,count(*)::bigint FROM incidents GROUP BY threat_level`,
  status:`SELECT 'ALERT' AS kind,status::text AS status,count(*)::bigint AS n FROM alerts GROUP BY status
    UNION ALL SELECT 'INCIDENT',status::text,count(*)::bigint FROM incidents GROUP BY status`,
  threats:`SELECT kind,code,n FROM (
    SELECT 'ALERT' AS kind,category_code AS code,count(*)::bigint AS n
      FROM alerts GROUP BY category_code
    UNION ALL
    SELECT 'INCIDENT' AS kind,coalesce(category_code,'UNCLASSIFIED') AS code,count(*)::bigint AS n
      FROM incidents GROUP BY coalesce(category_code,'UNCLASSIFIED')
  ) categories ORDER BY kind,n DESC,code ASC`,
  responses:`SELECT action,count(*)::bigint AS total,
    count(*) FILTER (WHERE succeeded)::bigint AS successful,
    count(*) FILTER (WHERE NOT succeeded)::bigint AS failed
    FROM response_actions GROUP BY action ORDER BY total DESC,action ASC`,
  trend:`WITH days AS (
      SELECT (timezone('UTC',transaction_timestamp())::date - series.n)::date AS day
      FROM generate_series(0,6) AS series(n)
    ), e AS (
      SELECT (received_at AT TIME ZONE 'UTC')::date AS day,count(*)::bigint AS n
      FROM security_events
      WHERE received_at >= ((timezone('UTC',transaction_timestamp())::date - 6)::timestamp AT TIME ZONE 'UTC')
        AND received_at <= transaction_timestamp() GROUP BY 1
    ), a AS (
      SELECT (created_at AT TIME ZONE 'UTC')::date AS day,count(*)::bigint AS n
      FROM alerts
      WHERE created_at >= ((timezone('UTC',transaction_timestamp())::date - 6)::timestamp AT TIME ZONE 'UTC')
        AND created_at <= transaction_timestamp() GROUP BY 1
    ), i AS (
      SELECT (created_at AT TIME ZONE 'UTC')::date AS day,count(*)::bigint AS n
      FROM incidents
      WHERE created_at >= ((timezone('UTC',transaction_timestamp())::date - 6)::timestamp AT TIME ZONE 'UTC')
        AND created_at <= transaction_timestamp() GROUP BY 1
    ), r AS (
      SELECT (performed_at AT TIME ZONE 'UTC')::date AS day,count(*)::bigint AS n
      FROM response_actions
      WHERE performed_at >= ((timezone('UTC',transaction_timestamp())::date - 6)::timestamp AT TIME ZONE 'UTC')
        AND performed_at <= transaction_timestamp() GROUP BY 1
    ) SELECT to_char(d.day,'YYYY-MM-DD') AS day,
      coalesce(e.n,0) AS events,coalesce(a.n,0) AS alerts,
      coalesce(i.n,0) AS incidents,coalesce(r.n,0) AS responses
    FROM days d LEFT JOIN e USING(day) LEFT JOIN a USING(day)
      LEFT JOIN i USING(day) LEFT JOIN r USING(day) ORDER BY d.day ASC`,
});
function dashboardRepository(pool){
  return {
    async snapshot(){
      let client,started=false,failedRollback=false;
      try{
        client=await pool.connect();
        await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');started=true;
        const asOf=(await client.query(QUERIES.asOf)).rows[0].as_of;
        const totals=(await client.query(QUERIES.totals)).rows[0];
        const recent=(await client.query(QUERIES.recent)).rows[0];
        const severity=(await client.query(QUERIES.severity)).rows;
        const status=(await client.query(QUERIES.status)).rows;
        const threats=(await client.query(QUERIES.threats)).rows;
        const responses=(await client.query(QUERIES.responses)).rows;
        const trend=(await client.query(QUERIES.trend)).rows;
        const result=dashboardView(asOf,totals,recent,severity,status,threats,responses,trend);
        await client.query('COMMIT');started=false;
        return result;
      }catch(error){
        if(started){try{await client.query('ROLLBACK');}catch{failedRollback=true;}}
        throw new DashboardPersistenceError();
      }finally{
        if(client)client.release(failedRollback?new Error('Discard failed dashboard connection.'):undefined);
      }
    },
  };
}
module.exports={dashboardRepository,DashboardPersistenceError,QUERIES};
