const test=require('node:test');
const assert=require('node:assert/strict');
const {assessmentInput,INCIDENT_SEVERITIES}=require('../../src/incidents/model');
const {incidentService}=require('../../src/incidents/service');
const {incidentRepository}=require('../../src/data/incident-repository');
const ID='11111111-1111-4111-8111-111111111111';

test('assessment validates only approved category/severity and requires reason',()=>{
  assert.deepEqual(INCIDENT_SEVERITIES,['LOW','MEDIUM','HIGH','CRITICAL']);
  assert.deepEqual(assessmentInput({categoryCode:'MALWARE',severity:'CRITICAL',reason:' Evidence confirmed '}),{categoryCode:'MALWARE',severity:'CRITICAL',reason:'Evidence confirmed'});
  assert.deepEqual(assessmentInput({categoryCode:null,severity:'LOW',reason:'Classification cleared'}),{categoryCode:null,severity:'LOW',reason:'Classification cleared'});
  for(const body of [
    {categoryCode:'NOPE',severity:'HIGH',reason:'x'},
    {categoryCode:'MALWARE',severity:'EXTREME',reason:'x'},
    {categoryCode:'MALWARE',severity:'HIGH',reason:''},
    {categoryCode:'MALWARE',severity:'HIGH',reason:'x',priority:'P1'},
  ]) assert.throws(()=>assessmentInput(body),{status:400});
});

test('Viewer can inspect but cannot adjust incident assessment',async()=>{
  const access={me:async token=>({user:{id:ID},roles:[token]})};
  const repo={get:async()=>({id:ID}),updateAssessment:async()=>({id:ID,severity:'HIGH'})};
  const service=incidentService(repo,access);
  assert.equal((await service.inspect('Viewer/Management',ID)).id,ID);
  await assert.rejects(service.assess('Viewer/Management',ID,{categoryCode:'MALWARE',severity:'HIGH',reason:'x'}),{status:403});
  assert.equal((await service.assess('Security Analyst',ID,{categoryCode:'MALWARE',severity:'HIGH',reason:'x'})).severity,'HIGH');
});

test('assessment can correct terminal incident without changing lifecycle and audits old/new values',async()=>{
  const now=new Date('2026-09-30T03:00:00Z');
  let state={id:ID,title:'I',description:'',status:'RESOLVED',threat_level:'MEDIUM',category_code:null,assigned_to:null,created_at:now,updated_at:now,
    assignment_updated_at:null,assignment_updated_by:null,status_updated_at:now,status_updated_by:'actor',assessment_updated_at:null,assessment_updated_by:null,
    resolution_note:'handled',resolution_at:now,resolution_by:'actor'};
  const queries=[];
  const client={release(){},async query(sql,params){
    queries.push({sql,params});
    if(['BEGIN','COMMIT','ROLLBACK'].includes(sql))return{rows:[]};
    if(sql.startsWith('SELECT id FROM users'))return{rows:[{id:'actor'}]};
    if(sql.includes('FROM user_roles'))return{rows:[{name:'Security Analyst'}]};
    if(sql.includes('FOR UPDATE OF i'))return{rows:[state]};
    if(sql.startsWith('SELECT code FROM threat_categories'))return{rows:[{code:'MALWARE'}]};
    if(sql.startsWith('UPDATE incidents SET category_code=')){state={...state,category_code:params[1],threat_level:params[2],assessment_updated_at:now,assessment_updated_by:'actor',updated_at:now};return{rows:[]};}
    if(sql.startsWith('INSERT INTO audit_logs'))return{rows:[]};
    if(sql.startsWith('SELECT i.*,u.display_name AS assigned_name'))return{rows:[state]};
    throw new Error('unexpected '+sql);
  }};
  const result=await incidentRepository({connect:async()=>client}).updateAssessment('actor',ID,{categoryCode:'MALWARE',severity:'CRITICAL',reason:'Forensic evidence confirmed malware'});
  assert.equal(result.status,'RESOLVED');assert.equal(result.resolutionNote,'handled');assert.equal(result.categoryCode,'MALWARE');assert.equal(result.severity,'CRITICAL');
  const audit=queries.find(q=>q.sql.startsWith('INSERT INTO audit_logs'));
  assert.deepEqual(JSON.parse(audit.params[2]),{previousCategoryCode:null,categoryCode:'MALWARE',previousSeverity:'MEDIUM',severity:'CRITICAL',reason:'Forensic evidence confirmed malware'});
});

test('new category must be selectable but unchanged historical category can retain severity adjustment',async()=>{
  const now=new Date();let state={id:ID,title:'I',description:'',status:'NEW',threat_level:'LOW',category_code:'MALWARE',assigned_to:null,created_at:now,updated_at:now,
    assignment_updated_at:null,assignment_updated_by:null,status_updated_at:null,status_updated_by:null,assessment_updated_at:null,assessment_updated_by:null,resolution_note:null,resolution_at:null,resolution_by:null};
  let selectableQueries=0;
  const client={release(){},async query(sql,params){
    if(['BEGIN','COMMIT','ROLLBACK'].includes(sql))return{rows:[]};
    if(sql.startsWith('SELECT id FROM users'))return{rows:[{id:'actor'}]};
    if(sql.includes('FROM user_roles'))return{rows:[{name:'Administrator'}]};
    if(sql.includes('FOR UPDATE OF i'))return{rows:[state]};
    if(sql.startsWith('SELECT code FROM threat_categories')){selectableQueries++;return{rows:[]};}
    if(sql.startsWith('UPDATE incidents SET category_code=')){state={...state,category_code:params[1],threat_level:params[2],assessment_updated_at:now,assessment_updated_by:'actor'};return{rows:[]};}
    if(sql.startsWith('INSERT INTO audit_logs'))return{rows:[]};
    if(sql.startsWith('SELECT i.*,u.display_name AS assigned_name'))return{rows:[state]};
    throw new Error(sql);
  }};
  const repo=incidentRepository({connect:async()=>client});
  assert.equal((await repo.updateAssessment('actor',ID,{categoryCode:'MALWARE',severity:'HIGH',reason:'Severity adjusted'})).severity,'HIGH');
  assert.equal(selectableQueries,0);
  await assert.rejects(repo.updateAssessment('actor',ID,{categoryCode:'RANSOMWARE',severity:'HIGH',reason:'Reclassify'}),{status:400});
  assert.equal(selectableQueries,1);
});

test('unchanged category and severity is a no-op without an audit record',async()=>{
  const now=new Date();const state={id:ID,title:'I',description:'',status:'DISMISSED',threat_level:'HIGH',category_code:'BRUTE_FORCE',assigned_to:null,created_at:now,updated_at:now,
    assignment_updated_at:null,assignment_updated_by:null,status_updated_at:null,status_updated_by:null,assessment_updated_at:null,assessment_updated_by:null,resolution_note:'false positive',resolution_at:now,resolution_by:'actor'};
  let audit=0,updates=0;
  const client={release(){},async query(sql){
    if(['BEGIN','COMMIT','ROLLBACK'].includes(sql))return{rows:[]};
    if(sql.startsWith('SELECT id FROM users'))return{rows:[{id:'actor'}]};
    if(sql.includes('FROM user_roles'))return{rows:[{name:'Security Analyst'}]};
    if(sql.includes('FOR UPDATE OF i'))return{rows:[state]};
    if(sql.startsWith('UPDATE incidents')){updates++;return{rows:[]};}
    if(sql.startsWith('INSERT INTO audit_logs')){audit++;return{rows:[]};}
    throw new Error(sql);
  }};
  const result=await incidentRepository({connect:async()=>client}).updateAssessment('actor',ID,{categoryCode:'BRUTE_FORCE',severity:'HIGH',reason:'No change'});
  assert.equal(result.changed,false);assert.equal(result.status,'DISMISSED');assert.equal(audit,0);assert.equal(updates,0);
});
