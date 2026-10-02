const fs=require('node:fs'),path=require('node:path');
const FILES={
 '/rules':['index.html','text/html; charset=utf-8'],
 '/rules/':['index.html','text/html; charset=utf-8'],
 '/rules/rules.js':['rules.js','text/javascript; charset=utf-8'],
 '/rules/rules.css':['rules.css','text/css; charset=utf-8']
};
function rulePage(req,res){
 if(!Object.hasOwn(FILES,req.url))return false;
 const asset=FILES[req.url];
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
 res.setHeader('Referrer-Policy','no-referrer');
 if(req.method!=='GET'){res.statusCode=405;res.setHeader('Allow','GET');res.end();return true;}
 res.setHeader('Content-Type',asset[1]);
 try{res.end(fs.readFileSync(path.join(__dirname,'../../frontend/rules',asset[0])));}
 catch{res.statusCode=503;res.end('Rules page unavailable.');}
 return true;
}
module.exports={rulePage};
