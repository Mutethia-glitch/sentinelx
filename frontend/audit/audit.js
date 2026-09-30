'use strict';
const ui=window.SentinelXUi;
const el=id=>document.getElementById(id);
let page=1,filters=new URLSearchParams(),generation=0;

function message(value,error=false){
  el('message').textContent=error?'Error: '+value:value;
  el('message').classList.toggle('error',error);
  if(error)el('message').scrollIntoView({block:'center'});
}
async function request(path,options={}){
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options});
  const body=response.status===204?null:await response.json();
  if(!response.ok){const error=new Error(body?.error||'Request failed.');error.status=response.status;throw error;}
  return body;
}
function reset(){
  generation++;ui.clearAccess();
  el('login-panel').hidden=false;el('identity-panel').hidden=true;el('audit-panel').hidden=true;
  el('identity').textContent='';el('rows').replaceChildren();el('page').textContent='';
  el('previous').disabled=true;el('next').disabled=true;
}
function handleError(error){
  if(error.status===401||error.status===403)reset();
  if(error.status===401)return message('Sign in to continue.');
  message(ui.safeError(error),true);
}
function iso(value){return value?new Date(value).toISOString():null;}
async function load(){
  const current=++generation;ui.loading('Loading audit trail…');
  try{
    const access=await request('/api/access/me');if(current!==generation)return;
    ui.applyAccess(access);
    el('login-panel').hidden=true;el('identity-panel').hidden=false;
    el('identity').textContent=access.user.displayName+' · '+(access.roles.join(', ')||'No role assigned');
    if(!access.permissions.includes('audit.read')){el('audit-panel').hidden=true;message('Your account does not have permission to view the audit trail.',true);return;}
    const query=new URLSearchParams(filters);query.set('page',String(page));
    const data=await request('/api/audit?'+query);if(current!==generation)return;
    el('rows').replaceChildren();
    for(const item of data.entries){
      const article=document.createElement('article');article.className='entry';
      for(const text of [item.occurredAt+' · '+item.action,'Actor: '+(item.actor?.displayName||item.actorContext),'Target: '+item.target.type+' / '+(item.target.id||'none')]){
        const p=document.createElement('p');p.textContent=text;article.append(p);
      }
      const pre=document.createElement('pre');pre.className='context';pre.textContent=JSON.stringify(item.context,null,2);article.append(pre);el('rows').append(article);
    }
    if(!data.entries.length){const p=document.createElement('p');p.textContent='No audit entries match these filters.';el('rows').append(p);}
    el('page').textContent='Page '+data.page;el('previous').disabled=data.page<=1;el('next').disabled=!data.hasMore;
    el('audit-panel').hidden=false;message('Audit trail loaded.');
  }catch(error){if(current===generation)handleError(error);}
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
el('next').addEventListener('click',()=>{if(page<2000){page++;load();}});
el('login-form').addEventListener('submit',async event=>{
  event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;ui.loading('Signing in…');
  try{
    await request('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:el('email').value,password:el('password').value})});
    await load();
  }catch(error){handleError(error);}
  finally{el('password').value='';button.disabled=false;}
});
el('logout').addEventListener('click',async()=>{
  reset();
  try{await request('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});message('Signed out.');}
  catch(error){handleError(error);}
});
load();
