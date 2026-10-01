'use strict';
const by=id=>document.getElementById(id);
let registrationId=null,resendAfter=0,busy=false;
async function request(path,body){
  let response,result;
  try{
    response=await fetch(path,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    result=await response.json();
  }catch{throw new Error('Could not reach company registration. Check your connection and try again.');}
  if(!response.ok){const error=new Error(result?.error||'Company registration is temporarily unavailable.');error.status=response.status;throw error;}
  return result;
}
function msg(text,error=false){by('message').textContent=error?'Error: '+text:text;by('message').classList.toggle('error',error);}
function controls(){
  const seconds=Math.max(0,Math.ceil((resendAfter-Date.now())/1000));
  by('resend').disabled=busy||!registrationId||seconds>0;
  by('resend-timer').textContent=seconds?'Available in '+seconds+'s':'';
  by('verify-form').querySelector('button[type="submit"]').disabled=busy;
}
function cooldown(){resendAfter=Date.now()+60000;controls();}
setInterval(controls,1000);controls();
by('signup-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  const button=event.currentTarget.querySelector('button');busy=true;button.disabled=true;msg('Creating registration…');
  try{
    const result=await request('/api/company-signup',{companyName:by('company-name').value,adminName:by('admin-name').value,adminEmail:by('admin-email').value,password:by('password').value});
    registrationId=result.registrationId;by('signup-form').hidden=true;by('verify-form').hidden=false;
    cooldown();by('code').focus();msg('A six-digit verification code was sent to the Administrator email.');
  }catch(error){msg(error.message,true);}
  finally{by('password').value='';busy=false;button.disabled=false;controls();}
});
by('verify-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!registrationId||busy)return;busy=true;controls();msg('Verifying and creating your company environment…');
  try{
    const result=await request('/api/company-signup/verify',{registrationId,code:by('code').value});
    by('code').value='';by('verify-form').hidden=true;by('complete').hidden=false;
    by('company-result').textContent=result.tenant.name+' is ready.';by('tenant-link').href=result.tenant.origin;
    registrationId=null;msg('Your company environment is ready. Open SentinelX to sign in.');
  }catch(error){if(error.status===400)by('code').value='';msg(error.message,true);}
  finally{busy=false;controls();}
});
by('resend').addEventListener('click',async()=>{
  if(!registrationId||busy||Date.now()<resendAfter)return;busy=true;controls();
  try{await request('/api/company-signup/resend',{registrationId});cooldown();by('code').value='';msg('A new six-digit code was sent.');}
  catch(error){if(error.status===429)cooldown();msg(error.message,true);}
  finally{busy=false;controls();}
});
