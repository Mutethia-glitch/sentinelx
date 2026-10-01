const test=require('node:test');
const assert=require('node:assert/strict');
const {generateCode,digestCode,equalDigest,codeInput,otpSecret}=require('../../src/auth/otp');
test('six-digit codes and HMAC digests are bounded, scoped and never plaintext',()=>{
 const secret='s'.repeat(32),codes=Array.from({length:50},()=>generateCode());
 assert.ok(codes.every(code=>/^\d{6}$/.test(code)));
 const a=digestCode(secret,'LOGIN','challenge-a','123456');
 assert.match(a,/^[0-9a-f]{64}$/);assert.equal(a.includes('123456'),false);
 assert.equal(equalDigest(a,digestCode(secret,'LOGIN','challenge-a','123456')),true);
 assert.equal(equalDigest(a,digestCode(secret,'LOGIN','challenge-b','123456')),false);
 assert.equal(equalDigest(a,digestCode(secret,'INVITATION','challenge-a','123456')),false);
 for(const bad of ['12345','1234567','abcdef',123456,null])assert.throws(()=>codeInput(bad),{status:400});
 assert.throws(()=>otpSecret('short'));
});
