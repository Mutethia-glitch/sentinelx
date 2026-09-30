const {AuthError}=require('../auth/errors');
const {cookieToken,sessionCookie}=require('./auth-handler');
const {reportCsv}=require('../reports/model');
function reportHandler(service,config){return async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const sendJson=(status,body)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(body));};
 try{
  const url=new URL(req.url,'http://localhost'),security=url.pathname==='/api/reports/security',incident=/^\/api\/reports\/incidents\/([0-9a-f-]+)$/i.exec(url.pathname);
  if(!security&&!incident){req.resume();return sendJson(404,{error:'Not found.'});}
  if(req.method!=='GET'){req.resume();res.setHeader('Allow','GET');return sendJson(405,{error:'Method not allowed.'});}
  const token=cookieToken(req.headers.cookie,config.cookieName);
  const result=security?await service.security(token,url.searchParams):await service.incident(token,incident[1],url.searchParams);
  if(result.format==='csv'){
   res.statusCode=200;res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="sentinelx-report.csv"');return res.end(reportCsv(result.report));
  }
  return sendJson(200,{report:result.report});
 }catch(error){req.resume();const expected=error instanceof AuthError,status=expected?error.status:503;if(status===401)res.setHeader('Set-Cookie',sessionCookie('',config,true));return sendJson(status,{error:expected?error.message:'Reporting temporarily unavailable.'});}
};}
module.exports={reportHandler};
