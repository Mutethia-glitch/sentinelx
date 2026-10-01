const assert=require('node:assert/strict');
async function check(origin,page){
 let url;try{url=new URL(origin);}catch{throw new Error('Set a valid HTTPS deployment origin.');}
 if(url.origin!==origin||url.protocol!=='https:')throw new Error('Deployment smoke origins must be exact HTTPS origins.');
 let response=await fetch(origin+'/healthz',{redirect:'manual',cache:'no-store'});assert.equal(response.status,200,origin+' health');assert.deepEqual(await response.json(),{status:'ok'});
 const hsts=response.headers.get('strict-transport-security');assert.ok(hsts&&/max-age=/i.test(hsts),origin+' must emit HSTS at the HTTPS edge');
 response=await fetch(origin+page,{redirect:'manual',cache:'no-store'});assert.equal(response.status,200,origin+page);
 assert.match(response.headers.get('content-security-policy')||'',/frame-ancestors 'none'/);
}
async function main(){
 const platform=process.env.DEPLOYMENT_PLATFORM_ORIGIN,tenant=process.env.DEPLOYMENT_TENANT_ORIGIN;
 if(!platform||!tenant)throw new Error('Set DEPLOYMENT_PLATFORM_ORIGIN and DEPLOYMENT_TENANT_ORIGIN.');
 await check(platform,'/signup');await check(tenant,'/access');
 console.log('Online HTTPS onboarding and isolated tenant health/pages passed deployment smoke checks.');
}
if(require.main===module)main().catch(error=>{console.error('Online deployment smoke failed: '+error.message);process.exitCode=1;});
module.exports={main};
