'use strict';
const ui=window.SentinelXUi;
const el=id=>document.getElementById(id);
let generation=0,page=1,activeFilters=new URLSearchParams(),canManage=false,currentAlertId=null,currentEventId=null;
function message(text,error=false){el('message').textContent=error?`Error: ${text}`:text;el('message').classList.toggle('error',error);if(error)el('message').scrollIntoView({block:'center'});}
function clearDetail(){currentAlertId=null;el('detail-panel').hidden=true;el('detail-fields').replaceChildren();el('entities').textContent='';el('match-evidence').textContent='';el('event-rows').replaceChildren();el('status-form').hidden=true;el('status-reason').value='';clearEvent();}
function clearData(){el('rows').replaceChildren();el('results').textContent='';el('page').textContent='';el('previous').disabled=true;el('next').disabled=true;clearDetail();}
function reset(){ui.clearAccess();generation++;clearData();el('login-panel').hidden=false;el('identity-panel').hidden=true;el('alerts-panel').hidden=true;el('identity').textContent='';canManage=false;}
const request=ui.request;
function handleError(error){if(error.status===401||error.status===403)reset();if(error.status===401)return message(error.requestPath==='/api/auth/login'?ui.safeError(error):'Sign in to continue.',error.requestPath==='/api/auth/login');message(ui.safeError(error),true);}
function addField(label,value){const term=document.createElement('dt'),description=document.createElement('dd');term.textContent=label;description.textContent=value??'Unknown';el('detail-fields').append(term,description);}
function clearEvent(){currentEventId=null;el('event-detail').hidden=true;el('event-identity').textContent='';el('normalized-event').textContent='';el('raw-event').textContent='';}
async function inspectEvent(id,background=false){background=background===true;if(!background)ui.clearDrafts();
  const current=++generation;if(!background)clearEvent();
  try{
    const {event}=await request(`/api/events/${encodeURIComponent(id)}`);
    if(current!==generation||(background&&!ui.liveCanApply()))return false;
    currentEventId=id;el('event-identity').textContent=`${event.id} · ${event.timestamp} · ${event.source} / ${event.type}`;
    el('normalized-event').textContent=event.event?JSON.stringify(Object.fromEntries(Object.entries(event.event).filter(([key])=>key!=='rawData')),null,2):'Not yet normalized.';
    el('raw-event').textContent=JSON.stringify(event.rawData,null,2);
    el('event-detail').hidden=false;if(!background){el('event-detail').focus();message('Source event loaded.');}return true;
  }catch(error){if(current===generation&&(!background||error.status===401||error.status===403))handleError(error);if(background)throw error;}
}
async function inspect(id,background=false){background=background===true;if(!background)ui.clearDrafts();
  const current=++generation;if(!background)clearDetail();
  try{
    const {alert}=await request(`/api/alerts/${encodeURIComponent(id)}`);
    if(current!==generation||(background&&!ui.liveCanApply()))return false;
    if(background)clearDetail();currentAlertId=alert.id;
    for(const [label,value] of Object.entries({ID:alert.id,Generated:alert.timestamp,Severity:alert.severity,Threat:alert.threat,Source:alert.source,Status:alert.status,Confidence:alert.confidence===null?'Not calibrated':String(alert.confidence),Rule:`${alert.rule.name} (${alert.rule.id})`,TriggerEvent:alert.triggerEventId,Reason:alert.matchReason}))addField(label,value);
    el('entities').textContent=JSON.stringify(alert.affectedEntities,null,2);
    el('match-evidence').textContent=JSON.stringify(alert.matchEvidence,null,2);
    for(const event of alert.events){
      const row=document.createElement('tr');
      for(const value of [event.id,event.timestamp,`${event.source} / ${event.type}`,`${event.user||'Unknown'} / ${event.host||'Unknown'}`,event.status||'Unknown',event.trigger?'Yes':'No']){
        const cell=document.createElement('td');cell.textContent=value;row.append(cell);
      }
      const cell=document.createElement('td'),button=document.createElement('button');button.type='button';button.textContent='Inspect event';button.setAttribute('aria-label',`Inspect source event ${event.id}`);button.addEventListener('click',()=>inspectEvent(event.id));cell.append(button);row.append(cell);
      el('event-rows').append(row);
    }
    el('alert-status').value=alert.status;el('status-form').hidden=!canManage;
    el('detail-panel').hidden=false;if(!background)el('detail-panel').focus();if(!background)message('Alert loaded.');return true;
  }catch(error){if(current===generation&&(!background||error.status===401||error.status===403))handleError(error);if(background)throw error;}
}
async function load(background=false){background=background===true;if(!background)ui.clearDrafts();
  const current=++generation;if(!background)clearData();if(!background)ui.loading('Loading alerts…');
  try{
    const access=await request('/api/access/me');if(current!==generation||(background&&!ui.liveCanApply()))return false;ui.applyAccess(access);
    el('login-panel').hidden=true;el('identity-panel').hidden=false;el('identity').textContent=`${access.user.displayName} · ${access.roles.join(', ')||'No role assigned'}`;
    if(!access.permissions.includes('alerts.read')){el('alerts-panel').hidden=true;message('Your account does not have permission to view alerts.',true);return;}
    canManage=access.permissions.includes('alerts.manage');
    const params=new URLSearchParams(activeFilters);params.set('page',String(page));
    const data=await request(`/api/alerts?${params}`);if(current!==generation||(background&&!ui.liveCanApply()))return false;
    el('rows').replaceChildren();for(const alert of data.alerts){
      const row=document.createElement('tr');
      for(const value of [alert.timestamp.replace('T',' ').replace(/\.000Z$/,' UTC').replace(/Z$/,' UTC'),alert.severity,alert.threat,alert.rule.name,alert.source,alert.status]){
        const cell=document.createElement('td');cell.textContent=value;row.append(cell);
      }
      const cell=document.createElement('td'),button=document.createElement('button');button.type='button';button.textContent='Inspect';button.setAttribute('aria-label',`Inspect alert ${alert.id}`);button.addEventListener('click',()=>inspect(alert.id));cell.append(button);row.append(cell);el('rows').append(row);
    }
    el('alerts-panel').hidden=false;el('results').textContent=data.alerts.length?`${data.alerts.length} ${data.alerts.length===1?'alert':'alerts'} on this page.`:'No alerts match these filters.';
    el('page').textContent=`Page ${data.page}`;el('previous').disabled=page<=1;el('next').disabled=!data.hasMore;if(!background)message('Alerts loaded.');return true;
  }catch(error){if(current===generation&&(!background||error.status===401||error.status===403))handleError(error);if(background)throw error;}
}
el('filters').addEventListener('submit',event=>{event.preventDefault();const params=new URLSearchParams();try{for(const [key,value] of new FormData(event.currentTarget))if(value.trim())params.set(key,['from','to'].includes(key)?new Date(value).toISOString():value.trim());activeFilters=params;page=1;load();}catch{clearData();message('Enter valid alert filters.',true);}});
el('clear').addEventListener('click',()=>{el('filters').reset();activeFilters=new URLSearchParams();page=1;load();});
el('previous').addEventListener('click',()=>{if(page>1){page--;load();}});
el('next').addEventListener('click',()=>{if(page<2000){page++;load();}});
el('status-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!currentAlertId)return;
  const id=currentAlertId,current=++generation,button=event.currentTarget.querySelector('button');
  const body=JSON.stringify({status:el('alert-status').value,reason:el('status-reason').value});button.disabled=true;
  try{
    await request(`/api/alerts/${encodeURIComponent(id)}/status`,{method:'PATCH',headers:{'Content-Type':'application/json'},body});
    if(current!==generation)return;
    await load();
    if(current+1!==generation)return;
    await inspect(id);
  }catch(error){if(current===generation)handleError(error);}finally{button.disabled=false;}
});
el('login-form').addEventListener('submit',async event=>{event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;try{const login=await request('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:el('email').value,password:el('password').value})});if(ui.beginTwoFactor(login))return;await load();}catch(error){handleError(error);}finally{el('password').value='';button.disabled=false;}});
el('logout').addEventListener('click',async()=>{reset();try{await request('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});message('Signed out.');}catch(error){handleError(error);}});
load();

ui.startLiveUpdates(async()=>{const selected=currentAlertId,eventId=currentEventId;if(await load(true)!==true)return false;if(selected&&ui.liveCanApply()&&await inspect(selected,true)!==true)return false;return eventId&&ui.liveCanApply()?inspectEvent(eventId,true):true;},()=>!document.getElementById('identity-panel').hidden&&!document.getElementById('alerts-panel').hidden);
