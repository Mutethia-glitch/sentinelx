const {isIP}=require('node:net');
const DEFAULT_WINDOW_MS=60*1000;
const DEFAULT_REQUEST_LIMIT=600;
const DEFAULT_MUTATION_LIMIT=120;
const DEFAULT_MAX_KEYS=10000;
const MAX_REQUEST_TARGET_BYTES=4096;
const MUTATIONS=new Set(['POST','PUT','PATCH','DELETE']);

class ApiSecurityError extends Error{
  constructor(status,message,retryAfter=null){super(message);this.name='ApiSecurityError';this.status=status;this.retryAfter=retryAfter;}
}
function normalizedAddress(value){
  if(typeof value!=='string'||!value)return null;
  const trimmed=value.trim();
  const mapped=/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(trimmed);
  const candidate=mapped?mapped[1]:trimmed;
  return isIP(candidate)?candidate:null;
}
function clientAddress(req,trustedProxyIps=[]){
  const remote=normalizedAddress(req.socket?.remoteAddress)||'unknown';
  if(!trustedProxyIps.includes(remote))return remote;
  const forwarded=req.headers['x-forwarded-for'];
  if(typeof forwarded!=='string'||forwarded.includes(','))return remote;
  return normalizedAddress(forwarded)||remote;
}
function apiRateLimiter({now=Date.now,windowMs=DEFAULT_WINDOW_MS,requestLimit=DEFAULT_REQUEST_LIMIT,
  mutationLimit=DEFAULT_MUTATION_LIMIT,maxKeys=DEFAULT_MAX_KEYS}={}){
  if(![windowMs,requestLimit,mutationLimit,maxKeys].every(Number.isInteger)||
      windowMs<1000||requestLimit<1||mutationLimit<1||mutationLimit>requestLimit||maxKeys<1)throw new Error('Invalid API rate-limit configuration.');
  const buckets=new Map();let nextSweep=0;
  function take(key,limit){
    const time=now();
    if(time>=nextSweep){for(const [name,bucket] of buckets)if(bucket.expires<=time)buckets.delete(name);nextSweep=time+Math.min(windowMs,60000);}
    let bucket=buckets.get(key);
    if(!bucket||bucket.expires<=time){
      if(!bucket&&buckets.size>=maxKeys)throw new ApiSecurityError(429,'Too many API requests. Try again later.',Math.ceil(windowMs/1000));
      bucket={count:0,expires:time+windowMs};buckets.set(key,bucket);
    }
    bucket.count+=1;
    if(bucket.count>limit)throw new ApiSecurityError(429,'Too many API requests. Try again later.',Math.ceil((bucket.expires-time)/1000));
  }
  return{check(address,method){const client=typeof address==='string'&&address?address:'unknown';take('all:'+client,requestLimit);if(MUTATIONS.has(method))take('mutation:'+client,mutationLimit);}};
}
function apiSecurityBoundary({limiter=apiRateLimiter(),address=req=>req.socket?.remoteAddress}={}){
  return(req,res)=>{
    const raw=req.url;
    const api=typeof raw==='string'&&(raw==='/api'||raw.startsWith('/api/')||raw.startsWith('/api\\'));
    if(!api)return false;
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cross-Origin-Resource-Policy','same-origin');
    try{
      if(Buffer.byteLength(raw)>MAX_REQUEST_TARGET_BYTES||!raw.startsWith('/')||raw.includes('#')||raw.includes('\\'))throw new ApiSecurityError(414,'Request target rejected.');
      const parsed=new URL(raw,'http://sentinelx.local');
      if(parsed.origin!=='http://sentinelx.local'||!(parsed.pathname==='/api'||parsed.pathname.startsWith('/api/')))throw new ApiSecurityError(400,'Invalid API request.');
      const length=req.headers['content-length'];
      const hasBody=(length!==undefined&&length!=='0')||req.headers['transfer-encoding']!==undefined;
      if((req.method==='GET'||req.method==='HEAD')&&hasBody)throw new ApiSecurityError(400,'Request body not allowed.');
      const resolved=address(req);req.sentinelxClientAddress=typeof resolved==='string'&&resolved?resolved:'unknown';
      limiter.check(req.sentinelxClientAddress,req.method);return false;
    }catch(error){
      req.resume();const expected=error instanceof ApiSecurityError,status=expected?error.status:400;
      if(expected&&error.retryAfter)res.setHeader('Retry-After',String(Math.max(1,error.retryAfter)));
      res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');
      res.end(JSON.stringify({error:expected?error.message:'Invalid API request.'}));return true;
    }
  };
}
module.exports={ApiSecurityError,apiRateLimiter,apiSecurityBoundary,clientAddress,normalizedAddress,MAX_REQUEST_TARGET_BYTES};
