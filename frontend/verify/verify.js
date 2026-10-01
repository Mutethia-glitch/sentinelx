'use strict';
const code=document.getElementById('code'),message=document.getElementById('message'),form=document.getElementById('verify-form'),resend=document.getElementById('resend');
function destination(){const value=new URL(location.href).searchParams.get('continue')||'/dashboard';return /^\/(?:access|dashboard|events|alerts|incidents|notifications|audit)(?:\/)?$/.test(value)?value:'/dashboard';}
async function request(path,body){const response=await fetch(path,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await response.json();if(!response.ok){const e=new Error(result?.error||'Request failed.');e.status=response.status;throw e;}return result;}
form.addEventListener('submit',async event=>{event.preventDefault();const button=form.querySelector('button[type="submit"]');button.disabled=true;message.textContent='Verifying…';try{await request('/api/auth/verify-2fa',{code:code.value});location.replace(destination());}catch(error){message.textContent='Error: '+error.message;code.value='';code.focus();}finally{button.disabled=false;}});
const timer=document.getElementById('resend-timer');
let resendAfter=0,sending=false;
try{resendAfter=Number(sessionStorage.getItem('sentinelx-resend-after'))||0;}catch{}
function renderTimer(){
 const seconds=Math.max(0,Math.ceil((resendAfter-Date.now())/1000));
 resend.disabled=sending||seconds>0;timer.textContent=seconds?'Try again in '+seconds+'s':'';
}
function cooldown(seconds=60){
 resendAfter=Date.now()+seconds*1000;
 try{sessionStorage.setItem('sentinelx-resend-after',String(resendAfter));}catch{}
 renderTimer();
}
renderTimer();setInterval(renderTimer,1000);
resend.addEventListener('click',async()=>{
 sending=true;resend.disabled=true;message.textContent='Sending a new code…';
 try{await request('/api/auth/resend-2fa',{});message.textContent='A new six-digit code was sent.';cooldown();}
 catch(error){message.textContent='Error: '+error.message;if(error.status===429)cooldown();else renderTimer();}
 finally{sending=false;renderTimer();}
});
code.focus();
