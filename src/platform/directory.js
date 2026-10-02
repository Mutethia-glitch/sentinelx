const {AuthError}=require('../auth/errors');
const ROUTE_FAILURE='Company unavailable. Check the company name or sign-in code.';
const slugPattern=/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
function companyKey(body){
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).join(',')!=='company'||
    typeof body.company!=='string')throw new AuthError(400,'Enter your company name or sign-in code.');
  const value=body.company.trim().toLowerCase();
  if(value.length<2||value.length>120||/[\u0000-\u001f\u007f]/.test(value))throw new AuthError(400,'Enter your company name or sign-in code.');
  return value;
}
function safeOrigin(value,slug,config){
  if(typeof value!=='string'||typeof slug!=='string'||!slugPattern.test(slug))return null;
  let url;try{url=new URL(value);}catch{return null;}
  if(url.protocol!=='https:'||url.origin!==value||url.username||url.password||url.search||url.hash||url.pathname!=='/'||url.port)return null;
  const render=/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.onrender\.com$/.test(url.hostname);
  const custom=Boolean(config.baseDomain)&&url.hostname===slug+'.'+config.baseDomain;
  return render||custom?url.origin:null;
}
function legacyRoutesFromEnv(env,baseDomain=''){
  const raw=env.COMPANY_LOGIN_LEGACY_ROUTES||'';
  if(!raw)return Object.freeze([]);
  if(raw.length>4096)throw new Error('COMPANY_LOGIN_LEGACY_ROUTES is too large.');
  let routes;try{routes=JSON.parse(raw);}catch{throw new Error('Invalid COMPANY_LOGIN_LEGACY_ROUTES.');}
  if(!Array.isArray(routes)||routes.length>8)throw new Error('Invalid COMPANY_LOGIN_LEGACY_ROUTES.');
  const seen=new Set();
  return Object.freeze(routes.map(route=>{
    if(!route||typeof route!=='object'||Array.isArray(route)||
      Object.keys(route).sort().join(',')!=='companyName,origin,slug'||
      typeof route.companyName!=='string'||route.companyName.trim().length<2||
      route.companyName.length>120||/[\u0000-\u001f\u007f]/.test(route.companyName)||
      typeof route.slug!=='string'||!slugPattern.test(route.slug)||
      !safeOrigin(route.origin,route.slug,{baseDomain}))throw new Error('Invalid COMPANY_LOGIN_LEGACY_ROUTES.');
    if(seen.has(route.slug))throw new Error('Duplicate legacy company sign-in code.');
    seen.add(route.slug);
    return Object.freeze({company_name:route.companyName.trim(),slug:route.slug,origin:route.origin});
  }));
}
async function resolveCompany(repository,config,body){
  const key=companyKey(body);
  const stored=await repository.findActiveCompanies(key);
  const candidates=[...stored,...(config.legacyRoutes||[])].filter(route=>{
    const code=route.slug===key,name=route.company_name.toLowerCase()===key;
    return(code||name)&&safeOrigin(route.origin,route.slug,config);
  });
  // Slug is immutable and unique within onboarding; legacy collisions fail closed.
  const byCode=candidates.filter(route=>route.slug===key);
  const choices=byCode.length?byCode:candidates;
  const unique=new Map(choices.map(route=>[route.origin,route]));
  if(unique.size!==1)throw new AuthError(404,ROUTE_FAILURE);
  const result=[...unique.values()][0];
  return{companyName:result.company_name,origin:result.origin};
}
module.exports={companyKey,safeOrigin,legacyRoutesFromEnv,resolveCompany,ROUTE_FAILURE};
