const SEVERITIES=Object.freeze(['LOW','MEDIUM','HIGH','CRITICAL']);
const INCIDENT_STATUSES=Object.freeze(['NEW','INVESTIGATING','CONTAINED','RESOLVED','DISMISSED']);
const ALERT_STATUSES=Object.freeze(['NEW','ACKNOWLEDGED']);
const TREND_DAYS=7;
function zeroBuckets(values){return Object.fromEntries(values.map(value=>[value,0]));}
function safeCount(value){
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<0)throw new TypeError('Invalid aggregate count.');
  return n;
}
function buckets(rows,kind,labels,key='severity'){
  const result=zeroBuckets(labels);
  for(const row of rows.filter(item=>item.kind===kind)){
    if(!Object.hasOwn(result,row[key]))throw new TypeError('Unsupported persisted aggregate category.');
    result[row[key]]=safeCount(row.n);
  }
  return result;
}
function numberOrNull(value){if(value===null||value===undefined)return null;const n=Number(value);if(!Number.isFinite(n)||n<0||n>100)throw new TypeError('Invalid aggregate risk.');return n;}
function dashboardView(asOf,overview,recent,severityRows,statusRows,threatRows,responseRows,trendRows){
  const totalKeys=['eventsTotal','alertsTotal','incidentsTotal','activeIncidents','newAlerts',
    'responseActions','reportedSuccessfulActions','reportedFailedActions','successfulContainments'];
  const latestKeys=['eventsReceived','alertsCreated','incidentsCreated','responsesRecorded'];
  const totals=Object.fromEntries(totalKeys.map(key=>[key,safeCount(overview[key])]));
  totals.averageIncidentRisk=numberOrNull(overview.averageIncidentRisk);
  const last24Hours=Object.fromEntries(latestKeys.map(key=>[key,safeCount(recent[key])]));
  if(trendRows.length!==TREND_DAYS)throw new TypeError('Expected seven UTC day buckets.');
  const trend=trendRows.map(row=>({
    day:row.day,events:safeCount(row.events),alerts:safeCount(row.alerts),
    incidents:safeCount(row.incidents),responses:safeCount(row.responses),
  }));
  if(trend.some(row=>typeof row.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(row.day)))throw new TypeError('Invalid UTC bucket.');
  const threats={alerts:[],incidents:[]};
  for(const row of threatRows){
    const key=row.kind==='ALERT'?'alerts':row.kind==='INCIDENT'?'incidents':null;
    if(!key)throw new TypeError('Invalid threat aggregate.');
    threats[key].push({code:row.code,count:safeCount(row.n)});
  }
  const responses=responseRows.map(row=>({
    action:row.action,total:safeCount(row.total),reportedSuccessful:safeCount(row.successful),
    reportedFailed:safeCount(row.failed),
  }));
  return {
    asOf:new Date(asOf).toISOString(),period:{recentHours:24,trendDays:TREND_DAYS,trendTimezone:'UTC'},
    totals,last24Hours,
    severity:{alerts:buckets(severityRows,'ALERT',SEVERITIES),incidents:buckets(severityRows,'INCIDENT',SEVERITIES)},
    status:{alerts:buckets(statusRows,'ALERT',ALERT_STATUSES,'status'),incidents:buckets(statusRows,'INCIDENT',INCIDENT_STATUSES,'status')},
    threats,responses,trend,
  };
}
module.exports={SEVERITIES,INCIDENT_STATUSES,ALERT_STATUSES,TREND_DAYS,zeroBuckets,safeCount,buckets,dashboardView};
