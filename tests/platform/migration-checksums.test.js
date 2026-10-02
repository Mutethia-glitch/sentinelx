const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { migrationChecksums } = require('../../scripts/migration-checksums');
const { migrationSql } = require('../../scripts/migrate');
const { platformMigrationSql } = require('../../scripts/migrate-platform');

function sqlFile(relativePath) {
  return fs.readFileSync(path.join(__dirname, '../..', relativePath), 'utf8');
}

test('tenant migration checksums accept exact LF and CRLF production history', () => {
  const cases = [
    ['017_connector_receipts.sql',
      '2962116a6fad0dc7bb592b0fae9f126d0e76ca45ef70b9faf38d445bba897ab1',
      '46c5ca552bf646841eb481f4fed5892e498e5ace4e0703598ec75d062a3d3676'],
    ['018_connector_login_containment.sql',
      '72d0cb5e9da2fe02e13e512e88ec765c17af38139554a5c836dc799a3ab9f89a',
      'da23d1443c6e8167b343c366925e6a27f61f20955f5cc562507207fdaadc785f'],
    ['019_pending_website_origin.sql',
      '31e1fd08342c3b6c23b29478f5f64be91103ac92552824119fc25b168d7aabd4',
      '74ae2edc4f2c8bedd261a122ff320220dc0684fe678537cc46d66ddb2e965640'],
    ['020_website_connectors.sql',
      '458b52b10a48414bf092c18368cd8b120a9da396daf12ba80615c4bfa9ccd708',
      '31002b682cbecba5158a4f2c9d3854ae7a663b97c23290cc2884955cc190958c'],
  ];
  const generated = migrationSql();
  for (const [name, lf, crlf] of cases) {
    const sql = sqlFile('db/migrations/' + name);
    const calculated = migrationChecksums(sql);
    assert.equal(calculated.canonical, lf, name + ' canonical LF');
    assert.deepEqual(calculated.accepted, [lf, crlf], name + ' accepted historical hashes');
    assert.ok(generated.includes("checksum NOT IN ('" + lf + "', '" + crlf + "')"), name);
    assert.ok(generated.includes("VALUES ('" + name + "', '" + lf + "')"), name + ' new ledger canonical');
  }
});

test('platform migration accepts its production CRLF history', () => {
  const file = '003_requested_website_origin.sql';
  const actual = migrationChecksums(sqlFile('platform/db/migrations/' + file));
  assert.ok(actual.accepted.includes('6b484bf1a10f27ed8c02588f465bdd0483e5639843b8ae07f3cdeaeb4ca078d2'));
  const generated = platformMigrationSql();
  assert.ok(generated.includes("checksum NOT IN (" + actual.accepted.map(value => "'" + value + "'").join(', ') + ")"));
  assert.ok(generated.includes("VALUES('" + file + "','" + actual.canonical + "')"));
});

test('only CRLF/LF conversion is equivalent, not changed SQL or other whitespace', () => {
  const original = sqlFile('db/migrations/017_connector_receipts.sql');
  const originalHashes = migrationChecksums(original);
  assert.deepEqual(migrationChecksums(original.replace(/\r\n/g, '\n')), originalHashes);
  assert.deepEqual(migrationChecksums(original.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n')), originalHashes);
  for (const changed of [original + '-- changed SQL\n', original.replace('source text', 'source varchar')]) {
    const changedHashes = migrationChecksums(changed);
    assert.ok(changedHashes.accepted.every(hash => !originalHashes.accepted.includes(hash)));
  }
});
