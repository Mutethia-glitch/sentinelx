class ProviderError extends Error{
 constructor(provider,status=0){super(provider+' provisioning request failed.');this.status=status;this.provider=provider;}
}
function providerClients(config,fetcher=fetch){
 async function request(provider,path,{method='GET',body}={}){
  const base=provider==='Neon'?'https://console.neon.tech/api/v2':'https://api.render.com/v1';
  const key=provider==='Neon'?config.neonKey:config.renderKey;
  try{
   const response=await fetcher(base+path,{method,redirect:'error',signal:AbortSignal.timeout(7000),headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',Accept:'application/json'},...(body?{body:JSON.stringify(body)}:{})});
   if(!response.ok)throw new ProviderError(provider,response.status);
   if(response.status===204)return {};
   return await response.json();
  }catch(error){if(error instanceof ProviderError)throw error;throw new ProviderError(provider);}
 }
 const id=value=>encodeURIComponent(value);
 return{
  async createProject(tenant){
   const body=await request('Neon','/projects',{method:'POST',body:{project:{name:'sentinelx-'+tenant.tenantId,org_id:config.orgId,region_id:'aws-us-west-2',pg_version:16,branch:{name:'production',database_name:'neondb',role_name:'neondb_owner'},default_endpoint_settings:{autoscaling_limit_min_cu:0.25,autoscaling_limit_max_cu:0.25}}}});
   if(!body.project?.id||!body.branch?.id)throw new ProviderError('Neon');
   return{projectId:body.project.id,branchId:body.branch.id};
  },
  async databaseUrl(job){
   const body=await request('Neon','/projects/'+id(job.projectId)+'/connection_uri?'+new URLSearchParams({branch_id:job.branchId,database_name:'neondb',role_name:'neondb_owner',pooled:'false'}));
   let url;try{url=new URL(body.uri);}catch{throw new ProviderError('Neon');}
   if(url.protocol!=='postgresql:'||!url.hostname.endsWith('.neon.tech')||!url.username||!url.password)throw new ProviderError('Neon');
   url.search='?sslmode=require';return url.href;
  },
  async createService(tenant,env){
   const body=await request('Render','/services',{method:'POST',body:{type:'web_service',name:'sentinelx-'+tenant.tenantId,ownerId:config.ownerId,repo:config.repo,branch:'main',autoDeployTrigger:'off',envVars:Object.entries(env).map(([key,value])=>({key,value})),serviceDetails:{runtime:'docker',plan:'free',region:'oregon',healthCheckPath:'/healthz',envSpecificDetails:{dockerfilePath:'./Dockerfile',dockerContext:'.',dockerCommand:'node src/api/server.js'}}}});
   const service=body.service||body;if(!service.id||!/^https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.onrender\.com$/.test(service.serviceDetails?.url||''))throw new ProviderError('Render');
   return{serviceId:service.id,renderUrl:service.serviceDetails.url};
  },
  async configureOrigin(job){await request('Render','/services/'+id(job.serviceId)+'/env-vars/APP_ORIGIN',{method:'PUT',body:{value:job.renderUrl}});},
  async deploy(job){return request('Render','/services/'+id(job.serviceId)+'/deploys',{method:'POST',body:{clearCache:'do_not_clear'}});},
  async ready(origin,tenantId){
   try{const response=await fetcher(origin+'/healthz',{redirect:'error',signal:AbortSignal.timeout(5000)});if(!response.ok)return false;const body=await response.json();return body.status==='ok'&&body.tenantId===tenantId&&body.origin===origin;}catch{return false;}
  },
 };
}
module.exports={providerClients,ProviderError};
