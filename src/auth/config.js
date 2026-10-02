const {isIP}=require('node:net');
const {otpSecret}=require('./otp');

function configFromEnv(env=process.env){
  const production=env.NODE_ENV==='production';
  const port=Number(env.PORT||3000);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid PORT.');
  const originValue=env.APP_ORIGIN||(production?'':`http://localhost:${port}`);
  let url;try{url=new URL(originValue);}catch{throw new Error('Set a valid APP_ORIGIN.');}
  if(url.origin!==originValue||!['http:','https:'].includes(url.protocol)||
      (production&&url.protocol!=='https:')||
      (!production&&url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))){
    throw new Error('APP_ORIGIN must be an exact HTTPS origin or a local development HTTP origin.');
  }
  const bindHost=env.BIND_HOST||(production?'0.0.0.0':'127.0.0.1');
  if(!['0.0.0.0','127.0.0.1','::','::1'].includes(bindHost)&&!isIP(bindHost))throw new Error('Invalid BIND_HOST.');
  const proxyRaw=env.TRUSTED_PROXY_IPS||'';
  const trustedProxyIps=proxyRaw?proxyRaw.split(',').map(value=>value.trim()).filter(Boolean):[];
  if(trustedProxyIps.length>16||trustedProxyIps.some(value=>!isIP(value)))throw new Error('TRUSTED_PROXY_IPS must contain valid comma-separated IP addresses.');
  if(env.AUTH_EMAIL_2FA!==undefined&&!['0','1'].includes(env.AUTH_EMAIL_2FA))throw new Error('AUTH_EMAIL_2FA must be 0 or 1.');
  if(env.SENTINELX_SELF_MONITOR!==undefined&&!['0','1'].includes(env.SENTINELX_SELF_MONITOR))throw new Error('SENTINELX_SELF_MONITOR must be 0 or 1.');
  const selfMonitorEnabled=env.SENTINELX_SELF_MONITOR==='1';
  const requireEmail2fa=production||env.AUTH_EMAIL_2FA==='1';
  const secret=requireEmail2fa?otpSecret(env.AUTH_OTP_SECRET):null;
  const tenantFields=[env.TENANT_ID,env.TENANT_NAME,env.TENANT_SLUG];
  const hasTenant=tenantFields.some(Boolean);
  if((production||hasTenant)&&tenantFields.some(value=>typeof value!=='string'||!value.trim()))throw new Error('Set TENANT_ID, TENANT_NAME and TENANT_SLUG.');
  const tenant=hasTenant?{
    id:env.TENANT_ID.trim(),
    name:env.TENANT_NAME.trim(),
    slug:env.TENANT_SLUG.trim(),
  }:null;
  if(tenant){
    if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(tenant.id)||
       tenant.name.length>120||
       !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(tenant.slug))throw new Error('Invalid tenant identity configuration.');
  }
  return{
    port,bindHost,origin:url.origin,secureCookie:url.protocol==='https:',
    cookieName:url.protocol==='https:'?'__Host-sentinelx_session':'sentinelx_session',
    challengeCookieName:url.protocol==='https:'?'__Host-sentinelx_2fa':'sentinelx_2fa',
    sessionSeconds:8*60*60,idleSeconds:30*60,
    requireEmail2fa,selfMonitorEnabled,otpSecret:secret,otpSeconds:10*60,otpMaxAttempts:5,otpResendSeconds:60,
    trustedProxyIps:Object.freeze([...trustedProxyIps]),tenant,
  };
}
module.exports={configFromEnv};
