'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SentinelXUi=Object.freeze(api);
  if(typeof document!=='undefined')api.init(document,typeof location!=='undefined'?location.pathname:'');
})(typeof globalThis!=='undefined'?globalThis:this,()=> {
  const SVG='http://www.w3.org/2000/svg';
  let pendingRequests=0,liveVersion=0,liveCycle=null,lastActivity=Date.now();
  const dirtyForms=new Set();
  function clearDrafts(){dirtyForms.clear();}
  async function request(path,options={}){
    pendingRequests++;
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,signal:controller.signal});
      const body=response.status===204?null:await response.json();
      if(!response.ok){
        const error=new Error(body?.error||'Request failed.');error.status=response.status;error.requestPath=path;
        const retry=Number(response.headers.get('Retry-After'));
        if(Number.isFinite(retry)&&retry>0)error.retryAfter=Math.min(retry*1000,300000);
        throw error;
      }
      return body;
    }catch(error){
      if(globalThis.document?.getElementById('identity-panel')?.hidden){
        const panel=globalThis.document.getElementById('login-panel');if(panel)panel.hidden=false;
      }
      throw error;
    }finally{clearTimeout(timeout);pendingRequests--;}
  }
  function livePauseReason(doc=globalThis.document){
    if(doc.hidden)return 'hidden tab';
    if(globalThis.navigator?.onLine===false)return 'offline';
    if(Date.now()-lastActivity>=60000)return 'inactive tab';
    for(const form of dirtyForms){if(!form.isConnected)dirtyForms.delete(form);else if(!form.closest('[hidden]'))return 'unsaved edits';}
    if(doc.activeElement?.matches('input,textarea,select,[contenteditable="true"]'))return 'editing';
    return '';
  }
  function liveCanApply(){return !!liveCycle&&liveCycle.version===liveVersion&&!livePauseReason()&&!globalThis.document.getElementById('identity-panel')?.hidden;}
  function startLiveUpdates(refresh,isReady,doc=globalThis.document){
    const badge=doc.createElement('span');badge.className='sx-live-status';badge.textContent='Auto-refresh every 5s';
    doc.querySelector('.sx-operational')?.append(badge);
    let stopped=false,running=false,failures=0,nextAttempt=0,lastSuccess=null;
    const status=(text,state='paused')=>{badge.textContent=text;badge.dataset.state=state;};
    const activity=event=>{if(!event.isTrusted)return;lastActivity=Date.now();liveVersion++;};
    const edited=event=>{if(event.target.form)dirtyForms.add(event.target.form);};
    const resetDraft=event=>dirtyForms.delete(event.target);
    for(const type of ['pointerdown','keydown','input','change','wheel'])doc.addEventListener(type,activity,true);
    doc.addEventListener('input',edited,true);doc.addEventListener('change',edited,true);doc.addEventListener('reset',resetDraft,true);
    const tick=async()=>{
      if(stopped||running)return;
      const clock=doc.querySelector('[data-sx-clock]');if(clock)clock.textContent=new Date().toISOString().slice(0,19).replace('T',' · ')+' UTC';
      if(!isReady()){status('Auto-refresh waiting for access');return;}
      const reason=livePauseReason(doc);
      if(reason){status('Auto-refresh paused · '+reason+(lastSuccess?' · Updated '+lastSuccess:''),reason==='offline'?'stale':'paused');return;}
      if(pendingRequests||Date.now()<nextAttempt)return;
      running=true;liveCycle={version:liveVersion};
      status('Refreshing'+(lastSuccess?' · Last updated '+lastSuccess:''),'refreshing');
      try{
        const applied=await refresh();
        if(applied===true&&liveCanApply()){
          failures=0;lastSuccess=new Date().toISOString().slice(11,19)+' UTC';status('Auto-refresh · 5s · Updated '+lastSuccess,'live');
        }else status('Auto-refresh paused · '+(livePauseReason(doc)||'recent activity'));
      }catch(error){
        failures++;
        const delay=Math.max(error.retryAfter||0,Math.min(60000,5000*2**Math.min(failures,4)));
        nextAttempt=Date.now()+delay;
        status(error.status===401||error.status===403?'Access expired · Sign in again':'Updates delayed · Retrying'+(lastSuccess?' · Last updated '+lastSuccess:''),'stale');
      }finally{running=false;liveCycle=null;}
    };
    let timer=setInterval(tick,5000);
    const resume=()=>{liveVersion++;if(!doc.hidden)void tick();};
    doc.addEventListener('visibilitychange',resume);globalThis.addEventListener('online',resume);
    const stop=()=>{stopped=true;clearInterval(timer);liveVersion++;};
    globalThis.addEventListener('pagehide',stop);
    globalThis.addEventListener('pageshow',event=>{if(event.persisted&&stopped){stopped=false;timer=setInterval(tick,5000);resume();}});
    return {tick,stop};
  }
  const TONES=new Map([
    ['LOW','tone-low'],['MEDIUM','tone-medium'],['HIGH','tone-high'],['CRITICAL','tone-critical'],
    ['NEW','tone-new'],['ACKNOWLEDGED','tone-acknowledged'],['INVESTIGATING','tone-investigating'],
    ['CONTAINED','tone-contained'],['RESOLVED','tone-resolved'],['DISMISSED','tone-dismissed'],
  ]);
  const ICONS={
    shield:[['path',{d:'M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5c3.5 0 6-1.5 8-3 2 1.5 4.5 3 8 3v8Z'}]],
    'layout-dashboard':[['rect',{x:'3',y:'3',width:'7',height:'9',rx:'1'}],['rect',{x:'14',y:'3',width:'7',height:'5',rx:'1'}],['rect',{x:'14',y:'12',width:'7',height:'9',rx:'1'}],['rect',{x:'3',y:'16',width:'7',height:'5',rx:'1'}]],
    activity:[['path',{d:'M22 12h-4l-3 9L9 3l-3 9H2'}]],
    'shield-alert':[['path',{d:'M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5c3.5 0 6-1.5 8-3 2 1.5 4.5 3 8 3v8Z'}],['path',{d:'M12 8v4'}],['circle',{cx:'12',cy:'16',r:'.6',fill:'currentColor',stroke:'none'}]],
    siren:[['path',{d:'M7 18v-6a5 5 0 0 1 10 0v6'}],['path',{d:'M5 22h14'}],['path',{d:'M3 13H1'}],['path',{d:'m4.5 4.5 1.4 1.4'}],['path',{d:'M12 2v2'}],['path',{d:'m19.5 4.5-1.4 1.4'}],['path',{d:'M23 13h-2'}]],
    bell:[['path',{d:'M10.3 21a2 2 0 0 0 3.4 0'}],['path',{d:'M4 17h16a1 1 0 0 0 .7-1.7C19.4 14 18 12.5 18 8a6 6 0 0 0-12 0c0 4.5-1.4 6-2.7 7.3A1 1 0 0 0 4 17Z'}]],
    'file-clock':[['path',{d:'M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h7'}],['path',{d:'M14 2v6h6'}],['circle',{cx:'18',cy:'18',r:'4'}],['path',{d:'M18 16v2l1.5 1'}]],
    'user-cog':[['circle',{cx:'9',cy:'7',r:'4'}],['path',{d:'M2 21a7 7 0 0 1 10.5-6'}],['circle',{cx:'18',cy:'18',r:'3'}],['path',{d:'M18 13v2M18 21v2M13 18h2M21 18h2M14.5 14.5l1.4 1.4M20.1 20.1l1.4 1.4M21.5 14.5l-1.4 1.4M15.9 20.1l-1.4 1.4'}]],
    menu:[['path',{d:'M4 6h16M4 12h16M4 18h16'}]],
    'panel-left-close':[['rect',{x:'3',y:'3',width:'18',height:'18',rx:'2'}],['path',{d:'M9 3v18M16 9l-3 3 3 3'}]],
    'panel-left-open':[['rect',{x:'3',y:'3',width:'18',height:'18',rx:'2'}],['path',{d:'M9 3v18M13 9l3 3-3 3'}]],
    'refresh-cw':[['path',{d:'M20 11a8 8 0 1 0 2 5'}],['path',{d:'M20 4v7h-7'}]],
    signpost:[['path',{d:'M12 13v8'}],['path',{d:'M12 3v3'}],['path',{d:'M4 6h12l4 3-4 3H4l-2-3 2-3Z'}]],
    'log-out':[['path',{d:'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4'}],['path',{d:'m16 17 5-5-5-5'}],['path',{d:'M21 12H9'}]],
    eye:[['path',{d:'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z'}],['circle',{cx:'12',cy:'12',r:'3'}]],
    filter:[['path',{d:'M4 5h16l-6 7v5l-4 2v-7L4 5Z'}]],
    'list-filter':[['path',{d:'M3 6h18M6 12h12M10 18h4'}]],
    check:[['path',{d:'m5 12 4 4L19 6'}]],
    'check-circle':[['circle',{cx:'12',cy:'12',r:'9'}],['path',{d:'m8 12 3 3 5-6'}]],
    'x-circle':[['circle',{cx:'12',cy:'12',r:'9'}],['path',{d:'m9 9 6 6M15 9l-6 6'}]],
    'circle-dot':[['circle',{cx:'12',cy:'12',r:'9'}],['circle',{cx:'12',cy:'12',r:'2',fill:'currentColor',stroke:'none'}]],
    plus:[['path',{d:'M12 5v14M5 12h14'}]],
    send:[['path',{d:'m22 2-7 20-4-9-9-4 20-7Z'}],['path',{d:'M22 2 11 13'}]],
    search:[['circle',{cx:'11',cy:'11',r:'7'}],['path',{d:'m20 20-4-4'}]],
    'chevron-left':[['path',{d:'m15 18-6-6 6-6'}]],
    'chevron-right':[['path',{d:'m9 18 6-6-6-6'}]],
    'clock-3':[['circle',{cx:'12',cy:'12',r:'9'}],['path',{d:'M12 7v5H8'}]],
    'clipboard-check':[['rect',{x:'5',y:'4',width:'14',height:'18',rx:'2'}],['path',{d:'M9 4a3 3 0 0 1 6 0'}],['path',{d:'m9 14 2 2 4-4'}]],
    'shield-check':[['path',{d:'M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5c3.5 0 6-1.5 8-3 2 1.5 4.5 3 8 3v8Z'}],['path',{d:'m9 12 2 2 4-4'}]],
    gauge:[['path',{d:'M4 14a8 8 0 1 1 16 0'}],['path',{d:'M12 14l4-4'}],['path',{d:'M5 19h14'}]],
    'terminal-square':[['rect',{x:'3',y:'3',width:'18',height:'18',rx:'2'}],['path',{d:'m7 8 3 3-3 3M12 16h5'}]],
    users:[['path',{d:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2'}],['circle',{cx:'9',cy:'7',r:'4'}],['path',{d:'M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8'}]],
    network:[['rect',{x:'9',y:'2',width:'6',height:'5',rx:'1'}],['rect',{x:'2',y:'17',width:'6',height:'5',rx:'1'}],['rect',{x:'16',y:'17',width:'6',height:'5',rx:'1'}],['path',{d:'M12 7v5M5 17v-2h14v2'}]],
    'book-open-check':[['path',{d:'M2 4h6a4 4 0 0 1 4 4v12a4 4 0 0 0-4-4H2V4ZM22 4h-6a4 4 0 0 0-4 4v12a4 4 0 0 1 4-4h6V4Z'}],['path',{d:'m15 10 1.5 1.5L20 8'}]],
    'lock-keyhole':[['rect',{x:'5',y:'10',width:'14',height:'11',rx:'2'}],['path',{d:'M8 10V7a4 4 0 0 1 8 0v3'}],['circle',{cx:'12',cy:'15',r:'1'}]],
    'alert-triangle':[['path',{d:'M10.3 3.4 2.2 18a2 2 0 0 0 1.8 3h16a2 2 0 0 0 1.8-3L13.7 3.4a2 2 0 0 0-3.4 0Z'}],['path',{d:'M12 9v4'}],['circle',{cx:'12',cy:'17',r:'.6',fill:'currentColor',stroke:'none'}]],
    database:[['ellipse',{cx:'12',cy:'5',rx:'8',ry:'3'}],['path',{d:'M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5'}],['path',{d:'M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6'}]],
    'key-round':[['circle',{cx:'8',cy:'15',r:'5'}],['path',{d:'m12 11 8-8M17 6l3 3M15 8l2 2'}]],
    'file-clock':[['path',{d:'M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h7'}],['path',{d:'M14 2v6h6'}],['circle',{cx:'18',cy:'18',r:'4'}],['path',{d:'M18 16v2l1.5 1'}]]
  };
  function links(doc){
    return doc&&typeof doc.querySelectorAll==='function'?[...doc.querySelectorAll('nav a[data-permission]')]:[];
  }
  function clearAccess(doc=globalThis.document){liveVersion++;clearDrafts();for(const link of links(doc))link.hidden=true;}
  function applyAccess(access,doc=globalThis.document){
    const permissions=new Set(Array.isArray(access?.permissions)?access.permissions:[]);
    for(const link of links(doc))link.hidden=!permissions.has(link.dataset.permission);
  }
  function loading(text='Loading SentinelX…',doc=globalThis.document){
    const notice=doc&&typeof doc.getElementById==='function'?doc.getElementById('message'):null;
    if(!notice)return;
    notice.textContent=text;
    if(notice.classList&&typeof notice.classList.toggle==='function'){
      notice.classList.toggle('error',false);notice.classList.toggle('success',false);
    }
  }
  function safeError(error,fallback='Unable to reach SentinelX. Try again.'){
    return Number.isInteger(error?.status)&&typeof error.message==='string'&&error.message?error.message:fallback;
  }
  function beginTwoFactor(result,pathname=globalThis.location?.pathname||'/dashboard'){
    if(!result?.requiresTwoFactor)return false;
    const allowed=/^\/(?:access|dashboard|events|rules|alerts|incidents|notifications|audit)(?:\/)?$/.test(pathname)?pathname:'/dashboard';
    try{globalThis.sessionStorage.setItem('sentinelx-resend-after',String(Date.now()+60000));}catch{}
    globalThis.location?.assign('/verify?continue='+encodeURIComponent(allowed));return true;
  }
  function markCurrentPage(doc=globalThis.document,pathname=''){
    if(!doc||typeof doc.querySelectorAll!=='function')return;
    const normalized=pathname==='/'?'/dashboard':pathname.replace(/\/$/,'');
    for(const link of doc.querySelectorAll('nav a[href]')){
      const href=link.getAttribute('href');
      if(href===normalized)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
    }
  }
  function createIcon(name,doc=globalThis.document){
    if(!doc||typeof doc.createElementNS!=='function')return null;
    const nodes=ICONS[name]||ICONS['circle-dot'];
    const svg=doc.createElementNS(SVG,'svg');
    svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');
    svg.setAttribute('stroke-width','2');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');
    svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');svg.classList.add('sx-icon');
    for(const [tag,attrs] of nodes){
      const node=doc.createElementNS(SVG,tag);
      for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));
      svg.append(node);
    }
    return svg;
  }
  let shieldLogoId=0;
  function createShieldLogo(doc){
    const rotor=doc.createElement('span');rotor.className='sx-shield-rotor';rotor.setAttribute('aria-hidden','true');
    const outline='M0 1.25 L.92 .86 L.76 -.34 Q.58 -1.02 0 -1.42 Q-.58 -1.02 -.76 -.34 L-.92 .86 Z';
    const node=(tag,attrs)=>{const item=doc.createElementNS(SVG,tag);for(const [key,value]of Object.entries(attrs))item.setAttribute(key,value);return item;};
    for(let layer=0;layer<7;layer++){
      const svg=node('svg',{viewBox:'-1.15 -1.5 2.3 3.1',class:'sx-shield-layer','aria-hidden':'true',focusable:'false'});
      const face=node('g',{transform:'scale(1,-1)'});
      face.append(node('path',{d:outline,fill:'#1a7fae'}));
      if(layer===6){
        const id='sx-shield-face-'+(++shieldLogoId),defs=node('defs',{}),gradient=node('linearGradient',{id,x1:'0',y1:'0',x2:'1',y2:'1'});
        for(const [offset,color]of [['0%','#8ceaff'],['45%','#2fb3e6'],['100%','#1a7fae']])gradient.append(node('stop',{offset,'stop-color':color}));
        defs.append(gradient);svg.append(defs);
        face.append(node('path',{d:outline,fill:'url(#'+id+')',stroke:'#8ceaff','stroke-width':'.045',transform:'scale(.94)'}));
        face.append(node('path',{d:'M0 .16 L.2 -.08 L0 -.32 L-.2 -.08 Z',fill:'#8ceaff'}));
        face.append(node('path',{d:'M0 .16 L.2 -.08 L0 -.32 Z',fill:'#42badf'}));
      }
      svg.append(face);rotor.append(svg);
    }
    return rotor;
  }
  function applyIcon(element,name){
    if(!element||element.dataset.sxIconApplied==='1')return;
    if(element.matches?.('.sx-brand-mark,.sx-auth-intro-mark[data-icon="shield"]')){
      element.classList.add('sx-shield-logo');element.append(createShieldLogo(element.ownerDocument||globalThis.document));element.dataset.sxIconApplied='1';return;
    }
    const svg=createIcon(name,element.ownerDocument||globalThis.document);if(!svg)return;
    element.prepend(svg);element.dataset.sxIconApplied='1';
  }
  function actionIcon(text){
    const value=String(text||'').trim().toLowerCase();
    if(value.startsWith('inspect'))return 'eye';
    if(value.startsWith('previous'))return 'chevron-left';
    if(value.startsWith('next'))return 'chevron-right';
    if(value.startsWith('sign in'))return 'key-round';
    if(value.startsWith('sign out'))return 'log-out';
    if(value.startsWith('refresh'))return 'refresh-cw';
    if(value.startsWith('apply filter'))return 'filter';
    if(value.startsWith('clear filter'))return 'x-circle';
    if(value.startsWith('create incident'))return 'plus';
    if(value.startsWith('deliver'))return 'send';
    if(value.startsWith('mark as read'))return 'check';
    if(value.startsWith('record')||value.startsWith('update')||value.startsWith('save'))return 'check';
    return null;
  }
  function decorateIcons(root=globalThis.document){
    if(!root||typeof root.querySelectorAll!=='function')return;
    const staticItems=[
      ...(typeof root.matches==='function'&&root.matches('[data-icon]')?[root]:[]),
      ...root.querySelectorAll('[data-icon]')
    ];
    for(const item of staticItems)applyIcon(item,item.dataset.icon);
    const buttons=[
      ...(typeof root.matches==='function'&&root.matches('button')?[root]:[]),
      ...root.querySelectorAll('button')
    ];
    for(const button of buttons){
      if(button.dataset.sxIconApplied==='1')continue;
      const name=button.dataset.icon||actionIcon(button.textContent);if(name)applyIcon(button,name);
    }
  }
  function decorateMetricCards(root=globalThis.document){
    if(!root||typeof root.querySelectorAll!=='function')return;
    const mapping=[
      [/active incidents/i,'clock-3','tone-investigating'],
      [/new alerts/i,'bell','tone-new'],
      [/security events|events received/i,'activity','tone-info'],
      [/alerts/i,'shield-alert','tone-high'],
      [/incidents/i,'siren','tone-critical'],
      [/successful containment/i,'shield-check','tone-success'],
      [/reported successful/i,'shield-check','tone-success'],
      [/reported unsuccessful/i,'x-circle','tone-critical'],
      [/responses|response actions/i,'clipboard-check','tone-info'],
      [/risk/i,'gauge','tone-medium']
    ];
    const cards=[
      ...(typeof root.matches==='function'&&root.matches('.card')?[root]:[]),
      ...root.querySelectorAll('.card')
    ];
    for(const card of cards){
      if(card.querySelector('.sx-card-icon'))continue;
      const label=card.querySelector('dt')?.textContent||'';
      const match=mapping.find(([pattern])=>pattern.test(label));if(!match)continue;
      const holder=card.ownerDocument.createElement('span');holder.className='sx-card-icon';
      if(match[2])holder.classList.add(match[2]);
      const icon=createIcon(match[1],card.ownerDocument);if(icon)holder.append(icon);card.append(holder);
    }
  }
  function decorateSemanticValues(root=globalThis.document){
    if(!root||typeof root.querySelectorAll!=='function')return;
    const candidates=[
      ...(typeof root.matches==='function'&&root.matches('td,dd,.bar-label')?[root]:[]),
      ...root.querySelectorAll('td,dd,.bar-label'),
    ];
    for(const node of candidates){
      const value=String(node.textContent||'').trim();
      const tone=TONES.get(value.toUpperCase());

      if(node.matches('.bar-label')){
        for(const toneClass of TONES.values())node.classList.remove(toneClass);
        node.classList.remove('semantic-value');
        if(tone)node.classList.add('semantic-value',tone);
        continue;
      }

      for(const toneClass of TONES.values())node.classList.remove(toneClass);
      node.classList.remove('semantic-value');

      const existing=node.querySelector('[data-sx-semantic-value="1"]');
      if(!tone){
        if(existing&&existing.parentNode===node)node.textContent=value;
        continue;
      }

      if(existing&&existing.parentNode===node){
        existing.className='semantic-value '+tone;
        existing.textContent=value;
        continue;
      }

      const badge=node.ownerDocument.createElement('span');
      badge.dataset.sxSemanticValue='1';
      badge.className='semantic-value '+tone;
      badge.textContent=value;
      node.replaceChildren(badge);
    }
  }
  function selectIncidentTab(name,doc=globalThis.document){
    if(!doc||typeof doc.querySelectorAll!=='function')return;
    for(const button of doc.querySelectorAll('[data-sx-tab]')){
      const active=button.dataset.sxTab===name;button.setAttribute('aria-selected',String(active));
      button.tabIndex=active?0:-1;
    }
    for(const pane of doc.querySelectorAll('[data-sx-pane]'))pane.hidden=pane.dataset.sxPane!==name;
  }
  function setupChrome(doc=globalThis.document){
    const body=doc?.body;if(!body)return;
    const navToggle=doc.querySelector('[data-sx-nav-toggle]');
    const overlay=doc.querySelector('[data-sx-nav-overlay]');
    const collapse=doc.querySelector('[data-sx-sidebar-toggle]');
    const closeNav=()=>body.classList.remove('sx-nav-open');
    navToggle?.addEventListener('click',()=>body.classList.toggle('sx-nav-open'));
    overlay?.addEventListener('click',closeNav);
    for(const link of doc.querySelectorAll('.sx-nav a'))link.addEventListener('click',closeNav);
    collapse?.addEventListener('click',()=>{
      body.classList.toggle('sx-sidebar-collapsed');
      collapse.dataset.icon=body.classList.contains('sx-sidebar-collapsed')?'panel-left-open':'panel-left-close';
      const old=collapse.querySelector('svg');if(old)old.remove();delete collapse.dataset.sxIconApplied;applyIcon(collapse,collapse.dataset.icon);
    });
    for(const button of doc.querySelectorAll('[data-sx-refresh]'))button.addEventListener('click',()=>globalThis.location?.reload());
    for(const button of doc.querySelectorAll('[data-sx-tab]'))button.addEventListener('click',()=>selectIncidentTab(button.dataset.sxTab,doc));
    if(doc.querySelector('[data-sx-tab="evidence"]'))selectIncidentTab('evidence',doc);
    const clock=doc.querySelector('[data-sx-clock]');
    if(clock)clock.textContent=new Date().toISOString().slice(0,16).replace('T',' · ')+' UTC';
  }
  function observePresentation(doc=globalThis.document){
    decorateIcons(doc);decorateMetricCards(doc);decorateSemanticValues(doc);
    if(typeof MutationObserver==='undefined'||!doc?.body)return null;
    const observer=new MutationObserver(records=>{
      for(const record of records)for(const node of record.addedNodes){
        if(node&&node.nodeType===1){decorateIcons(node);decorateMetricCards(node);decorateSemanticValues(node);}
      }
    });
    observer.observe(doc.body,{childList:true,subtree:true});return observer;
  }
  function revealDetails(panel){
    if(!panel)return;
    const doc=panel.ownerDocument,view=doc.defaultView;
    panel.setAttribute('tabindex','-1');
    panel.focus({preventScroll:true});
    const header=doc.querySelector('.sx-topbar');
    const offset=(header?header.getBoundingClientRect().height:0)+16;
    const top=Math.max(0,view.scrollY+panel.getBoundingClientRect().top-offset);
    view.scrollTo({top,behavior:view.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  }
  function init(doc=globalThis.document,pathname=''){
    markCurrentPage(doc,pathname);setupChrome(doc);observePresentation(doc);
  }
  return {revealDetails,request,startLiveUpdates,liveCanApply,clearDrafts,clearAccess,applyAccess,loading,safeError,beginTwoFactor,markCurrentPage,createIcon,decorateIcons,decorateMetricCards,decorateSemanticValues,selectIncidentTab,init};
});
