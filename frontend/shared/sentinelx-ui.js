'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SentinelXUi=Object.freeze(api);
})(typeof globalThis!=='undefined'?globalThis:this,()=> {
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
  return {clearAccess,applyAccess,loading,safeError};
});
