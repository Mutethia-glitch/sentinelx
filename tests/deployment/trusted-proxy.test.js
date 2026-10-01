const test=require('node:test');
const assert=require('node:assert/strict');
const {clientAddress}=require('../../src/api/security');
function req(remote,forwarded){return{socket:{remoteAddress:remote},headers:forwarded===undefined?{}:{'x-forwarded-for':forwarded}};}
test('forwarded client identity is accepted only from an explicitly trusted proxy',()=>{
 assert.equal(clientAddress(req('203.0.113.10','198.51.100.2'),['127.0.0.1']),'203.0.113.10');
 assert.equal(clientAddress(req('127.0.0.1','198.51.100.2'),['127.0.0.1']),'198.51.100.2');
 assert.equal(clientAddress(req('::ffff:127.0.0.1','198.51.100.3'),['127.0.0.1']),'198.51.100.3');
 assert.equal(clientAddress(req('127.0.0.1','198.51.100.2, 203.0.113.5'),['127.0.0.1']),'127.0.0.1');
 assert.equal(clientAddress(req('127.0.0.1','not-an-ip'),['127.0.0.1']),'127.0.0.1');
});
