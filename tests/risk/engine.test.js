const test=require('node:test');
const assert=require('node:assert/strict');
const {SEVERITY_POINTS,FORMULA_VERSION,eventFrequencyBonus,riskScore}=require('../../src/risk/engine');

test('severity bases are deterministic and documented',()=>{
  assert.deepEqual(SEVERITY_POINTS,{LOW:20,MEDIUM:40,HIGH:60,CRITICAL:80});
  assert.equal(FORMULA_VERSION,1);
  assert.equal(riskScore('LOW',1).score,20);
  assert.equal(riskScore('MEDIUM',1).score,40);
  assert.equal(riskScore('HIGH',1).score,60);
  assert.equal(riskScore('CRITICAL',1).score,80);
});

test('frequency bonus begins after the first distinct event and caps at twenty points',()=>{
  assert.equal(eventFrequencyBonus(0),0);
  assert.equal(eventFrequencyBonus(1),0);
  assert.equal(eventFrequencyBonus(2),2);
  assert.equal(eventFrequencyBonus(10),18);
  assert.equal(eventFrequencyBonus(11),20);
  assert.equal(eventFrequencyBonus(100),20);
});

test('risk score is capped at one hundred and exposes explainable components',()=>{
  assert.deepEqual(riskScore('HIGH',4),{score:66,severityPoints:60,frequencyPoints:6,eventCount:4,formulaVersion:1});
  assert.equal(riskScore('CRITICAL',11).score,100);
  assert.equal(riskScore('CRITICAL',999).score,100);
});

test('invalid severity and frequency inputs are rejected',()=>{
  assert.throws(()=>riskScore('EXTREME',1),/Unsupported severity/);
  assert.throws(()=>eventFrequencyBonus(-1),/non-negative integer/);
  assert.throws(()=>eventFrequencyBonus(1.5),/non-negative integer/);
});
