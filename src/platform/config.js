const {isIP}=require('node:net');
const {otpSecret}=require('../auth/otp');
function platformConfig(env=process.env){
  const production=env.NODE_ENV==='production',port=Number(env.PLATFORM_PORT||3100);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid PLATFORM_PORT.');
  const originValue=env.PLATFORM_ORIGIN||(production?'':`http://localhost:${port}`);
  let origin;try{origin=new URL(originValue);}catch{throw new Error('Set a valid PLATFORM_ORIGIN.');}
  if(origin.origin!==originValue||(production&&origin.protocol!=='https:')||!['http:','https:'].includes(origin.protocol))throw new Error('PLATFORM_ORIGIN must be an exact origin.');
  const bindHost=env.PLATFORM_BIND_HOST||(production?'0.0.0.0':'127.0.0.1');
  if(!['0.0.0.0','127.0.0.1','::','::1'].includes(bindHost)&&!isIP(bindHost))throw new Error('Invalid PLATFORM_BIND_HOST.');
  if(!env.PLATFORM_DATABASE_URL)throw new Error('Set PLATFORM_DATABASE_URL.');
  const baseDomain=(env.TENANT_BASE_DOMAIN||'').trim().toLowerCase();
  if(production&&!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(baseDomain))throw new Error('Set TENANT_BASE_DOMAIN.');
  const proxyRaw=env.TRUSTED_PROXY_IPS||'',trustedProxyIps=proxyRaw?proxyRaw.split(',').map(v=>v.trim()).filter(Boolean):[];
  if(trustedProxyIps.length>16||trustedProxyIps.some(v=>!isIP(v)))throw new Error('Invalid TRUSTED_PROXY_IPS.');
  return{production,port,bindHost,origin:origin.origin,databaseUrl:env.PLATFORM_DATABASE_URL,
    otpSecret:otpSecret(env.PLATFORM_OTP_SECRET),otpSeconds:600,otpMaxAttempts:5,otpResendSeconds:60,
    baseDomain,trustedProxyIps:Object.freeze(trustedProxyIps)};
}
module.exports={platformConfig};
