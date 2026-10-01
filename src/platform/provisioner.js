const {AuthError}=require('../auth/errors');
function provisionerConfig(env=process.env){
  const url=env.TENANT_PROVISIONER_URL||'',token=env.TENANT_PROVISIONER_TOKEN||'';
  let parsed;try{parsed=new URL(url);}catch{throw new Error('Set TENANT_PROVISIONER_URL.');}
  if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.hash)throw new Error('TENANT_PROVISIONER_URL must be HTTPS.');
  if(token.length<24)throw new Error('Set TENANT_PROVISIONER_TOKEN.');
  return{url:parsed.href,token,timeoutMs:10000};
}
function tenantProvisioner(config=provisionerConfig()){
  return{async provision(payload){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),config.timeoutMs);
    try{
      const response=await fetch(config.url,{method:'POST',redirect:'manual',signal:controller.signal,
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+config.token},
        body:JSON.stringify({schemaVersion:1,type:'sentinelx.tenant.provision',tenant:payload})});
      if(response.status<200||response.status>=300)throw new Error('status');
      const body=await response.json();
      if(response.status===202&&body?.status==='PROVISIONING')return{status:'PROVISIONING',stage:typeof body.stage==='string'?body.stage:'PREPARING',retryAfterSeconds:10};
      if(!body||typeof body.origin!=='string')throw new Error('body');
      return{origin:body.origin};
    }catch{throw new AuthError(503,'Company provisioning is temporarily unavailable.');}
    finally{clearTimeout(timer);}
  }};
}
module.exports={provisionerConfig,tenantProvisioner};
