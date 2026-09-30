const test=require('node:test');
const assert=require('node:assert/strict');
const {dashboardView,SEVERITIES,INCIDENT_STATUSES,safeCount}=require('../../src/dashboard/model');
const asOf=new Date('2026-09-30T10:00:00.000Z');
const overview={eventsTotal:'3',alertsTotal:'2',incidentsTotal:'1',activeIncidents:'1',
 newAlerts:'1',responseActions:'2',reportedSuccessfulActions:'1',reportedFailedActions:'1',
 successfulContainments:'0',averageIncidentRisk:'62.5'};
const recent={eventsReceived:'2',alertsCreated:'2',incidentsCreated:'1',responsesRecorded:'2'};
const trend=Array.from({length:7},(_,i)=>({day:'2026-09-'+String(24+i).padStart(2,'0'),events:'0',alerts:'0',incidents:'0',responses:'0'}));
test('all metric types are derived from persisted count rows; empty buckets are zero-filled',()=>{
 const result=dashboardView(asOf,overview,recent,[{kind:'ALERT',severity:'HIGH',n:'2'},{kind:'INCIDENT',severity:'CRITICAL',n:'1'}],
 [{kind:'INCIDENT',status:'NEW',n:'1'},{kind:'ALERT',status:'ACKNOWLEDGED',n:'1'}],
 [{kind:'ALERT',code:'BRUTE_FORCE',n:'2'},{kind:'INCIDENT',code:'UNCLASSIFIED',n:'1'}],
 [{action:'ESCALATION',total:'2',successful:'1',failed:'1'}],trend);
 assert.equal(result.totals.eventsTotal,3);
 assert.equal(result.totals.averageIncidentRisk,62.5);
 assert.deepEqual(Object.keys(result.severity.alerts),SEVERITIES);
 assert.deepEqual(result.severity.alerts,{LOW:0,MEDIUM:0,HIGH:2,CRITICAL:0});
 assert.deepEqual(Object.keys(result.status.incidents),INCIDENT_STATUSES);
 assert.equal(result.status.incidents.NEW,1);
 assert.equal(result.threats.alerts[0].count,2);
 assert.equal(result.responses[0].reportedFailed,1);
 assert.equal(result.trend.length,7);
 assert.ok(result.trend.every(day=>day.events===0));
 assert.equal(result.asOf,asOf.toISOString());
});
test('empty incident data has null mean risk, not a decorative value',()=>{
 const view=dashboardView(asOf,{...overview,averageIncidentRisk:null,incidentsTotal:'0',activeIncidents:'0'},recent,[],[],[],[],trend);
 assert.equal(view.totals.averageIncidentRisk,null);
 assert.deepEqual(view.severity.incidents,{LOW:0,MEDIUM:0,HIGH:0,CRITICAL:0});
});
test('invalid aggregate values and unexpected trend shapes fail closed',()=>{
 for(const value of [-1,2.5,'invalid',undefined,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>safeCount(value),TypeError);
 assert.throws(()=>dashboardView(asOf,overview,recent,[],[],[],[],trend.slice(1)),TypeError);
 assert.throws(()=>dashboardView(asOf,overview,recent,[{kind:'INCIDENT',severity:'EXTREME',n:1}],[],[],[],trend),TypeError);
});
