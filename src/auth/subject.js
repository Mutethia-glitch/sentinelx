'use strict';
const {createHmac}=require('node:crypto');

// Purpose-separated HMAC: never persist the attempted email, password, OTP or
// client-controlled forwarded IP as an authentication-alert grouping identity.
function pseudonymousLoginSubject(secret,email){
 if(typeof secret!=='string'||Buffer.byteLength(secret,'utf8')<32||
    typeof email!=='string'||!email)return null;
 return createHmac('sha256',secret).update('sentinelx:login-target:v1\n').update(email).digest('hex');
}
module.exports={pseudonymousLoginSubject};
