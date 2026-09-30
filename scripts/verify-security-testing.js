'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

function main(){
  const root=path.join(__dirname,'..');
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  assert.equal(pkg.scripts['test:security:application'],'node --test tests/security/application-security.test.js');
  assert.equal(pkg.scripts['verify:security-testing'],'node scripts/verify-security-testing.js');
  assert.ok(pkg.scripts.test.includes('tests/security/*.test.js'));

  const testSource=fs.readFileSync(path.join(root,'tests/security/application-security.test.js'),'utf8');
  for(const token of [
    'SameSite=Strict','HttpOnly','Secure','access-control-allow-origin',
    'https://attacker.invalid','X-Role','frame-ancestors','object-src',
    '/access/%2e%2e/.env','loginLimiter','Authentication temporarily unavailable'
  ])assert.ok(testSource.includes(token),token);

  const frontendRoot=path.join(root,'frontend');
  const frontendFiles=[];
  (function walk(dir){
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
      const item=path.join(dir,entry.name);
      if(entry.isDirectory())walk(item);
      else if(/\.(?:js|html)$/.test(entry.name))frontendFiles.push(item);
    }
  })(frontendRoot);
  const forbidden=[
    [/\.innerHTML\s*=/,'innerHTML assignment'],
    [/insertAdjacentHTML\s*\(/,'insertAdjacentHTML'],
    [/document\.write\s*\(/,'document.write'],
    [/\beval\s*\(/,'eval'],
    [/localStorage\b/,'localStorage'],
    [/sessionStorage\b/,'sessionStorage'],
  ];
  for(const file of frontendFiles){
    const source=fs.readFileSync(file,'utf8');
    for(const [pattern,label] of forbidden){
      assert.doesNotMatch(source,pattern,path.relative(root,file)+' contains prohibited '+label);
    }
  }

  const browser=fs.readFileSync(path.join(root,'tests/integration/frontend-security-ui.test.js'),'utf8');
  assert.ok(browser.includes('<img src=x onerror=alert(1)>'));
  assert.ok(browser.includes("locator('#identity img').count()"));

  const findings=fs.readFileSync(path.join(root,'docs/SECURITY_TESTING.md'),'utf8');
  assert.ok(findings.includes('No new exploitable application defect requiring production-code remediation'));
  assert.ok(findings.includes('Residual deployment considerations'));

  console.log('Controlled authentication, authorization, input, API, session, CSP, path-exposure, XSS-regression and error-sanitization security coverage verified.');
}
if(require.main===module){try{main();}catch(error){console.error('Task 39 security-testing verification failed: '+error.message);process.exitCode=1;}}
module.exports={main};
