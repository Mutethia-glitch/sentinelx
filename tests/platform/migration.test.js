const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {platformMigrationSql}=require('../../scripts/migrate-platform');

test('platform onboarding migration is structurally intact and checksum-wrapped',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../../platform/db/migrations/001_company_onboarding.sql'),'utf8');
  assert.match(source,/code_digest text CHECK \(code_digest IS NULL OR code_digest ~ '\^\[0-9a-f\]\{64\}\$'\),/);
  assert.equal((source.match(/CREATE TABLE company_signups/g)||[]).length,1);
  assert.equal((source.match(/CREATE INDEX company_signups_tenant_idx/g)||[]).length,1);
  const migration=platformMigrationSql();
  assert.match(migration,/platform_schema_migrations/);
  assert.match(migration,/001_company_onboarding\.sql/);
});
