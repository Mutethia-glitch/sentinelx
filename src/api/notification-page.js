const fs=require('node:fs'),path=require('node:path');
const FILES={'/notifications':['index.html','text/html; charset=utf-8'],
  '/notifications/':['index.html','text/html; charset=utf-8'],
  '/notifications/notifications.js':['notifications.js','text/javascript; charset=utf-8'],
  '/notifications/notifications.css':['notifications.css','text/css; charset=utf-8']};
function notificationPage(req,res){
  const file=FILES[req.url];if(!file)return false;
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
  res.setHeader('Referrer-Policy','no-referrer');
  if(req.method!=='GET'){res.statusCode=405;res.setHeader('Allow','GET');res.end();return true;}
  res.setHeader('Content-Type',file[1]);
  try{res.end(fs.readFileSync(path.join(__dirname,'../../frontend/notifications',file[0])));}
  catch{res.statusCode=503;res.end('Notifications page unavailable.');}
  return true;
}
module.exports={notificationPage};
