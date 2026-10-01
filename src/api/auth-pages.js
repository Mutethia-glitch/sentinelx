const fs=require('node:fs');
const path=require('node:path');
const FILES=new Map([
 ['/verify',['verify/index.html','text/html; charset=utf-8']],
 ['/verify/',['verify/index.html','text/html; charset=utf-8']],
 ['/verify/verify.js',['verify/verify.js','text/javascript; charset=utf-8']],
 ['/activate',['activate/index.html','text/html; charset=utf-8']],
 ['/activate/',['activate/index.html','text/html; charset=utf-8']],
 ['/activate/activate.js',['activate/activate.js','text/javascript; charset=utf-8']],
]);
function authPages(req,res){
 const file=FILES.get(req.url);if(!file)return false;
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
 if(req.method!=='GET'){res.statusCode=405;res.setHeader('Allow','GET');res.end();return true;}
 res.setHeader('Content-Type',file[1]);
 try{res.end(fs.readFileSync(path.join(__dirname,'../../frontend',file[0])));}catch{res.statusCode=503;res.end('Authentication page unavailable.');}
 return true;
}
module.exports={authPages};
