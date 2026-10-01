const { randomInt, createHmac, timingSafeEqual } = require('node:crypto');
const { AuthError } = require('./errors');

const CODE=/^\d{6}$/;

function otpSecret(value){
  if(typeof value!=='string'||Buffer.byteLength(value,'utf8')<32)throw new Error('AUTH_OTP_SECRET must contain at least 32 bytes.');
  return value;
}
function generateCode(){return String(randomInt(0,1000000)).padStart(6,'0');}
function codeInput(value){
  if(typeof value!=='string'||!CODE.test(value))throw new AuthError(400,'Enter the 6-digit verification code.');
  return value;
}
function digestCode(secret,scope,id,code){
  otpSecret(secret);codeInput(code);
  if(typeof scope!=='string'||!scope||typeof id!=='string'||!id)throw new TypeError('Invalid OTP scope.');
  return createHmac('sha256',secret).update(scope+'\n'+id+'\n'+code).digest('hex');
}
function equalDigest(left,right){
  if(typeof left!=='string'||typeof right!=='string'||!/^[0-9a-f]{64}$/.test(left)||!/^[0-9a-f]{64}$/.test(right))return false;
  return timingSafeEqual(Buffer.from(left,'hex'),Buffer.from(right,'hex'));
}
module.exports={CODE,otpSecret,generateCode,codeInput,digestCode,equalDigest};
