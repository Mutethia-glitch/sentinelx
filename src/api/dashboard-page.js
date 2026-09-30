const fs=require('node:fs'),path=require('node:path');
const FILES={
  '/dashboard':['index.html','text/html; charset=utf-8'],
  '/dashboard/':['index.html','text/html; charset=utf-8'],
  '/dashboard/dashboard.js':['dashboard.js','text/javascript; charset=utf-8'],
  '/dashboard/dashboard.css':['dashboard.css','text/css; charset=utf-8'],
};
function dashboardPage(req,res){
  const file=FILES[req.url];if(!file)return false;
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
  res.setHeader('Referrer-Policy','no-referrer');
  if(req.method!=='GET'){res.statusCode=405;res.setHeader('Allow','GET');res.end();return true;}
  res.setHeader('Content-Type',file[1]);
  try{res.end(fs.readFileSync(path.join(__dirname,'../../frontend/dashboard',file[0])));}
  catch{res.statusCode=503;res.end('Dashboard page unavailable.');}
  return true;
}
module.exports={dashboardPage};
