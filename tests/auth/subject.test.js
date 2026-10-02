'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {pseudonymousLoginSubject}=require('../../src/auth/subject');
const secret='z'.repeat(64);
test('failed-login target identity is purpose-separated, deterministic and non-reversible in logs',()=>{
 const first=pseudonymousLoginSubject(secret,'first@example.invalid');
 assert.match(first,/^[0-9a-f]{64}$/);
 assert.equal(first,pseudonymousLoginSubject(secret,'first@example.invalid'));
 assert.notEqual(first,pseudonymousLoginSubject(secret,'second@example.invalid'));
 assert.notEqual(first,pseudonymousLoginSubject('y'.repeat(64),'first@example.invalid'));
 assert.doesNotMatch(first,/first|example|invalid/);
 assert.equal(pseudonymousLoginSubject(null,'first@example.invalid'),null);
});
