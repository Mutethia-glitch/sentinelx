const http=require('node:http');
const {platformPool}=require('../platform/repository');
const {readJson}=require('../api/auth-handler');
const {AuthError}=require('../auth/errors');
const {provisioningConfig}=require('./config');
const {providerClients}=require('./providers');
const {provisioningRepository}=require('./repository');
const {initializeDatabase}=require('./bootstrap');
const {authorized,provisioningService}=require('./service');
function createProvisioningServer(service,config){
 return http.createServer({maxHeaderSize:16384},async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.setHeader('X-Content-Type-Options','nosniff');
  const send=(status,body)=>{res.statusCode=status;res.end(JSON.stringify(body));};
  if(req.url==='/healthz'&&req.method==='GET')return send(200,{status:'ok'});
  if(req.url!=='/provision')return send(404,{error:'Not found.'});
  if(req.method!=='POST'){res.setHeader('Allow','POST');return send(405,{error:'Method not allowed.'});}
  if(!authorized(req.headers.authorization,config.token)){req.resume();return send(401,{error:'Unauthorized.'});}
  try{const result=await service.provision(await readJson(req));if(result.status==='PROVISIONING')res.setHeader('Retry-After','60');send(result.status==='PROVISIONING'?202:200,result);}
  catch(error){send(error instanceof AuthError?error.status:503,{error:error instanceof AuthError?error.message:'Provisioning temporarily unavailable.'});}
 });
}
async function main(){
 let pool;
 try{
  const config=provisioningConfig();pool=platformPool(config);await pool.query('SELECT tenant_id FROM tenant_provisioning LIMIT 0');
  const server=createProvisioningServer(provisioningService(provisioningRepository(pool),providerClients(config),initializeDatabase,config),config);
  server.requestTimeout=15000;server.headersTimeout=10000;
  server.on('error',()=>{console.error('Provisioner could not start.');process.exitCode=1;pool.end();});
  server.listen(config.port,'0.0.0.0',()=>console.log('SentinelX provisioner listening on configured port.'));
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(()=>pool.end()));
 }catch{console.error('Provisioner could not start. Check configuration and platform migrations.');if(pool)await pool.end();process.exitCode=1;}
}
if(require.main===module)main();
module.exports={createProvisioningServer};
