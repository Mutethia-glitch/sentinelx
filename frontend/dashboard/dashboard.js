'use strict';
const ui=window.SentinelXUi;
const el=id=>document.getElementById(id);
let generation=0;
const nf=new Intl.NumberFormat(undefined,{maximumFractionDigits:1});
function message(value,error=false){el('message').textContent=error?'Error: '+value:value;el('message').classList.toggle('error',error);}
function reset(){ui.clearAccess();
 generation++;
 for(const id of ['total-cards','recent-cards','alert-severity','incident-severity','alert-status','incident-status',
  'alert-threats','incident-threats','response-outcomes','response-types','trend-rows'])el(id).replaceChildren();
 el('login-panel').hidden=false;el('identity-panel').hidden=true;el('dashboard-panel').hidden=true;el('as-of').textContent='';
}
async function request(path,options={}){
 const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options});
 const body=response.status===204?null:await response.json();
 if(!response.ok){const error=new Error(body?.error||'Request failed.');error.status=response.status;throw error;}
 return body;
}
function handleError(error){if(error.status===401||error.status===403)reset();if(error.status===401)return message('Sign in to continue.');message(ui.safeError(error),true);}
function number(value){return value===null||value===undefined?'No incident data':nf.format(value);}
function card(container,label,value){
 const dl=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');
 dl.className='card';dt.textContent=label;dd.textContent=number(value);dl.append(dt,dd);container.append(dl);
}
function displayLabel(value){return value.charAt(0)+value.slice(1).toLowerCase().replaceAll('_',' ');}
function barRows(container,items){
 container.replaceChildren();
 if(!items.length){const p=document.createElement('p');p.className='empty';p.textContent='No records in this category.';container.append(p);return;}
 const total=Math.max(1,items.reduce((sum,item)=>sum+item.count,0));
 const wrapper=document.createElement('div');wrapper.className='bars';
 for(const item of items){
  const row=document.createElement('div'),label=document.createElement('span'),value=document.createElement('span'),
   track=document.createElement('span'),fill=document.createElement('span');
  row.className='bar-row';
  if(['LOW','MEDIUM','HIGH','CRITICAL','NEW','ACKNOWLEDGED','INVESTIGATING','CONTAINED','RESOLVED','DISMISSED'].includes(item.label))row.classList.add(item.label.toLowerCase());
  label.className='bar-label';label.textContent=displayLabel(item.label);
  value.className='bar-value';value.textContent=nf.format(item.count);
  track.className='bar-track';track.setAttribute('aria-hidden','true');
  fill.className='bar-fill';fill.style.width=Math.max(0,Math.min(100,item.count/total*100))+'%';track.append(fill);
  row.append(label,value,track);wrapper.append(row);
 }
 container.append(wrapper);
}
function categoryRows(container,items){
 container.replaceChildren();
 if(!items.length){const p=document.createElement('p');p.className='empty';p.textContent='No records in this category.';container.append(p);return;}
 const list=document.createElement('ul');list.className='sx-category-list';
 for(const item of items){
  const row=document.createElement('li'),label=document.createElement('span'),value=document.createElement('span');
  label.className='sx-category-label';label.textContent=displayLabel(item.code);label.title=item.code;
  value.className='sx-category-count';value.textContent=nf.format(item.count);
  row.append(label,value);list.append(row);
 }
 container.append(list);
}
function responseOutcomes(totals){
 const container=el('response-outcomes');container.replaceChildren();
 for(const [label,value,success] of [['Successful containment',totals.successfulContainments,true],['Reported unsuccessful',totals.reportedFailedActions,false]]){
  const group=document.createElement('div'),name=document.createElement('dt'),count=document.createElement('dd');
  group.className='sx-outcome-card'+(success?' sx-outcome-success':'');
  name.textContent=label;count.textContent=number(value);group.append(name,count);container.append(group);
 }
}
function mapRows(object){return Object.entries(object).map(([label,count])=>({label,count}));}
function severityRows(object){return ['CRITICAL','HIGH','MEDIUM','LOW'].map(label=>({label,count:object[label]}));}
function trendCell(row,count,max){
 const td=document.createElement('td'),value=document.createElement('span'),track=document.createElement('div'),fill=document.createElement('div');
 value.className='trend-count';value.textContent=nf.format(count);
 track.className='mini-track';track.setAttribute('aria-hidden','true');fill.className='mini-fill';
 fill.style.width=Math.max(0,Math.min(100,100*count/Math.max(1,max)))+'%';track.append(fill);td.append(value,track);row.append(td);
}
function render(d){
 el('as-of').textContent='Snapshot captured: '+d.asOf+' · All-time counts unless a period is stated.';
 const t=d.totals,r=d.last24Hours;
 const all=[
  ['Security events',t.eventsTotal],['Alerts',t.alertsTotal],['Incidents',t.incidentsTotal],
  ['Active incidents',t.activeIncidents],['New alerts',t.newAlerts],
  ['Recorded responses',t.responseActions],['Reported successful',t.reportedSuccessfulActions],
  ['Reported unsuccessful',t.reportedFailedActions],['Successful containment records',t.successfulContainments],
  ['Mean incident risk / 100',t.averageIncidentRisk],
 ];
 for(const [label,value] of all)card(el('total-cards'),label,value);
 for(const [label,value] of [['Events received',r.eventsReceived],['Alerts created',r.alertsCreated],
  ['Incidents created',r.incidentsCreated],['Responses recorded',r.responsesRecorded]])card(el('recent-cards'),label,value);
 barRows(el('alert-severity'),severityRows(d.severity.alerts));
 barRows(el('incident-severity'),severityRows(d.severity.incidents));
 barRows(el('alert-status'),mapRows(d.status.alerts));
 barRows(el('incident-status'),mapRows(d.status.incidents));
 categoryRows(el('alert-threats'),d.threats.alerts);
 categoryRows(el('incident-threats'),d.threats.incidents);
 responseOutcomes(t);
 barRows(el('response-types'),d.responses.map(x=>({label:x.action,count:x.total})));
 const keys=['events','alerts','incidents','responses'];
 const max=Object.fromEntries(keys.map(key=>[key,Math.max(1,...d.trend.map(day=>day[key]))]));
 for(const day of d.trend){
  const tr=document.createElement('tr'),date=document.createElement('th');date.scope='row';date.textContent=day.day;tr.append(date);
  for(const key of keys)trendCell(tr,day[key],max[key]);
  el('trend-rows').append(tr);
 }
 el('dashboard-panel').hidden=false;
}
async function load(){
 const current=++generation;el('refresh').disabled=true;ui.loading('Loading dashboard…');
 try{
  const access=await request('/api/access/me');if(current!==generation)return;ui.applyAccess(access);
  if(!access.permissions.includes('dashboard.read')){el('login-panel').hidden=true;el('identity-panel').hidden=false;el('dashboard-panel').hidden=true;el('identity').textContent=access.user.displayName+' · '+access.roles.join(', ');message('Your account does not have permission to view the dashboard.',true);return;}
  el('identity').textContent=access.user.displayName+' · '+access.roles.join(', ');
  const result=await request('/api/dashboard');if(current!==generation)return;
  for(const id of ['total-cards','recent-cards','alert-severity','incident-severity','alert-status','incident-status',
   'alert-threats','incident-threats','response-outcomes','response-types','trend-rows'])el(id).replaceChildren();
  render(result.dashboard);el('login-panel').hidden=true;el('identity-panel').hidden=false;
  message('Dashboard refreshed from PostgreSQL.');
 }catch(error){if(current===generation)handleError(error);}
 finally{if(current===generation)el('refresh').disabled=false;}
}
el('login-form').addEventListener('submit',async event=>{
 event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;
 try{const login=await request('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({email:el('email').value,password:el('password').value})});if(ui.beginTwoFactor(login))return;await load();}
 catch(error){handleError(error);}finally{el('password').value='';button.disabled=false;}
});
el('refresh').addEventListener('click',load);
el('logout').addEventListener('click',async()=>{
 reset();try{await request('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});message('Signed out.');}
 catch(error){handleError(error);}
});
load();
