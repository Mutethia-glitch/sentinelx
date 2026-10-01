const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {platformConfig}=require('./config');
const {platformPool,platformRepository}=require('./repository');
const {platformService}=require('./service');
const {provisionerConfig,tenantProvisioner}=require('./provisioner');
const {emailConfig,emailDelivery}=require('../email/delivery');
const {apiSecurityBoundary,clientAddress}=require('../api/security');
const {readJson}=require('../api/auth-handler');
const {loginLimiter}=require('../auth/rate-limit');
const {AuthError}=require('../auth/errors');

const FILES=new Map([
  ['/',['signup/index.html','text/html; charset=utf-8']],
  ['/signup',['signup/index.html','text/html; charset=utf-8']],
  ['/signup/',['signup/index.html','text/html; charset=utf-8']],
  ['/signup/signup.js',['signup/signup.js','text/javascript; charset=utf-8']],
  ['/ui/sentinelx-theme.css',['shared/sentinelx-theme.css','text/css; charset=utf-8']],
]);
function createPlatformServer(service,config,{limiter=loginLimiter(),security=null}={}){
  const boundary=security||apiSecurityBoundary({address:req=>clientAddress(req,config.trustedProxyIps||[])});
  return http.createServer({maxHeaderSize:16384},async(req,res)=>{
    if(req.url==='/healthz'){
      res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
      if(req.method!=='GET'){res.statusCode=405;res.setHeader('Allow','GET');return res.end(JSON.stringify({error:'Method not allowed.'}));}
      res.statusCode=200;return res.end(JSON.stringify({status:'ok'}));
    }
    if(boundary(req,res))return;
    const asset=FILES.get(req.url.split('?',1)[0]);
    if(asset){
      res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
      res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
      if(req.method!=='GET'){res.statusCode=405;res.setHeader('Allow','GET');return res.end();}
      res.setHeader('Content-Type',asset[1]);
      try{return res.end(fs.readFileSync(path.join(__dirname,'../../frontend',asset[0])));}catch{res.statusCode=503;return res.end('Signup page unavailable.');}
    }
    const routes=new Set(['/api/company-signup','/api/company-signup/verify','/api/company-signup/resend']);
    if(!routes.has(req.url)){res.statusCode=404;res.setHeader('Content-Type','application/json; charset=utf-8');return res.end(JSON.stringify({error:'Not found.'}));}
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Type','application/json; charset=utf-8');
    const send=(status,body)=>{res.statusCode=status;res.end(JSON.stringify(body));};
    try{
      if(req.method!=='POST'){res.setHeader('Allow','POST');return send(405,{error:'Method not allowed.'});}
      if(req.headers.origin!==config.origin){req.resume();throw new AuthError(403,'Request origin rejected.');}
      const client=req.sentinelxClientAddress||req.socket.remoteAddress||'unknown';limiter.ip(client);
      const body=await readJson(req);
      if(req.url==='/api/company-signup'){
        if(body&&typeof body.adminEmail==='string')limiter.account(body.adminEmail.trim().toLowerCase());
        const result=await service.signup(body);return send(201,result);
      }
      if(req.url==='/api/company-signup/verify'){const result=await service.verify(body);return send(result.status==='PROVISIONING'?202:200,result);}
      return send(200,await service.resend(body));
    }catch(error){
      const expected=error instanceof AuthError,status=expected?error.status:503;
      if(status===429)res.setHeader('Retry-After','60');
      return send(status,{error:expected?error.message:'Company onboarding temporarily unavailable.'});
    }
  });
}
async function main(){
  let pool;
  try{
    const config=platformConfig(),mailer=emailDelivery(emailConfig()),provisioner=tenantProvisioner(provisionerConfig());
    pool=platformPool(config);await pool.query('SELECT id FROM tenants LIMIT 0');
    const server=createPlatformServer(platformService(platformRepository(pool),config,mailer,provisioner),config);
    server.requestTimeout=15000;server.headersTimeout=10000;server.timeout=20000;server.keepAliveTimeout=5000;
    server.on('error',()=>{console.error('SentinelX onboarding server could not start.');process.exitCode=1;pool.end();});
    server.listen(config.port,config.bindHost,()=>console.log(`SentinelX onboarding service listening on configured port ${config.port}.`));
    for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(()=>pool.end()));
  }catch{console.error('SentinelX onboarding server could not start. Check production configuration and platform database access.');if(pool)await pool.end();process.exitCode=1;}
}
if(require.main===module)main();
module.exports={createPlatformServer};
