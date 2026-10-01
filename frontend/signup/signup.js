'use strict';
const by=id=>document.getElementById(id);let registrationId=null;
async function request(path,body){const response=await fetch(path,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await response.json();if(!response.ok){const e=new Error(result?.error||'Request failed.');e.status=response.status;throw e;}return result;}
function msg(text,error=false){by('message').textContent=error?'Error: '+text:text;by('message').classList.toggle('error',error);}
by('signup-form').addEventListener('submit',async event=>{event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;msg('Creating registration…');try{
  const result=await request('/api/company-signup',{companyName:by('company-name').value,adminName:by('admin-name').value,adminEmail:by('admin-email').value,password:by('password').value});
  registrationId=result.registrationId;by('password').value='';by('signup-form').hidden=true;by('verify-form').hidden=false;by('code').focus();msg('A six-digit verification code was sent to the Administrator email.');
}catch(error){by('password').value='';msg(error.message,true);}finally{button.disabled=false;}});
by('verify-form').addEventListener('submit',async event=>{event.preventDefault();if(!registrationId)return;const button=event.currentTarget.querySelector('button[type="submit"]');button.disabled=true;msg('Verifying and provisioning your isolated environment…');try{
 const result=await request('/api/company-signup/verify',{registrationId,code:by('code').value});by('code').value='';by('verify-form').hidden=true;by('complete').hidden=false;
 by('company-result').textContent=result.tenant.name+' is active at '+result.tenant.origin;by('tenant-link').href=result.tenant.origin;msg('Company environment provisioned.');
}catch(error){by('code').value='';msg(error.message,true);}finally{button.disabled=false;}});
by('resend').addEventListener('click',async()=>{if(!registrationId)return;by('resend').disabled=true;try{await request('/api/company-signup/resend',{registrationId});msg('A new six-digit code was sent.');}catch(error){msg(error.message,true);}finally{setTimeout(()=>{by('resend').disabled=false;},60000);}});
