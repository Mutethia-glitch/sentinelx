const assert=require('node:assert/strict');
const {createPool}=require('../src/data/pool');
const {incidentManagementFixture}=require('./verify-incident-management');

const EXPECTED=new Map([
 ['SX-CORE-001 Brute force authentication failures',['T1110']],
 ['SX-CORE-002 Credential attack indicators',['T1110']],
 ['SX-CORE-006 Reconnaissance activity',['T1046']],
 ['SX-CORE-008 Phishing or social engineering report',['T1566']],
 ['SX-CORE-010 Ransomware event',['T1486']],
 ['SX-CORE-011 Denial of service indicators',['T1498']],
 ['SX-CORE-013 Web application attack event',['T1190']],
 ['SX-CORE-015 Supply chain compromise classification',['T1195']],
]);
const UNMAPPED=[
 'SX-CORE-003 Privilege escalation action','SX-CORE-004 Suspicious account activity flag',
 'SX-CORE-005 Repeated unauthorized access attempts','SX-CORE-007 Suspicious network activity flag',
 'SX-CORE-009 Malware event','SX-CORE-012 Data exfiltration event','SX-CORE-014 Insider threat classification',
];
const TACTICS={T1110:'TA0006',T1046:'TA0007',T1566:'TA0001',T1486:'TA0040',T1498:'TA0040',T1190:'TA0001',T1195:'TA0001'};

async function verifyMitre(pool){
 const f=await incidentManagementFixture(pool);let syntheticRule=null,mappingId=null,added=false;
 try{
  async function login(user){const r=await fetch(f.base+'/api/auth/login',{method:'POST',headers:{Origin:f.base,'Content-Type':'application/json'},body:JSON.stringify({email:user.email,password:f.password})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
  const cookies=[];for(const u of f.users)cookies.push(await login(u));
  const catalog=await fetch(f.base+'/api/rules/mitre-mappings',{headers:{Cookie:cookies[1]}});assert.equal(catalog.status,200);
  assert.equal((await fetch(f.base+'/api/rules/mitre-mappings',{headers:{Cookie:cookies[2]}})).status,403);
  const mappings=(await catalog.json()).mappings;
  for(const [technique,tactic] of Object.entries(TACTICS)){const item=mappings.find(x=>x.techniqueId===technique);assert.ok(item,technique);assert.ok(item.tactics.some(x=>x.tacticId===tactic),technique+' tactic');}
  for(const [name,ids] of EXPECTED){
   const sql="SELECT r.id,array_agg(m.technique_id ORDER BY m.technique_id) ids FROM detection_rules r JOIN rule_mitre_mappings rm ON rm.rule_id=r.id JOIN mitre_mappings m ON m.id=rm.mapping_id WHERE r.name=$1 GROUP BY r.id";
   const row=(await pool.query(sql,[name])).rows[0];assert.ok(row,name);assert.deepEqual(row.ids,ids);
   const api=await fetch(f.base+'/api/rules/'+row.id,{headers:{Cookie:cookies[0]}});assert.equal(api.status,200);
   const rule=(await api.json()).rule;assert.deepEqual(rule.mitreTechniqueIds,ids);assert.equal(rule.mitreMappings.length,ids.length);
   assert.equal(rule.mitreMappings[0].techniqueId,ids[0]);assert.ok(rule.mitreMappings[0].tactics.length>=1);
  }
  for(const name of UNMAPPED){
   const count=(await pool.query('SELECT count(*)::integer n FROM rule_mitre_mappings rm JOIN detection_rules r ON r.id=rm.rule_id WHERE r.name=$1',[name])).rows[0].n;
   assert.equal(count,0,name+' intentionally unmapped');
  }
  syntheticRule=(await pool.query('SELECT rule_id FROM alerts WHERE id=$1',[f.alertIds[0]])).rows[0].rule_id;
  mappingId=(await pool.query("SELECT id FROM mitre_mappings WHERE technique_id='T1110'")).rows[0].id;
  const inserted=await pool.query('INSERT INTO rule_mitre_mappings(rule_id,mapping_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING rule_id',[syntheticRule,mappingId]);added=Boolean(inserted.rows[0]);
  const created=await fetch(f.base+'/api/incidents',{method:'POST',headers:{Cookie:cookies[1],Origin:f.base,'Content-Type':'application/json'},body:JSON.stringify({title:'Task 28 MITRE incident',description:'Synthetic mapping propagation',alertIds:f.alertIds,assignedTo:null,reason:'Verify ATT&CK context'})});
  assert.equal(created.status,201);const incident=(await created.json()).incident;f.incidentIds.push(incident.id);
  const investigation=(await (await fetch(f.base+'/api/investigations/'+incident.id,{headers:{Cookie:cookies[2]}})).json()).investigation;
  assert.ok(investigation.alerts.every(a=>a.mitreMappings.some(m=>m.techniqueId==='T1110')));
  const report=(await (await fetch(f.base+'/api/reports/incidents/'+incident.id,{headers:{Cookie:cookies[2]}})).json()).report;
  assert.ok(report.alerts.every(a=>a.mitreMappings.some(m=>m.techniqueId==='T1110')));
  return true;
 }finally{if(added&&syntheticRule&&mappingId)await pool.query('DELETE FROM rule_mitre_mappings WHERE rule_id=$1 AND mapping_id=$2',[syntheticRule,mappingId]);await f.cleanup();}
}
async function main(){let pool;try{pool=createPool();await verifyMitre(pool);console.log('Documented partial ATT&CK technique/tactic mappings, core-rule assignments, rule catalog and incident-context propagation verified. Synthetic changes cleaned up.');}catch{console.error('Task 28 MITRE verification failed. Apply migration 015 and check quality locally. No credentials were printed.');process.exitCode=1;}finally{if(pool)await pool.end();}}
if(require.main===module)main();
module.exports={verifyMitre,EXPECTED,UNMAPPED,TACTICS};