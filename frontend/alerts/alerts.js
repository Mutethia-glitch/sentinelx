'use strict';
const el=id=>document.getElementById(id);
let generation=0,page=1,activeFilters=new URLSearchParams(),canManage=false,currentAlertId=null;
function message(text,error=false){el('message').textContent=error?`Error: ${text}`:text;el('message').classList.toggle('error',error);if(error)el('message').scrollIntoView({block:'center'});}
function clearDetail(){currentAlertId=null;el('detail-panel').hidden=true;el('detail-fields').replaceChildren();el('entities').textContent='';el('match-evidence').textContent='';el('event-rows').replaceChildren();el('status-form').hidden=true;el('status-reason').value='';}
function clearData(){el('rows').replaceChildren();el('results').textContent='';el('page').textContent='';el('previous').disabled=true;el('next').disabled=true;clearDetail();}
function reset(){generation++;clearData();el('login-panel').hidden=false;el('identity-panel').hidden=true;el('alerts-panel').hidden=true;el('identity').textContent='';canManage=false;}
async function request(path,options={}){const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options});const body=response.status===204?null:await response.json();if(!response.ok){const error=new Error(body?.error||'Request failed.');error.status=response.status;throw error;}return body;}
function handleError(error){if(error.status===401||error.status===403)reset();message(error.status?error.message:'Unable to reach SentinelX. Try again.',true);}
function addField(label,value){const term=document.createElement('dt'),description=document.createElement('dd');term.textContent=label;description.textContent=value??'Unknown';el('detail-fields').append(term,description);}
async function inspect(id){
  const current=++generation;clearDetail();
  try{
    const {alert}=await request(`/api/alerts/${encodeURIComponent(id)}`);
    if(current!==generation)return;
    currentAlertId=alert.id;
    for(const [label,value] of Object.entries({ID:alert.id,Generated:alert.timestamp,Severity:alert.severity,Threat:alert.threat,Source:alert.source,Status:alert.status,Confidence:alert.confidence===null?'Not calibrated':String(alert.confidence),Rule:`${alert.rule.name} (${alert.rule.id})`,TriggerEvent:alert.triggerEventId,Reason:alert.matchReason}))addField(label,value);
    el('entities').textContent=JSON.stringify(alert.affectedEntities,null,2);
    el('match-evidence').textContent=JSON.stringify(alert.matchEvidence,null,2);
    for(const event of alert.events){
      const row=document.createElement('tr');
      for(const value of [event.id,event.timestamp,`${event.source} / ${event.type}`,`${event.user||'Unknown'} / ${event.host||'Unknown'}`,event.status||'Unknown',event.trigger?'Yes':'No']){
        const cell=document.createElement('td');cell.textContent=value;row.append(cell);
      }
      el('event-rows').append(row);
    }
    el('alert-status').value=alert.status;el('status-form').hidden=!canManage;
    el('detail-panel').hidden=false;el('detail-panel').focus();message('Alert loaded.');
  }catch(error){if(current===generation)handleError(error);}
}
async function load(){
  const current=++generation;clearData();
  try{
    const access=await request('/api/access/me');if(current!==generation)return;
    el('login-panel').hidden=true;el('identity-panel').hidden=false;el('identity').textContent=`${access.user.displayName} · ${access.roles.join(', ')||'No role assigned'}`;
    if(!access.permissions.includes('alerts.read')){el('alerts-panel').hidden=true;message('Your account does not have permission to view alerts.',true);return;}
    canManage=access.permissions.includes('alerts.manage');
    const params=new URLSearchParams(activeFilters);params.set('page',String(page));
    const data=await request(`/api/alerts?${params}`);if(current!==generation)return;
    for(const alert of data.alerts){
      const row=document.createElement('tr');
      for(const value of [alert.timestamp.replace('T',' ').replace(/\.000Z$/,' UTC').replace(/Z$/,' UTC'),alert.severity,alert.threat,alert.rule.name,alert.source,alert.status]){
        const cell=document.createElement('td');cell.textContent=value;row.append(cell);
      }
      const cell=document.createElement('td'),button=document.createElement('button');button.type='button';button.textContent='Inspect';button.setAttribute('aria-label',`Inspect alert ${alert.id}`);button.addEventListener('click',()=>inspect(alert.id));cell.append(button);row.append(cell);el('rows').append(row);
    }
    el('alerts-panel').hidden=false;el('results').textContent=data.alerts.length?`${data.alerts.length} ${data.alerts.length===1?'alert':'alerts'} on this page.`:'No alerts match these filters.';
    el('page').textContent=`Page ${data.page}`;el('previous').disabled=page<=1;el('next').disabled=!data.hasMore;message('Alerts loaded.');
  }catch(error){if(current===generation)handleError(error);}
}
el('filters').addEventListener('submit',event=>{event.preventDefault();const params=new URLSearchParams();try{for(const [key,value] of new FormData(event.currentTarget))if(value.trim())params.set(key,['from','to'].includes(key)?new Date(value).toISOString():value.trim());activeFilters=params;page=1;load();}catch{clearData();message('Enter valid alert filters.',true);}});
el('clear').addEventListener('click',()=>{el('filters').reset();activeFilters=new URLSearchParams();page=1;load();});
el('previous').addEventListener('click',()=>{if(page>1){page--;load();}});
el('next').addEventListener('click',()=>{if(page<2000){page++;load();}});
el('status-form').addEventListener('submit',async event=>{event.preventDefault();if(!currentAlertId)return;const button=event.currentTarget.querySelector('button');button.disabled=true;try{await request(`/api/alerts/${encodeURIComponent(currentAlertId)}/status`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:el('alert-status').value,reason:el('status-reason').value})});const id=currentAlertId;await load();await inspect(id);}catch(error){handleError(error);}finally{button.disabled=false;}});
el('login-form').addEventListener('submit',async event=>{event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;try{await request('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:el('email').value,password:el('password').value})});await load();}catch(error){handleError(error);}finally{el('password').value='';button.disabled=false;}});
el('logout').addEventListener('click',async()=>{reset();try{await request('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});message('Signed out.');}catch(error){handleError(error);}});
load();
