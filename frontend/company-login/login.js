'use strict';
const form=document.getElementById('company-login-form');
const status=document.getElementById('message');
form.addEventListener('submit',async event=>{
  event.preventDefault();const button=form.querySelector('button');
  button.disabled=true;status.textContent='Looking up your company…';
  try{
    const company=document.getElementById('company').value;
    const response=await fetch('/api/company-login/resolve',{method:'POST',credentials:'same-origin',cache:'no-store',
      headers:{'Content-Type':'application/json'},body:JSON.stringify({company})});
    const result=await response.json();
    if(!response.ok)throw new Error(result?.error||'Company lookup unavailable. Try again later.');
    const destination=new URL(result.origin);
    if(destination.protocol!=='https:'||destination.origin!==result.origin||destination.username||destination.password)
      throw new Error('Company address could not be verified.');
    status.textContent='Opening '+result.companyName+' sign-in…';
    window.location.assign(destination.origin+'/access');
  }catch(error){status.textContent='Error: '+error.message;button.disabled=false;}
});
