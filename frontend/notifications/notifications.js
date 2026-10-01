'use strict';
const ui=window.SentinelXUi;
const el=id=>document.getElementById(id);let userId=null,canSend=false,page=1,status='ALL',generation=0;
function message(value,error=false){el('message').textContent=error?'Error: '+value:value;el('message').classList.toggle('error',error);}
function reset(){ui.clearAccess();generation++;userId=null;canSend=false;page=1;status='ALL';el('filter-status').value='ALL';el('notification-rows').replaceChildren();el('login-panel').hidden=false;el('identity-panel').hidden=true;el('inbox-panel').hidden=true;el('send-panel').hidden=true;}
const request=ui.request;
function handleError(error){if(error.status===401||error.status===403)reset();if(error.status===401)return message(error.requestPath==='/api/auth/login'?ui.safeError(error):'Sign in to continue.',error.requestPath==='/api/auth/login');message(ui.safeError(error),true);}
function renderNotification(item){
 const article=document.createElement('article');article.className='notification';
 if(['CRITICAL','HIGH'].includes(item.severity)&&item.state==='UNREAD')article.classList.add('urgent');
 if(item.state==='READ')article.classList.add('read');
 const heading=document.createElement('p'),description=document.createElement('p'),target=document.createElement('p'),date=document.createElement('p');
 heading.textContent=(item.severity||'UNSPECIFIED')+' · '+item.state;
 description.textContent=item.message;
 target.textContent=(item.incidentId?'Incident: '+item.incidentId:item.alertId?'Alert: '+item.alertId:'Historical notification');
 date.textContent='Delivered in app: '+item.deliveredAt+(item.readAt?' · Read: '+item.readAt:'');
 article.append(heading,description,target,date);
 if(!item.readAt){const button=document.createElement('button');button.type='button';button.textContent='Mark as read';button.addEventListener('click',async()=>{
  button.disabled=true;try{await request('/api/notifications/'+encodeURIComponent(item.id)+'/read',{method:'PATCH',headers:{'Content-Type':'application/json'},body:'{}'});await load();message('Notification marked as read.');}catch(error){handleError(error);button.disabled=false;}
 });article.append(button);}
 return article;
}
async function load(background=false){background=background===true;if(!background)ui.clearDrafts();
 const current=++generation;if(!background)el('notification-rows').replaceChildren();if(!background)ui.loading('Loading notifications…');
 try{
  const access=await request('/api/access/me');if(current!==generation||(background&&!ui.liveCanApply()))return false;ui.applyAccess(access);
  userId=access.user.id;canSend=access.permissions.includes('notifications.send');
  el('login-panel').hidden=true;el('identity-panel').hidden=false;
  el('identity').textContent=access.user.displayName+' · '+access.roles.join(', ');
  if(!access.permissions.includes('notifications.read')){el('inbox-panel').hidden=true;el('send-panel').hidden=true;message('Your account cannot view notifications.',true);return;}
  const data=await request('/api/notifications?status='+encodeURIComponent(status)+'&page='+page);
  if(current!==generation||(background&&!ui.liveCanApply()))return false;
  el('notification-rows').replaceChildren();for(const item of data.notifications)el('notification-rows').append(renderNotification(item));
  if(!data.notifications.length){const p=document.createElement('p');p.textContent='No notifications in this view.';el('notification-rows').append(p);}
  el('unread-count').textContent='Unread notifications: '+data.unreadCount;
  el('page').textContent='Page '+data.page;el('previous').disabled=data.page<=1;el('next').disabled=!data.hasMore;
  el('inbox-panel').hidden=false;el('send-panel').hidden=!canSend;if(!background)message('Inbox loaded.');return true;
 }catch(error){if(current===generation&&(!background||error.status===401||error.status===403))handleError(error);if(background)throw error;}
}
el('filters').addEventListener('submit',event=>{event.preventDefault();status=el('filter-status').value;page=1;load();});
el('previous').addEventListener('click',()=>{if(page>1){page--;load();}});
el('next').addEventListener('click',()=>{if(page<2000){page++;load();}});
el('send-self').addEventListener('change',()=>{el('recipient-id').disabled=el('send-self').checked;});
el('send-form').addEventListener('submit',async event=>{
 event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;
 try{
  const kind=el('target-kind').value,id=el('target-id').value.trim();
  const body={recipientId:el('send-self').checked?userId:el('recipient-id').value.trim(),
   incidentId:kind==='INCIDENT'?id:null,alertId:kind==='ALERT'?id:null,reason:el('send-reason').value};
  const outcome=await request('/api/notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  page=1;status='ALL';el('filter-status').value='ALL';await load();
  message(outcome.deduplicated?'An unread notification for this recipient and record already exists.':'In-app notification delivered.');
 }catch(error){handleError(error);}finally{button.disabled=false;}
});
el('login-form').addEventListener('submit',async event=>{
 event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;
 try{const login=await request('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:el('email').value,password:el('password').value})});if(ui.beginTwoFactor(login))return;await load();}
 catch(error){handleError(error);}finally{el('password').value='';button.disabled=false;}
});
el('logout').addEventListener('click',async()=>{reset();try{await request('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});message('Signed out.');}catch(error){handleError(error);}});
load();

ui.startLiveUpdates(()=>load(true),()=>!document.getElementById('identity-panel').hidden&&!document.getElementById('inbox-panel').hidden);
