'use strict';
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {createPool}=require('../src/data/pool');
const {hashPassword}=require('../src/auth/passwords');
const {configFromEnv}=require('../src/auth/config');
const {authRepository}=require('../src/data/auth-repository');
const {accessRepository}=require('../src/data/access-repository');
const {eventRepository}=require('../src/data/event-repository');
const {detectionRepository}=require('../src/data/detection-repository');
const {correlationRepository}=require('../src/data/correlation-repository');
const {alertRepository}=require('../src/data/alert-repository');
const {incidentRepository}=require('../src/data/incident-repository');
const {investigationRepository}=require('../src/data/investigation-repository');
const {responseRepository}=require('../src/data/response-repository');
const {categoryRepository}=require('../src/data/category-repository');
const {dashboardRepository}=require('../src/data/dashboard-repository');
const {reportRepository}=require('../src/data/report-repository');
const {authService}=require('../src/auth/service');
const {accessService}=require('../src/access/service');
const {ingestionService,approvedSources}=require('../src/events/ingestion');
const {eventViewService}=require('../src/events/view-service');
const {detectionEngine}=require('../src/detection/engine');
const {correlationEngine}=require('../src/correlation/engine');
const {alertService}=require('../src/alerts/service');
const {incidentService}=require('../src/incidents/service');
const {investigationService}=require('../src/investigations/service');
const {responseService}=require('../src/responses/service');
const {categoryService}=require('../src/threats/service');
const {dashboardService}=require('../src/dashboard/service');
const {reportService}=require('../src/reports/service');
const {mlIntegration}=require('../src/ml/integration');
const {CATEGORY_CODES}=require('../src/threats/taxonomy');
const {INITIAL_RULES}=require('../src/rules/initial-rules');
const fixture=require('../fixtures/events/initial-rule-scenarios.json');

function sameSet(actual,expected,message){
  assert.deepEqual([...new Set(actual)].sort(),[...new Set(expected)].sort(),message);
}

async function verifyEndToEndScenarios(pool){
  assert.equal(process.env.SENTINELX_TEST_DATABASE,'1','Use a controlled disposable/test database and set SENTINELX_TEST_DATABASE=1.');
  let stage='initialization';
  const suffix=randomUUID().replaceAll('-','');
  const ruleIds=[];
  const eventIds=[];
  const alertIds=new Set();
  const incidentIds=[];
  let userId=null;
  let categoryState=[];
  const scenarioResults=new Map();

  try{
    stage='taxonomy baseline';
    sameSet(CATEGORY_CODES,INITIAL_RULES.map(rule=>rule.categoryCode),'core rules must cover all taxonomy categories');
    sameSet(CATEGORY_CODES,fixture.scenarios.map(item=>item.categoryCode),'scenario fixtures must cover all taxonomy categories');
    categoryState=(await pool.query('SELECT code,enabled,updated_at FROM threat_categories WHERE code=ANY($1::text[]) ORDER BY code',[CATEGORY_CODES])).rows;
    assert.equal(categoryState.length,15,'all fifteen threat categories must be persisted');
    await pool.query('UPDATE threat_categories SET enabled=true WHERE code=ANY($1::text[])',[CATEGORY_CODES]);

    stage='synthetic analyst setup';
    const authRepo=authRepository(pool);
    const password='Synthetic Task 40 controlled passphrase';
    const email='task40-'+suffix+'@example.invalid';
    userId=await authRepo.createUser(email,'Synthetic Task 40 analyst',await hashPassword(password),'Task 40 controlled end-to-end verifier');
    await pool.query("INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE name='Security Analyst'",[userId]);

    const config=configFromEnv({});
    const auth=authService(authRepo,config);
    const access=accessService(accessRepository(pool),auth);
    const token=(await auth.login({email,password})).token;

    stage='temporary isolated rule setup';
    const ruleByCode=new Map();
    for(const core of INITIAL_RULES){
      const row=(await pool.query("INSERT INTO detection_rules(name,description,enabled,definition,threat_level,category_code,created_by) VALUES($1,$2,true,$3::jsonb,$4,$5,$6) RETURNING id",
        ['Task 40 '+core.categoryCode+' '+suffix,'Controlled Task 40 clone of '+core.name,JSON.stringify(core.definition),core.severity,core.categoryCode,userId])).rows[0];
      ruleIds.push(row.id);ruleByCode.set(core.categoryCode,row.id);
    }

    const events=eventRepository(pool);
    const detection=detectionRepository(pool);
    const allowedRuleIds=new Set(ruleIds);
    const isolatedDetection={
      async enabledRules(db){return (await detection.enabledRules(db)).filter(rule=>allowedRuleIds.has(rule.id));},
      matchingEvents:(...args)=>detection.matchingEvents(...args),
      mlHistory:(...args)=>detection.mlHistory(...args),
      createAlert:(...args)=>detection.createAlert(...args),
    };
    const detector=detectionEngine(isolatedDetection,correlationEngine(correlationRepository(pool)),mlIntegration({mode:'disabled'}));
    const ingestion=ingestionService(events,access,approvedSources({EVENT_INGEST_SOURCES:'sentinelx-simulated'}),detector);

    const eventViews=eventViewService(events,access);
    const alerts=alertService(alertRepository(pool),access);
    const incidents=incidentService(incidentRepository(pool),access);
    const investigations=investigationService(investigationRepository(pool),access);
    const responses=responseService(responseRepository(pool),access);
    const categories=categoryService(categoryRepository(pool),access);
    const dashboard=dashboardService(dashboardRepository(pool),access);
    const reports=reportService(reportRepository(pool),access);

    function rawInput(index,sequence,patch,identity){
      const base=fixture.baseEvent;
      const at=new Date(Date.UTC(2035,0,1,index,0,sequence)).toISOString();
      return{
        format:'simulated-flat-v1',
        source:'sentinelx-simulated',
        rawData:{
          time:at,
          event_type:patch.type!==undefined?patch.type:base.type,
          src_ip:identity.sourceIp,
          dst_ip:identity.destinationIp,
          actor:identity.user,
          device:identity.host,
          operation:patch.action!==undefined?patch.action:base.action,
          outcome:patch.status!==undefined?patch.status:base.status,
          level:String(patch.severity!==undefined?patch.severity:base.severity).toLowerCase(),
          task40_marker:suffix,
          expected_category:identity.categoryCode,
        },
      };
    }

    stage='false-positive control';
    const benignIdentity={categoryCode:'NONE',sourceIp:'192.0.2.230',destinationIp:'198.51.100.230',user:'task40-benign-'+suffix,host:'task40-benign-host-'+suffix};
    const benign=await ingestion.ingestRaw(token,rawInput(20,0,{type:'authentication',action:'login',status:'success'},benignIdentity));
    eventIds.push(benign.id);
    assert.equal(benign.alertsGenerated,0,'benign authentication must not generate a deterministic alert');
    assert.equal(Number((await pool.query('SELECT count(*) FROM alerts WHERE trigger_event_id=$1',[benign.id])).rows[0].count),0);

    stage='fifteen-category end-to-end scenarios';
    for(let index=0;index<CATEGORY_CODES.length;index++){
      const code=CATEGORY_CODES[index];
      const core=INITIAL_RULES.find(rule=>rule.categoryCode===code);
      const scenario=fixture.scenarios.find(item=>item.categoryCode===code);
      assert.ok(core&&scenario,'missing Task 40 scenario for '+code);
      const identity={
        categoryCode:code,
        sourceIp:'192.0.2.'+(40+index),
        destinationIp:'198.51.100.'+(40+index),
        user:'task40-user-'+index+'-'+suffix,
        host:'task40-host-'+index+'-'+suffix,
      };
      const categoryEvents=[];
      let triggerReceipt=null;
      for(let sequence=0;sequence<core.definition.threshold;sequence++){
        const receipt=await ingestion.ingestRaw(token,rawInput(index,sequence,scenario.match,identity));
        eventIds.push(receipt.id);categoryEvents.push(receipt.id);triggerReceipt=receipt;
        if(sequence<core.definition.threshold-1)assert.equal(receipt.alertsGenerated,0,code+' fired below threshold');
      }
      assert.equal(triggerReceipt.alertsGenerated,1,code+' did not generate exactly one expected alert at threshold');
      const ruleId=ruleByCode.get(code);
      const firstAlert=(await pool.query('SELECT id,category_code,threat_level FROM alerts WHERE rule_id=$1 AND trigger_event_id=$2',[ruleId,triggerReceipt.id])).rows[0];
      assert.ok(firstAlert,code+' alert not persisted');
      assert.equal(firstAlert.category_code,code);
      assert.equal(firstAlert.threat_level,core.severity);
      alertIds.add(firstAlert.id);
      const incidentAlerts=[firstAlert.id];

      if(code==='BRUTE_FORCE'){
        const extra=await ingestion.ingestRaw(token,rawInput(index,core.definition.threshold,scenario.match,identity));
        eventIds.push(extra.id);categoryEvents.push(extra.id);
        assert.equal(extra.alertsGenerated,1,'brute-force correlation trigger did not create a second alert');
        const secondAlert=(await pool.query('SELECT id FROM alerts WHERE rule_id=$1 AND trigger_event_id=$2',[ruleId,extra.id])).rows[0];
        assert.ok(secondAlert);alertIds.add(secondAlert.id);incidentAlerts.push(secondAlert.id);
        const linked=Number((await pool.query('SELECT count(*) FROM alert_correlations WHERE (alert_id=$1 AND related_alert_id=$2) OR (alert_id=$2 AND related_alert_id=$1)',[firstAlert.id,secondAlert.id])).rows[0].count);
        assert.equal(linked,1,'brute-force alerts must correlate exactly once');
      }

      const incident=await incidents.create(token,{
        title:'Task 40 '+code+' scenario',
        description:'Controlled synthetic end-to-end scenario for '+code+'.',
        alertIds:incidentAlerts,
        assignedTo:userId,
        reason:'Task 40 controlled scenario incident creation',
      });
      incidentIds.push(incident.id);
      assert.equal(incident.categoryCode,code);
      assert.equal(incident.severity,core.severity);

      await investigations.addNote(token,incident.id,{
        content:'Task 40 analyst finding confirms synthetic '+code+' evidence chain.',
        alertIds:incidentAlerts,
        eventIds:categoryEvents,
      });

      const containment=['BRUTE_FORCE','PRIVILEGE_ESCALATION','RANSOMWARE','DATA_EXFILTRATION'].includes(code);
      const action=code==='CREDENTIAL_ATTACK'?'ESCALATION':containment?'CONTAINMENT':'FOLLOW_UP_TASK';
      const response=await responses.record(token,incident.id,{
        action,
        reason:'Task 40 controlled response for '+code,
        details:'Synthetic manual response record; no external action executed.',
        succeeded:true,
        containmentPerformed:action==='CONTAINMENT',
      });
      assert.equal(response.succeeded,true);

      const resolved=await incidents.updateStatus(token,incident.id,{
        status:'RESOLVED',
        reason:'Task 40 scenario verification complete',
        resolutionNote:'Synthetic '+code+' scenario detected, investigated, responded to and verified.',
      });
      assert.equal(resolved.status,'RESOLVED');
      assert.equal(resolved.categoryCode,code);

      const workspace=await investigations.workspace(token,incident.id);
      assert.equal(workspace.incident.categoryCode,code);
      assert.ok(workspace.notes.some(note=>note.content.includes(code)));
      assert.ok(workspace.timeline.some(item=>item.type==='INVESTIGATION_NOTE'));
      assert.ok(workspace.timeline.some(item=>item.type==='INCIDENT_HISTORY'));

      const incidentReport=(await reports.incident(token,incident.id,new URLSearchParams('format=json'))).report;
      assert.equal(incidentReport.incident.categoryCode,code);
      assert.ok(incidentReport.alerts.every(alert=>alert.category_code===code));
      assert.equal(incidentReport.investigationNotes.length,1);
      assert.equal(incidentReport.responses.length,1);

      const eventSearch=await eventViews.list(token,new URLSearchParams({categoryCode:code,user:identity.user}));
      const alertSearch=await alerts.list(token,new URLSearchParams({categoryCode:code,user:identity.user}));
      const incidentSearch=await incidents.list(token,new URLSearchParams({categoryCode:code,user:identity.user}));
      assert.ok(eventSearch.events.some(item=>categoryEvents.includes(item.id)),code+' missing from event category filter');
      assert.ok(alertSearch.alerts.some(item=>incidentAlerts.includes(item.id)&&item.threat===code),code+' missing from alert category filter');
      assert.ok(incidentSearch.incidents.some(item=>item.id===incident.id&&item.categoryCode===code),code+' missing from incident category filter');

      const audit=(await pool.query("SELECT context FROM audit_logs WHERE actor_id=$1 AND action='INCIDENT_CREATED' AND target_id=$2",[userId,incident.id])).rows[0];
      assert.equal(audit.context.categoryCode,code);

      scenarioResults.set(code,{
        categoryCode:code,
        inputCount:categoryEvents.length,
        alertIds:incidentAlerts,
        incidentId:incident.id,
        responseAction:action,
        result:'RESOLVED',
      });
    }

    stage='catalog propagation';
    const catalog=await categories.list(token,new URLSearchParams());
    sameSet(catalog.map(item=>item.code),CATEGORY_CODES,'catalog must expose all fifteen threat categories');

    stage='dashboard taxonomy propagation';
    const snapshot=await dashboard.snapshot(token);
    const alertThreats=snapshot.threats.alerts.map(item=>item.code);
    const incidentThreats=snapshot.threats.incidents.map(item=>item.code);
    for(const code of CATEGORY_CODES){
      assert.ok(alertThreats.includes(code),'dashboard alert threats missing '+code);
      assert.ok(incidentThreats.includes(code),'dashboard incident threats missing '+code);
    }

    stage='report taxonomy propagation';
    const summary=(await reports.security(token,new URLSearchParams('format=json'))).report;
    const reportedCategories=summary.incidents.categories.map(item=>item.code);
    for(const code of CATEGORY_CODES)assert.ok(reportedCategories.includes(code),'security summary missing '+code);

    stage='required Task 40 scenario mapping';
    for(const code of ['BRUTE_FORCE','CREDENTIAL_ATTACK','SUSPICIOUS_ACCOUNT_ACTIVITY','PRIVILEGE_ESCALATION','RECONNAISSANCE','SUSPICIOUS_NETWORK_ACTIVITY','DATA_EXFILTRATION']){
      assert.ok(scenarioResults.has(code),'required controlled scenario missing '+code);
    }
    assert.equal(scenarioResults.size,15);
    assert.equal(scenarioResults.get('BRUTE_FORCE').alertIds.length,2,'correlation scenario must retain both brute-force alerts');

    return{
      categoryCount:scenarioResults.size,
      requiredScenarios:{
        bruteForce:'BRUTE_FORCE',
        suspiciousAuthentication:['CREDENTIAL_ATTACK','SUSPICIOUS_ACCOUNT_ACTIVITY'],
        privilegeEscalation:'PRIVILEGE_ESCALATION',
        reconnaissance:'RECONNAISSANCE',
        suspiciousOutbound:['SUSPICIOUS_NETWORK_ACTIVITY','DATA_EXFILTRATION'],
        correlation:'BRUTE_FORCE',
        falsePositive:'benign authentication success',
      },
    };
  }catch(error){
    error.message='Task 40 failed during '+stage+': '+error.message;
    throw error;
  }finally{
    let cleanupError=null;
    try{
      if(incidentIds.length){
        await pool.query('DELETE FROM notifications WHERE incident_id=ANY($1::uuid[])',[incidentIds]);
        await pool.query('DELETE FROM response_actions WHERE incident_id=ANY($1::uuid[])',[incidentIds]);
        await pool.query('DELETE FROM investigation_notes WHERE incident_id=ANY($1::uuid[])',[incidentIds]);
        await pool.query('DELETE FROM incident_alerts WHERE incident_id=ANY($1::uuid[])',[incidentIds]);
        await pool.query('DELETE FROM incidents WHERE id=ANY($1::uuid[])',[incidentIds]);
      }
      const alerts=[...alertIds];
      if(alerts.length){
        await pool.query('DELETE FROM notifications WHERE alert_id=ANY($1::uuid[])',[alerts]);
        await pool.query('DELETE FROM alert_correlations WHERE alert_id=ANY($1::uuid[]) OR related_alert_id=ANY($1::uuid[])',[alerts]);
        await pool.query('DELETE FROM alert_events WHERE alert_id=ANY($1::uuid[])',[alerts]);
        await pool.query('DELETE FROM alerts WHERE id=ANY($1::uuid[])',[alerts]);
      }
      if(eventIds.length)await pool.query('DELETE FROM security_events WHERE id=ANY($1::uuid[])',[eventIds]);
      if(ruleIds.length){
        await pool.query('DELETE FROM rule_mitre_mappings WHERE rule_id=ANY($1::uuid[])',[ruleIds]);
        await pool.query('DELETE FROM detection_rules WHERE id=ANY($1::uuid[])',[ruleIds]);
      }
      if(userId){
        await pool.query('DELETE FROM auth_sessions WHERE user_id=$1',[userId]);
        await pool.query('DELETE FROM audit_logs WHERE actor_id=$1 OR (target_type=\'user\' AND target_id=$1)',[userId]);
        await pool.query('DELETE FROM user_roles WHERE user_id=$1',[userId]);
        await pool.query('DELETE FROM users WHERE id=$1',[userId]);
      }
      for(const row of categoryState){
        await pool.query('UPDATE threat_categories SET enabled=$2,updated_at=$3 WHERE code=$1',[row.code,row.enabled,row.updated_at]);
      }
    }catch(error){cleanupError=error;}
    if(cleanupError)throw new Error('Task 40 cleanup failed; review synthetic records and taxonomy availability locally.');
  }
}

async function main(){
  let pool;
  try{
    pool=createPool();
    const result=await verifyEndToEndScenarios(pool);
    console.log(result.categoryCount+' threat categories propagated through detection, alert, incident, investigation, response, resolution, search, dashboard and reporting; required Task 40 scenarios and false-positive control verified. Synthetic changes cleaned up.');
  }catch(error){
    console.error(error.message);
    process.exitCode=1;
  }finally{if(pool)await pool.end();}
}

if(require.main===module)main();
module.exports={verifyEndToEndScenarios};
