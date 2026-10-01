const {AuthError}=require('../auth/errors');

function emailConfig(env=process.env){
  const production=env.NODE_ENV==='production';
  const url=env.EMAIL_DELIVERY_URL||'';
  const token=env.EMAIL_DELIVERY_TOKEN||'';
  const from=env.EMAIL_FROM||'';
  if(!url){
    if(production)throw new Error('Set EMAIL_DELIVERY_URL for production email verification.');
    return{enabled:false,url:null,token:null,from:'sentinelx@example.invalid',timeoutMs:3000};
  }
  let parsed;try{parsed=new URL(url);}catch{throw new Error('Invalid EMAIL_DELIVERY_URL.');}
  if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.hash)throw new Error('EMAIL_DELIVERY_URL must be HTTPS without embedded credentials.');
  if(!token||token.length<16)throw new Error('Set EMAIL_DELIVERY_TOKEN.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from))throw new Error('Set a valid EMAIL_FROM.');
  return{enabled:true,url:parsed.href,token,from,timeoutMs:3000};
}
function emailDelivery(config=emailConfig()){
  return{
    async sendCode({to,code,purpose,companyName}){
      if(!config.enabled)throw new AuthError(503,'Email verification is not configured.');
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)||!/^[0-9]{6}$/.test(code))throw new TypeError('Invalid email delivery input.');
      const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),config.timeoutMs);
      const subject=purpose==='COMPANY_SIGNUP'?'Verify your SentinelX company':'Your SentinelX verification code';
      const text='Your SentinelX verification code is '+code+'. It expires in 10 minutes. If you did not request this code, ignore this email.';
      try{
        const response=await fetch(config.url,{method:'POST',redirect:'manual',signal:controller.signal,
          headers:{'Content-Type':'application/json','Authorization':'Bearer '+config.token},
          body:JSON.stringify({schemaVersion:1,type:'sentinelx.email_verification',to,from:config.from,subject,text,
            purpose,companyName:companyName||null})});
        if(response.status<200||response.status>=300)throw new Error('delivery');
      }catch{throw new AuthError(503,'Verification email could not be sent. Try again later.');}
      finally{clearTimeout(timeout);}
    },
  };
}
module.exports={emailConfig,emailDelivery};
