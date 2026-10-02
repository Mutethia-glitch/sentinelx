const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const { executeSql } = require('../../src/data/postgres');
const { migrationChecksums } = require('../../scripts/migration-checksums');
const { migrationSql } = require('../../scripts/migrate');
const { platformMigrationSql } = require('../../scripts/migrate-platform');

// Only CI-owned, disposable localhost databases are permitted by this test.
function disposableUrl(variable) {
  assert.equal(process.env.SENTINELX_TEST_DATABASE, '1', 'isolated CI opt-in required');
  const value = process.env[variable];
  assert.ok(value, variable + ' must be configured');
  const parsed = new URL(value);
  assert.ok(['127.0.0.1', 'localhost'].includes(parsed.hostname), 'only local disposable databases');
  assert.match(parsed.pathname, /^\/sentinelx_migration_compat_(tenant|platform)_ci$/);
  return value;
}

function fileHashes(filename) {
  const contents = fs.readFileSync(path.join(__dirname, '../..', filename), 'utf8');
  return migrationChecksums(contents);
}

function executeMigration(sql, url) {
  executeSql(sql, { ...process.env, DATABASE_URL: url });
}

test('isolated tenant ledger accepts existing LF and CRLF hashes but rejects tampering', async () => {
  const url = disposableUrl('MIGRATION_COMPAT_TENANT_DATABASE_URL');
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    executeMigration(migrationSql(), url);
    for (const name of ['017_connector_receipts.sql', '018_connector_login_containment.sql',
      '019_pending_website_origin.sql', '020_website_connectors.sql']) {
      const { accepted } = fileHashes('db/migrations/' + name);
      assert.equal(accepted.length, 2, name + ' must have both line-ending formats');
      await client.query('UPDATE schema_migrations SET checksum = $1 WHERE name = $2',
        [accepted[1], name]);
    }
    // All four CRLF-style production checksums are now in the ledger.
    executeMigration(migrationSql(), url);
    const rows = (await client.query(
      "SELECT name, checksum FROM schema_migrations WHERE name IN ('017_connector_receipts.sql','018_connector_login_containment.sql','019_pending_website_origin.sql','020_website_connectors.sql') ORDER BY name"
    )).rows;
    assert.equal(rows.length, 4);
    const added=await client.query("SELECT checksum FROM schema_migrations WHERE name='021_managed_evidence_feeds.sql'");
    assert.equal(added.rows.length,1,'New additive migration must exist independently of the four historical checksums');
    for (const row of rows) {
      assert.equal(row.checksum, fileHashes('db/migrations/' + row.name).accepted[1],
        'historical ledger checksum is preserved');
    }

    await client.query("UPDATE schema_migrations SET checksum = $1 WHERE name = '020_website_connectors.sql'",
      ['f'.repeat(64)]);
    assert.throws(() => executeMigration(migrationSql(), url), /PostgreSQL operation failed/);
    const stillBad = await client.query(
      "SELECT checksum FROM schema_migrations WHERE name = '020_website_connectors.sql'"
    );
    assert.equal(stillBad.rows[0].checksum, 'f'.repeat(64));
  } finally {
    await client.end();
  }
});

test('isolated platform ledger accepts existing CRLF without changing stored checksums', async () => {
  const url = disposableUrl('MIGRATION_COMPAT_PLATFORM_DATABASE_URL');
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    executeMigration(platformMigrationSql(), url);
    const { accepted } = fileHashes('platform/db/migrations/003_requested_website_origin.sql');
    assert.equal(accepted.length, 2);
    await client.query(
      "UPDATE platform_schema_migrations SET checksum = $1 WHERE name = '003_requested_website_origin.sql'",
      [accepted[1]]);
    executeMigration(platformMigrationSql(), url);
    const row = await client.query(
      "SELECT checksum FROM platform_schema_migrations WHERE name = '003_requested_website_origin.sql'"
    );
    assert.equal(row.rows[0].checksum, accepted[1]);
    await client.query(
      "UPDATE platform_schema_migrations SET checksum = $1 WHERE name = '003_requested_website_origin.sql'",
      ['f'.repeat(64)]);
    assert.throws(() => executeMigration(platformMigrationSql(), url), /PostgreSQL operation failed/);
  } finally {
    await client.end();
  }
});
