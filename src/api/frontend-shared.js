const fs=require('node:fs');
const path=require('node:path');
const SCRIPT='/ui/sentinelx-ui.js';
function frontendShared(req,res){
  if(req.url!==SCRIPT)return false;
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Cross-Origin-Resource-Policy','same-origin');
  res.setHeader('Referrer-Policy','no-referrer');
  if(req.method!=='GET'){res.statusCode=405;res.setHeader('Allow','GET');res.end();return true;}
  res.setHeader('Content-Type','text/javascript; charset=utf-8');
  try{res.end(fs.readFileSync(path.join(__dirname,'../../frontend/shared/sentinelx-ui.js')));}
  catch{res.statusCode=503;res.end('Frontend helper unavailable.');}
  return true;
}
module.exports={frontendShared};
