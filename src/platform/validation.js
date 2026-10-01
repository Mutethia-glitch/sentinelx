const {normalizeEmail,validatePassword}=require('../auth/validation');
const {AuthError}=require('../auth/errors');
function signupInput(body){
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join(',')!=='adminEmail,adminName,companyName,password')throw new AuthError(400,'Invalid company signup.');
  if(typeof body.companyName!=='string'||body.companyName.trim().length<2||body.companyName.length>120||body.companyName.includes('\0')||
     typeof body.adminName!=='string'||!body.adminName.trim()||body.adminName.length>120||body.adminName.includes('\0'))throw new AuthError(400,'Invalid company signup.');
  return{companyName:body.companyName.trim(),adminName:body.adminName.trim(),adminEmail:normalizeEmail(body.adminEmail),password:validatePassword(body.password,true)};
}
function verifyInput(body){
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join(',')!=='code,registrationId'||
    typeof body.registrationId!=='string'||!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(body.registrationId)||
    typeof body.code!=='string'||!/^\d{6}$/.test(body.code))throw new AuthError(400,'Invalid company verification.');
  return{registrationId:body.registrationId,code:body.code};
}
function resendInput(body){
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).join(',')!=='registrationId'||
    typeof body.registrationId!=='string'||!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(body.registrationId))throw new AuthError(400,'Invalid resend request.');
  return{registrationId:body.registrationId};
}
module.exports={signupInput,verifyInput,resendInput};
