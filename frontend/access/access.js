'use strict';
const ui=window.SentinelXUi;
const element=id=>document.getElementById(id);
let generation=0;
const message=(text,isError=false)=>{
  const notice=element('message');notice.classList.toggle('error',isError);
  notice.textContent=isError?`Error: ${text}`:text;if(isError)notice.scrollIntoView({block:'center'});
};
const request=ui.request;
const siteEndpoint=()=>window.location.origin+'/api/connectors/site-events';
function showSiteSetup(){
 const endpoint=siteEndpoint();
 element('site-setup-endpoint').value=endpoint;
 element('site-env-template').textContent=`SENTINELX_SITE_CONNECTOR_URL=${endpoint}
SENTINELX_SITE_CONNECTOR_KEY=<issued-private-key>`;
}
element('copy-site-endpoint').addEventListener('click',async()=>{
 const value=element('site-setup-endpoint').value;
 try {
  if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');
  await navigator.clipboard.writeText(value);
  message('Company connector URL copied. Configure it on your website backend.');
 }catch{element('site-setup-endpoint').focus();element('site-setup-endpoint').select();
  message('Select and copy the connector URL shown above.');}
});
showSiteSetup();
function reset(){generation++;ui.clearAccess();element('login-panel').hidden=false;element('identity-panel').hidden=true;
  element('users-panel').hidden=true;element('access-overview').hidden=true;element('users').replaceChildren();
  element('identity').textContent='';element('assigned-roles').textContent='';element('tenant-name').textContent='';
  element('sites-panel').hidden=true;element('sites-list').replaceChildren();element('site-secret-panel').hidden=true;element('site-secret').textContent='';
}
function handleError(error){if(error.status===401||error.status===403)reset();message(error.status?error.message:'Unable to reach SentinelX. Try again.',true);}
function userCard(user,roles){
  const form=document.createElement('form');form.className='user-card';
  const heading=document.createElement('h3');heading.textContent=`${user.displayName} (${user.email})${user.active?'':' — inactive'}`;form.append(heading);
  const fieldset=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='Approved roles';fieldset.append(legend);
  const boxes=roles.map(role=>{const label=document.createElement('label'),box=document.createElement('input');box.type='checkbox';box.checked=user.roles.includes(role.name);box.value=role.name;label.append(box,document.createTextNode(role.name));fieldset.append(label);return box;});
  const reasonLabel=document.createElement('label');reasonLabel.textContent='Reason for changing access';
  const reason=document.createElement('input');reason.required=true;reason.maxLength=500;reasonLabel.append(reason);
  const save=document.createElement('button');save.type='submit';save.textContent='Save roles';
  const active=document.createElement('button');active.type='button';active.textContent=user.active?'Disable user':'Enable user';
  const actions=document.createElement('div');actions.className='sx-user-actions';actions.append(save,active);
  form.append(fieldset,reasonLabel,actions);
  form.addEventListener('submit',async event=>{event.preventDefault();save.disabled=true;try{
    await request(`/api/access/users/${encodeURIComponent(user.id)}/roles`,{method:'PUT',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({roles:boxes.filter(box=>box.checked).map(box=>box.value),reason:reason.value})});
    await refresh();message('Roles saved. Changed users must sign in again.');
  }catch(error){handleError(error);}finally{save.disabled=false;}});
  active.addEventListener('click',async()=>{if(!reason.value.trim())return message('Enter a reason before changing user status.',true);
    active.disabled=true;try{await request(`/api/access/users/${encodeURIComponent(user.id)}/active`,{method:'PATCH',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({active:!user.active,reason:reason.value})});await refresh();message(user.active?'User disabled and sessions revoked.':'User enabled.');}
    catch(error){handleError(error);}finally{active.disabled=false;}});
  return form;
}
async function refresh(background=false){background=background===true;if(!background)ui.clearDrafts();
  const current=++generation;if(!background)ui.loading('Loading access…');if(!background){element('users-panel').hidden=true;element('users').replaceChildren();}
  const access=await request('/api/access/me');if(current!==generation||(background&&!ui.liveCanApply()))return false;ui.applyAccess(access);element('login-panel').hidden=true;element('identity-panel').hidden=false;element('access-overview').hidden=false;
  element('identity').textContent=`${access.user.displayName} · ${access.user.email}`;
  element('tenant-name').textContent=access.tenant?`Company: ${access.tenant.name}`:'Local development tenant';
  element('assigned-roles').textContent=access.roles.length?`Roles: ${access.roles.join(', ')}`:'No role assigned. Ask an Administrator to configure your access.';
  if(access.permissions.includes('users.read')&&access.permissions.includes('users.roles.manage')){
    const [users,roles,sites]=await Promise.all([request('/api/access/users'),request('/api/access/roles'),request('/api/access/sites')]);
    if(current!==generation||(background&&!ui.liveCanApply()))return false;element('users').replaceChildren(...users.users.map(user=>userCard(user,roles.roles)));element('users-panel').hidden=false;renderSites(sites);element('sites-panel').hidden=false;
  }else{element('users-panel').hidden=true;element('users').replaceChildren();element('sites-panel').hidden=true;element('sites-list').replaceChildren();}
  return true;
}
function renderSites(data){
 element('requested-site').textContent=data.requestedWebsite
   ?'Requested at signup: '+data.requestedWebsite+' (awaiting Administrator connection).'
   :'No website was requested at signup; you can register one here.';
 if(data.requestedWebsite&&!element('site-origin').value)element('site-origin').value=data.requestedWebsite;
 const list=element('sites-list');list.replaceChildren();
 for(const site of data.sites||[]){
  const card=document.createElement('section');card.className='user-card';
  const title=document.createElement('h3');title.textContent=site.origin+' — '+site.status;card.append(title);
  const info=document.createElement('p');info.className='hint';
  info.textContent=site.lastEventAt?'Last authenticated event: '+site.lastEventAt:'No authenticated evidence received yet. Domain ownership is not independently verified.';
  card.append(info);
  if(site.status!=='REVOKED'){
   const form=document.createElement('form');
   const label=document.createElement('label');label.textContent='Reason for revocation';
   const reason=document.createElement('input');reason.required=true;reason.maxLength=500;label.append(reason);
   const button=document.createElement('button');button.type='submit';button.textContent='Revoke connection';
   form.append(label,button);
   form.addEventListener('submit',async event=>{event.preventDefault();button.disabled=true;try{
    await request('/api/access/sites/'+encodeURIComponent(site.id)+'/revoke',{
     method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason:reason.value})});
    element('site-secret-panel').hidden=true;element('site-secret').textContent='';
    const state=await request('/api/access/sites');renderSites(state);message('Website connector revoked.');
   }catch(error){handleError(error);}finally{button.disabled=false;}});
   card.append(form);
  }
  list.append(card);
 }
}
element('site-form').addEventListener('submit',async event=>{
 event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;
 element('site-secret-panel').hidden=true;element('site-secret').textContent='';
 try{
  const issued=await request('/api/access/sites',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({origin:element('site-origin').value})});
  element('site-secret').textContent=issued.token;
  element('site-endpoint').textContent='Your server-side endpoint: '+siteEndpoint();
  element('site-secret-panel').hidden=false;
  const current=await request('/api/access/sites');renderSites(current);
  message('One-time website connector key issued. Store it in your site backend only.');
 }catch(error){handleError(error);}finally{button.disabled=false;}
});
element('invite-form').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');button.disabled=true;
  try{const invitation=await request('/api/access/invitations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    email:element('invite-email').value,displayName:element('invite-name').value,role:element('invite-role').value,reason:element('invite-reason').value})});
    form.reset();message(`Invitation sent to ${invitation.invitation.email}. The account remains pending until email verification.`);
  }catch(error){handleError(error);}finally{button.disabled=false;}});
element('login-form').addEventListener('submit',async event=>{event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;
  try{const login=await request('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:element('email').value,password:element('password').value})});
    if(ui.beginTwoFactor(login,'/access'))return;await refresh();message('Signed in.');
  }catch(error){handleError(error);}finally{element('password').value='';button.disabled=false;}});
element('logout').addEventListener('click',async()=>{try{await request('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});reset();message('Signed out.');}catch(error){handleError(error);}});
element('refresh').addEventListener('click',()=>refresh().catch(handleError));
refresh().catch(error=>{reset();if(error.status!==401)handleError(error);});

ui.startLiveUpdates(async()=>{try{return await refresh(true);}catch(error){if(error.status===401||error.status===403)handleError(error);throw error;}},()=>!document.getElementById('identity-panel').hidden&&!document.getElementById('access-overview').hidden);
