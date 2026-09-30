'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SentinelXUi=Object.freeze(api);
  if(typeof document!=='undefined')api.init(document,typeof location!=='undefined'?location.pathname:'');
})(typeof globalThis!=='undefined'?globalThis:this,()=> {
  const TONES=new Map([
    ['LOW','tone-low'],['MEDIUM','tone-medium'],['HIGH','tone-high'],['CRITICAL','tone-critical'],
    ['NEW','tone-new'],['ACKNOWLEDGED','tone-acknowledged'],['INVESTIGATING','tone-investigating'],
    ['CONTAINED','tone-contained'],['RESOLVED','tone-resolved'],['DISMISSED','tone-dismissed'],
  ]);
  function links(doc){
    return doc&&typeof doc.querySelectorAll==='function'?[...doc.querySelectorAll('nav a[data-permission]')]:[];
  }
  function clearAccess(doc=globalThis.document){
    for(const link of links(doc))link.hidden=true;
  }
  function applyAccess(access,doc=globalThis.document){
    const permissions=new Set(Array.isArray(access?.permissions)?access.permissions:[]);
    for(const link of links(doc))link.hidden=!permissions.has(link.dataset.permission);
  }
  function loading(text='Loading SentinelX…',doc=globalThis.document){
    const notice=doc&&typeof doc.getElementById==='function'?doc.getElementById('message'):null;
    if(!notice)return;
    notice.textContent=text;
    if(notice.classList&&typeof notice.classList.toggle==='function'){
      notice.classList.toggle('error',false);
      notice.classList.toggle('success',false);
    }
  }
  function safeError(error,fallback='Unable to reach SentinelX. Try again.'){
    return Number.isInteger(error?.status)&&typeof error.message==='string'&&error.message?error.message:fallback;
  }
  function markCurrentPage(doc=globalThis.document,pathname=''){
    if(!doc||typeof doc.querySelectorAll!=='function')return;
    const normalized=pathname==='/'?'/dashboard':pathname.replace(/\/$/,'');
    for(const link of doc.querySelectorAll('nav a[href]')){
      const href=link.getAttribute('href');
      if(href===normalized)link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    }
  }
  function decorateSemanticValues(root=globalThis.document){
    if(!root||typeof root.querySelectorAll!=='function')return;
    const candidates=[
      ...(typeof root.matches==='function'&&root.matches('td,dd,.bar-label')?[root]:[]),
      ...root.querySelectorAll('td,dd,.bar-label'),
    ];
    for(const node of candidates){
      for(const tone of TONES.values())node.classList.remove(tone);
      node.classList.remove('semantic-value');
      const tone=TONES.get(String(node.textContent||'').trim().toUpperCase());
      if(tone)node.classList.add('semantic-value',tone);
    }
  }
  function observeSemantics(doc=globalThis.document){
    decorateSemanticValues(doc);
    if(typeof MutationObserver==='undefined'||!doc?.body)return null;
    const observer=new MutationObserver(records=>{
      for(const record of records)for(const node of record.addedNodes){
        if(node&&node.nodeType===1)decorateSemanticValues(node);
      }
    });
    observer.observe(doc.body,{childList:true,subtree:true});
    return observer;
  }
  function init(doc=globalThis.document,pathname=''){
    markCurrentPage(doc,pathname);
    observeSemantics(doc);
  }
  return {clearAccess,applyAccess,loading,safeError,markCurrentPage,decorateSemanticValues,observeSemantics,init};
});
