'use strict';
const ui=window.SentinelXUi,el=id=>document.getElementById(id),request=ui.request;
let generation=0,page=1,canManage=false,currentRule=null,lastAccess=null;
function message(value,error=false){
 const node=el('message');node.textContent=(error?'Error: ':'')+value;node.classList.toggle('error',error);
 if(error)node.scrollIntoView({block:'center'});
}
function clearDetail(){
 currentRule=null;el('rule-detail').hidden=true;el('rule-fields').replaceChildren();
 el('rule-definition').textContent='';el('rule-manage').hidden=true;
 el('rule-reason').value='';el('rule-confirm').checked=false;
}
function reset(){
 generation++;ui.clearAccess();currentRule=null;canManage=false;lastAccess=null;
 el('login-panel').hidden=false;el('identity-panel').hidden=true;el('rules-panel').hidden=true;
 el('identity').textContent='';el('rule-rows').replaceChildren();clearDetail();
}
function fail(error){
 if(error.status===401){reset();return message('Sign in to continue.',true);}
 if(error.status===403){clearDetail();el('rules-panel').hidden=true;}
 message(ui.safeError(error),true);
}
const fmt=value=>value===null||value===undefined?'Not specified':String(value);
function field(name,value){
 const a=document.createElement('dt'),b=document.createElement('dd');
 a.textContent=name;b.textContent=fmt(value);el('rule-fields').append(a,b);
}
async function inspect(id){
 const current=++generation;ui.clearDrafts();clearDetail();
 try{
  const {rule}=await request('/api/rules/'+encodeURIComponent(id));
  if(current!==generation)return;
  currentRule=rule;
  field('Rule',rule.name);field('Threat category',rule.categoryCode);
  field('Alert severity',rule.severity);field('State',rule.enabled?'ENABLED':'DISABLED');
  field('Version',rule.version);field('Description',rule.description);
  field('MITRE techniques',(rule.mitreTechniqueIds||[]).join(', ')||'Not mapped');
  el('rule-definition').textContent=JSON.stringify(rule.definition,null,2);
  el('rule-action').textContent=rule.enabled?'Disable this rule':'Enable this rule';
  el('rule-action-warning').textContent=rule.enabled
   ?'Disable this rule only when authorized. Historical alerts and events remain preserved.'
   :'Enabling this rule activates live alert evaluation for new qualifying evidence in this company only. Check source attribution and the threshold before proceeding.';
  el('rule-manage').hidden=!canManage;el('rule-detail').hidden=false;
  ui.revealDetails(el('rule-detail'));message('Rule loaded. Review its definition and correlation threshold.');
 }catch(error){if(current===generation)fail(error);}
}
async function load(){
 const current=++generation;ui.clearDrafts();clearDetail();
 try{
  const access=await request('/api/access/me');
  if(current!==generation)return;
  lastAccess=access;ui.applyAccess(access);
  el('login-panel').hidden=true;el('identity-panel').hidden=false;
  el('identity').textContent=access.user.displayName+' · '+(access.roles.join(', ')||'No role assigned');
  if(!access.permissions.includes('rules.read')){
   el('rules-panel').hidden=true;return message('This account cannot view detection rules.',true);
  }
  canManage=access.permissions.includes('rules.manage');
  const result=await request('/api/rules?page='+page);
  if(current!==generation)return;
  el('rule-rows').replaceChildren();
  const query=el('rule-search').value.trim().toLowerCase();
  for(const rule of result.rules){
   if(query&&!((rule.name+' '+rule.categoryCode).toLowerCase().includes(query)))continue;
   const tr=document.createElement('tr');tr.dataset.ruleId=rule.id;
   for(const value of [rule.name,rule.categoryCode,rule.severity,
      rule.definition.threshold,rule.definition.windowSeconds+'s',rule.enabled?'ENABLED':'DISABLED']){
    const td=document.createElement('td');td.textContent=fmt(value);tr.append(td);
   }
   const td=document.createElement('td'),button=document.createElement('button');
   button.type='button';button.textContent='Inspect';button.setAttribute('aria-label','Inspect rule '+rule.name);
   button.addEventListener('click',()=>inspect(rule.id));td.append(button);tr.append(td);el('rule-rows').append(tr);
  }
  el('page').textContent='Page '+result.page;el('previous').disabled=page<=1;el('next').disabled=!result.hasMore;
  el('rule-summary').textContent='Loaded '+result.rules.length+' tenant-local rules. '+(canManage
   ?'Your account may request an audited enable/disable change.':'Your account can inspect but cannot change rule state.');
  el('rules-panel').hidden=false;message('Detection rules loaded.');
 }catch(error){if(current===generation)fail(error);}
}
el('rule-state-form').addEventListener('submit',async event=>{
 event.preventDefault();
 if(!currentRule||!canManage)return;
 const rule=currentRule,reason=el('rule-reason').value.trim();
 if(!reason||reason.length>500||!el('rule-confirm').checked)return message('Provide a reason and confirm that you reviewed this rule.',true);
 const btn=el('rule-action');btn.disabled=true;const current=++generation;
 try{
  // Send all currently persisted fields unchanged except enabled. Backend
  // rechecks permissions, tenant-local row version, Origin, and writes an audit.
  const definition=rule.definition;
  const body={
   name:rule.name,description:rule.description,enabled:!rule.enabled,
   severity:rule.severity,categoryCode:rule.categoryCode,
   conditions:definition.conditions,threshold:definition.threshold,
   windowSeconds:definition.windowSeconds,groupBy:definition.groupBy,
   mitreTechniqueIds:rule.mitreTechniqueIds||[],reason,version:rule.version
  };
  const {rule:changed}=await request('/api/rules/'+encodeURIComponent(rule.id),{
   method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
  });
  if(current!==generation)return;
  await load();await inspect(changed.id);
  message('Rule '+(changed.enabled?'enabled':'disabled')+'. The reason and before/after state were recorded in Audit.');
 }catch(error){
  if(error.status===409){message('The rule changed since inspection. Refresh and review it before retrying.',true);await load();}
  else fail(error);
 }finally{btn.disabled=false;}
});
el('rule-search').addEventListener('input',()=>{void load();});
el('refresh-rules').addEventListener('click',()=>load());
document.querySelector('[data-sx-refresh]').addEventListener('click',()=>load());
el('previous').addEventListener('click',()=>{if(page>1){page--;void load();}});
el('next').addEventListener('click',()=>{page++;void load();});
el('login-form').addEventListener('submit',async event=>{
 event.preventDefault();const btn=event.currentTarget.querySelector('button');btn.disabled=true;
 try{
  const result=await request('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({email:el('email').value,password:el('password').value})});
  if(ui.beginTwoFactor(result,'/rules'))return;
  await load();
 }catch(error){fail(error);}finally{el('password').value='';btn.disabled=false;}
});
el('logout').addEventListener('click',async()=>{
 try{await request('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});}
 catch(error){fail(error);}finally{reset();message('Signed out.');}
});
void load();
