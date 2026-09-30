'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {CATEGORY_CODES}=require('../../src/threats/taxonomy');
const {INITIAL_RULES}=require('../../src/rules/initial-rules');
const {parseFilters}=require('../../src/search/filters');
const {assessmentInput}=require('../../src/incidents/model');
const {QUERIES}=require('../../src/data/dashboard-repository');
const fixture=require('../../fixtures/events/initial-rule-scenarios.json');

const root=path.join(__dirname,'../..');
const sorted=values=>[...values].sort();

test('all fifteen canonical threat categories remain unique across taxonomy, core rules and scenario fixtures',()=>{
  assert.equal(CATEGORY_CODES.length,15);
  assert.equal(new Set(CATEGORY_CODES).size,15);
  assert.equal(INITIAL_RULES.length,15);
  assert.deepEqual(sorted(INITIAL_RULES.map(rule=>rule.categoryCode)),sorted(CATEGORY_CODES));
  assert.deepEqual(sorted(fixture.scenarios.map(item=>item.categoryCode)),sorted(CATEGORY_CODES));
});

test('all fifteen categories are accepted by category-aware search and incident assessment',()=>{
  for(const code of CATEGORY_CODES){
    for(const kind of ['event','alert','incident']){
      assert.equal(parseFilters(kind,new URLSearchParams({categoryCode:code})).categoryCode,code);
    }
    assert.equal(assessmentInput({categoryCode:code,severity:'HIGH',reason:'Task 40 taxonomy propagation'}).categoryCode,code);
  }
});

test('dashboard and reporting category aggregates do not truncate the approved taxonomy',()=>{
  assert.doesNotMatch(QUERIES.threats,/\bLIMIT\b/i);
  const reportSource=fs.readFileSync(path.join(root,'src/data/report-repository.js'),'utf8');
  const categoryQuery=reportSource.match(/const categories=await client\.query\(\x60([^\x60]+)\x60,inc\);/);
  assert.ok(categoryQuery,'report category aggregate query must remain present');
  assert.doesNotMatch(categoryQuery[1],/\bLIMIT\b/i);
});

test('event, alert and incident filter UIs expose all fifteen canonical category codes',()=>{
  for(const page of ['events','alerts','incidents']){
    const html=fs.readFileSync(path.join(root,'frontend',page,'index.html'),'utf8');
    assert.match(html,/name="categoryCode"[^>]*list="threat-category-codes"/);
    const block=html.match(/<datalist id="threat-category-codes">([\s\S]*?)<\/datalist>/);
    assert.ok(block,page+' must expose the canonical threat-category datalist');
    const values=[...block[1].matchAll(/<option value="([^"]+)"/g)].map(match=>match[1]);
    assert.equal(values.length,15,page+' category option count');
    assert.deepEqual(sorted(values),sorted(CATEGORY_CODES),page+' taxonomy options');
  }
});
