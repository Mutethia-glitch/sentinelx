const fs=require('node:fs');
const path=require('node:path');
const ASSETS=new Map([
  ['/ui/sentinelx-ui.js',{file:'sentinelx-ui.js',type:'text/javascript; charset=utf-8'}],
  ['/ui/sentinelx-theme.css',{file:'sentinelx-theme.css',type:'text/css; charset=utf-8'}],
]);
function frontendShared(req,res){
  const asset=ASSETS.get(req.url);
  if(!asset)return false;
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Cross-Origin-Resource-Policy','same-origin');
  res.setHeader('Referrer-Policy','no-referrer');
  if(req.method!=='GET'){res.statusCode=405;res.setHeader('Allow','GET');res.end();return true;}
  res.setHeader('Content-Type',asset.type);
  try{res.end(fs.readFileSync(path.join(__dirname,'../../frontend/shared',asset.file)));}
  catch{res.statusCode=503;res.end('Frontend asset unavailable.');}
  return true;
}
module.exports={frontendShared};
