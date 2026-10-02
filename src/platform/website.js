'use strict';
const {isIP}=require('node:net');
const {AuthError}=require('../auth/errors');
const HOST=/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
function websiteOrigin(value,optional=true){
 if(optional&&(value===undefined||value===null||value===''))return null;
 if(typeof value!=='string'||value.length>300||value.trim()!==value)throw new AuthError(400,'Enter a valid HTTPS website origin.');
 let u;try{u=new URL(value);}catch{throw new AuthError(400,'Enter a valid HTTPS website origin.');}
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash||u.pathname!=='/'||
  !HOST.test(u.hostname)||u.hostname.length>253||isIP(u.hostname)||
  /\.(?:local|localhost|invalid|internal|test|example)$/.test(u.hostname)||u.hostname==='localhost'||
  (value!==u.origin&&value!==u.origin+'/'))
  throw new AuthError(400,'Enter a valid HTTPS website origin.');
 return u.origin;
}
module.exports={websiteOrigin};
