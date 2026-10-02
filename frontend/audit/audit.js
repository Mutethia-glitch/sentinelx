'use strict';
const ui=window.SentinelXUi;
const el=id=>document.getElementById(id);
const entriesPerPage=10;
let page=1,filters=new URLSearchParams(),generation=0;

function message(value,error=false){
  el('message').textContent=error?'Error: '+value:value;
  el('message').classList.toggle('error',error);
  if(error)el('message').scrollIntoView({block:'center'});
}
const request=ui.request;
function clearDetail(){
  el('audit-detail-panel').hidden=true;
  el('audit-detail-id').textContent='';
  el('audit-detail-fields').replaceChildren();
  el('audit-context').textContent='';
}
function reset(){
  generation++;ui.clearAccess();
  el('login-panel').hidden=false;el('identity-panel').hidden=true;el('audit-panel').hidden=true;
  el('identity').textContent='';el('rows').replaceChildren();el('page').textContent='';
  el('previous').disabled=true;el('next').disabled=true;clearDetail();
}
function handleError(error){
  if(error.status===401||error.status===403)reset();
  if(error.status===401)return message(error.requestPath==='/api/auth/login'?ui.safeError(error):'Sign in to continue.',error.requestPath==='/api/auth/login');
  message(ui.safeError(error),true);
}
function iso(value){return value?new Date(value).toISOString():null;}
function field(label,value){
  const dt=document.createElement('dt'),dd=document.createElement('dd');
  dt.textContent=label;dd.textContent=value??'None';el('audit-detail-fields').append(dt,dd);
}
function showDetail(item){
  el('audit-detail-fields').replaceChildren();
  el('audit-detail-id').textContent=item.action+' · '+item.occurredAt;
  field('Actor',item.actor?.displayName||item.actorContext||'System');
  field('Action',item.action);
  field('Target',item.target.type+' / '+(item.target.id||'none'));
  field('Occurred',item.occurredAt);
  el('audit-context').textContent=JSON.stringify(item.context,null,2);
  el('audit-detail-panel').hidden=false;
}
function row(item){
  const tr=document.createElement('tr');
  const actor=item.actor?.displayName||item.actorContext||'System';
  const target=item.target.type+' / '+(item.target.id||'none');
  const context=JSON.stringify(item.context);
  for(const value of [item.occurredAt,actor,item.action,target,context.length>110?context.slice(0,107)+'...':context]){
    const td=document.createElement('td');td.textContent=value;tr.append(td);
  }
  const td=document.createElement('td'),button=document.createElement('button');
  button.type='button';button.textContent='Inspect';button.setAttribute('aria-label','Inspect audit entry '+item.action);
  button.addEventListener('click',()=>showDetail(item));td.append(button);tr.append(td);return tr;
}
async function load(background=false){background=background===true;if(!background)ui.clearDrafts();
  const current=++generation;if(!background)ui.loading('Loading audit trail…');
  try{
    const access=await request('/api/access/me');if(current!==generation||(background&&!ui.liveCanApply()))return false;
    ui.applyAccess(access);
    el('login-panel').hidden=true;el('identity-panel').hidden=false;
    el('identity').textContent=access.user.displayName+' · '+(access.roles.join(', ')||'No role assigned');
    if(!access.permissions.includes('audit.read')){el('audit-panel').hidden=true;message('Your account does not have permission to view the audit trail.',true);return;}
    const query=new URLSearchParams(filters);query.set('page',String(Math.ceil(page/5)));
    const data=await request('/api/audit?'+query);if(current!==generation||(background&&!ui.liveCanApply()))return false;
    el('rows').replaceChildren();if(!background)clearDetail();
    const start=((page-1)%5)*entriesPerPage,visibleEntries=data.entries.slice(start,start+entriesPerPage);
    for(const item of visibleEntries)el('rows').append(row(item));
    el('page').textContent='Page '+page+' · 10 entries per page';el('previous').disabled=page<=1;el('next').disabled=!(start+entriesPerPage<data.entries.length||data.hasMore);
    el('audit-panel').hidden=false;if(!background)message(visibleEntries.length?'Audit trail loaded.':'No audit entries match these filters.');return true;
  }catch(error){if(current===generation&&(!background||error.status===401||error.status===403))handleError(error);if(background)throw error;}
}
el('filters').addEventListener('submit',event=>{
  event.preventDefault();
  try{
    filters=new URLSearchParams();
    for(const [key,value] of new FormData(event.currentTarget)){if(!value)continue;filters.set(key,(key==='from'||key==='to')?iso(value):value);}
    page=1;load();
  }catch{message('Enter valid audit filter dates.',true);}
});
el('clear').addEventListener('click',()=>{el('filters').reset();filters=new URLSearchParams();page=1;load();});
el('previous').addEventListener('click',()=>{if(page>1){page--;load();}});
el('next').addEventListener('click',()=>{if(!el('next').disabled&&page<10000){page++;load();}});
el('login-form').addEventListener('submit',async event=>{
  event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;ui.loading('Signing in…');
  try{const login=await request('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:el('email').value,password:el('password').value})});if(ui.beginTwoFactor(login))return;await load();}
  catch(error){handleError(error);}finally{el('password').value='';button.disabled=false;}
});
el('logout').addEventListener('click',async()=>{
  reset();try{await request('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});message('Signed out.');}
  catch(error){handleError(error);}
});
load();

ui.startLiveUpdates(()=>load(true),()=>!document.getElementById('identity-panel').hidden&&!document.getElementById('audit-panel').hidden);
